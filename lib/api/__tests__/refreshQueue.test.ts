import type { AxiosInstance } from 'axios';

// Verifies the 401 token-refresh flow: while a refresh is in flight, other 401s
// are queued and — once the refresh succeeds — re-issued so each caller receives
// its ACTUAL retried response (regression guard against resolving `undefined`).
describe('axios token-refresh queue', () => {
  let apiClient: AxiosInstance;
  let hits: Record<string, number>;

  beforeEach(() => {
    jest.resetModules();
    hits = {};
    // Require axios fresh in this module registry generation so the SUT (also
    // required below) shares the exact instance we configure the adapter on.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const axios = require('axios');

    const makeResponse = (config: import("axios").InternalAxiosRequestConfig, status: number, data: unknown) => ({
      data,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: {},
      config,
      request: {},
    });

    // Custom adapter used by both apiClient and refreshClient:
    // - /api/auth/refresh: succeeds after a short delay (keeps the refresh in
    //   flight long enough for the second request to be queued).
    // - any other URL: 401 on first hit, real 200 payload on the retry.
    const adapter = (config: import("axios").InternalAxiosRequestConfig) => {
      const url = config.url || '';
      if (url.includes('/api/auth/refresh')) {
        return new Promise((resolve) =>
          setTimeout(() => resolve(makeResponse(config, 200, { ok: true })), 20)
        );
      }
      hits[url] = (hits[url] || 0) + 1;
      if (hits[url] === 1) {
        return Promise.reject(
          new axios.AxiosError(
            'Unauthorized',
            'ERR_BAD_REQUEST',
            config,
            {},
            makeResponse(config, 401, { message: 'unauthorized' })
          )
        );
      }
      return Promise.resolve(makeResponse(config, 200, { value: `real-${url}` }));
    };

    axios.defaults.adapter = adapter;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    apiClient = require('@/lib/api/axios').apiClient;
  });

  it('re-issues the first 401 request and returns the real response', async () => {
    const res = await apiClient.get('/protected-a');
    expect(res.data).toEqual({ value: 'real-/protected-a' });
  });

  it('resolves a queued request with the real retried response, not undefined', async () => {
    // Fire two requests concurrently: the first drives the refresh, the second
    // hits 401 while the refresh is in flight and gets queued.
    const [first, second] = await Promise.all([
      apiClient.get('/protected-a'),
      apiClient.get('/protected-b'),
    ]);

    expect(first.data).toEqual({ value: 'real-/protected-a' });

    // The core regression: the queued request must resolve with its actual
    // AxiosResponse, not `undefined`.
    expect(second).toBeDefined();
    expect(second.data).toEqual({ value: 'real-/protected-b' });
  });
});
