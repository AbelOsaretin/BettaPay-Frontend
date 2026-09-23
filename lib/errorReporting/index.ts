/**
 * Frontend error reporting.
 *
 * Gives production crashes somewhere to go other than a user's console. Every
 * exception — boundary-caught render errors, uncaught window errors, rejected
 * promises, API and wallet failures — is scrubbed of PII, tagged with route
 * and store context, batched, and posted to `/api/errors`.
 *
 * Usage (initialize once in a top-level provider):
 *
 *   import { initErrorReporting } from '@/lib/errorReporting';
 *   const cleanup = initErrorReporting();
 *
 * Anywhere else:
 *
 *   captureException(err, { source: 'wallet' });
 */

import { getClientId } from '../rum/client';
import { captureContext } from './context';
import { scrubText, scrubStack, fingerprint, MAX_COMPONENT_STACK_LENGTH } from './scrub';
import { enqueue, initSender, destroySender, flush } from './send';
import type { ErrorReport, ErrorSource } from './types';

export interface CaptureOptions {
  /** Where the error was caught. Defaults to `manual`. */
  source?: ErrorSource;
  /** React component stack, for boundary-caught errors. */
  componentStack?: string;
  /** Route override; defaults to the current pathname. */
  route?: string;
}

/** Respect the same opt-out flags the RUM collector honours. */
function isReportingEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    if (localStorage.getItem('bp_telemetry_consent') === 'false') return false;
  } catch {
    // localStorage may be unavailable (private browsing, quota).
    return false;
  }

  const globals = window as unknown as Record<string, unknown>;
  if (globals.__ERROR_REPORTING_DISABLED__ || globals.__RUM_DISABLED__) {
    return false;
  }

  return true;
}

/** Reduce an unknown thrown value to a name and message. */
function describeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name || 'Error', message: error.message, stack: error.stack };
  }

  if (typeof error === 'string') {
    return { name: 'Error', message: error };
  }

  if (error && typeof error === 'object') {
    const candidate = error as { name?: unknown; message?: unknown; stack?: unknown };
    return {
      name: typeof candidate.name === 'string' ? candidate.name : 'Error',
      message:
        typeof candidate.message === 'string'
          ? candidate.message
          : safeStringify(error),
      stack: typeof candidate.stack === 'string' ? candidate.stack : undefined,
    };
  }

  return { name: 'Error', message: String(error) };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '[unserializable]';
  }
}

/** First stack frame, used to keep fingerprints stable across call sites. */
function topFrame(stack?: string): string {
  if (!stack) return '';
  const lines = stack.split('\n');
  return (lines[1] ?? lines[0] ?? '').trim();
}

/**
 * Report an exception. Never throws, and is a no-op on the server or when the
 * user has opted out of telemetry.
 */
export function captureException(error: unknown, options: CaptureOptions = {}): void {
  try {
    if (!isReportingEnabled()) return;

    const described = describeError(error);
    const message = scrubText(described.message);
    const stack = scrubStack(described.stack);

    const report: ErrorReport = {
      clientId: getClientId(),
      fingerprint: fingerprint([
        described.name,
        message,
        scrubText(topFrame(described.stack)),
      ]),
      source: options.source ?? 'manual',
      name: scrubText(described.name, 64) || 'Error',
      message: message || '(no message)',
      stack,
      componentStack: options.componentStack
        ? scrubText(options.componentStack, MAX_COMPONENT_STACK_LENGTH)
        : undefined,
      count: 1,
      context: captureContext(options.route),
      timestamp: Date.now(),
      appVersion: process.env.NEXT_PUBLIC_BUILD_ID || undefined,
    };

    enqueue(report);
  } catch {
    // Reporting must never become the failure it is trying to report.
  }
}

let isInitialized = false;

/**
 * Install global handlers for uncaught errors and unhandled promise
 * rejections, and start the batching transport.
 *
 * Safe to call multiple times — only the first call takes effect. Returns a
 * cleanup function that detaches the handlers and flushes pending reports.
 */
export function initErrorReporting(): () => void {
  if (isInitialized) return () => {};
  if (typeof window === 'undefined') return () => {};
  if (!isReportingEnabled()) return () => {};

  isInitialized = true;
  initSender();

  const handleError = (event: ErrorEvent): void => {
    captureException(event.error ?? event.message, { source: 'window' });
  };

  const handleRejection = (event: PromiseRejectionEvent): void => {
    captureException(event.reason, { source: 'unhandledrejection' });
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
    destroySender();
    isInitialized = false;
  };
}

/** Force delivery of anything queued (tests, or before a hard navigation). */
export function flushErrorReports(): void {
  flush();
}

export type { ErrorReport, ErrorContext, ErrorSource, ErrorBatchPayload } from './types';
export { setWalletContextProvider } from './context';
export { scrubText, fingerprint } from './scrub';
