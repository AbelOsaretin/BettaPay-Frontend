/* eslint-disable @typescript-eslint/no-require-imports */
import type { AxiosInstance } from 'axios';

// Verifies that an open rate-limit window — including one broadcast from
// another tab — holds requests back locally instead of firing them into a
// limit the user is already waiting out.
describe('axios rate-limit gate', () => {
  let apiClient: AxiosInstance;
  let store: ReturnType<typeof import("../rateLimitStore").createRateLimitStore>;
  let dispatched: string[];

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    dispatched = [];

    const axios = require('axios');
    axios.defaults.adapter = (config: import("axios").InternalAxiosRequestConfig) => {
      dispatched.push(config.url);
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {},
      });
    };

    apiClient = require('@/lib/api/axios').apiClient;
    // Same module registry generation as the SUT, so this is the store the
    // interceptor actually reads.
    store = require('@/lib/store/rateLimitStore').useRateLimitStore;
    store.getState().clearRateLimit();
  });

  it('refuses requests to the limited endpoint without hitting the network', async () => {
    store.getState().setRateLimited(30, '/api/payments', 100);

    await expect(apiClient.get('/api/payments')).rejects.toMatchObject({
      code: 'RATE_LIMIT_BLOCKED',
      status: 429,
    });

    expect(dispatched).toHaveLength(0);
  });

  it('lets unrelated endpoints through while one endpoint is limited', async () => {
    store.getState().setRateLimited(30, '/api/payments', 100);

    await apiClient.get('/api/rates');

    expect(dispatched).toEqual(['/api/rates']);
  });

  it('pauses every request when the window is global', async () => {
    store.getState().setRateLimited(30, null);

    await expect(apiClient.get('/api/rates')).rejects.toMatchObject({
      code: 'RATE_LIMIT_BLOCKED',
    });
    expect(dispatched).toHaveLength(0);
  });

  it('pauses requests for a window adopted from another tab', async () => {
    store.getState().applyRemoteWindow({
      rateLimitedUntil: Date.now() + 30_000,
      endpoint: '/api/payments',
      limit: 100,
    });

    await expect(apiClient.get('/api/payments')).rejects.toMatchObject({
      code: 'RATE_LIMIT_BLOCKED',
    });
    expect(dispatched).toHaveLength(0);
  });

  it('resumes dispatching once the window has elapsed', async () => {
    store.setState({
      rateLimitedUntil: Date.now() - 1,
      secondsRemaining: 0,
      endpoint: '/api/payments',
      limit: null,
    });

    await apiClient.get('/api/payments');

    expect(dispatched).toEqual(['/api/payments']);
  });
});
