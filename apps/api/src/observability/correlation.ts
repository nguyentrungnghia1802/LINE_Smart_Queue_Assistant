import { AsyncLocalStorage } from 'node:async_hooks';

const requestIdStorage = new AsyncLocalStorage<string>();

/** Run downstream request work with its trusted server-generated request ID. */
export function runWithRequestId<T>(requestId: string, callback: () => T): T {
  return requestIdStorage.run(requestId, callback);
}

/** Return the request ID associated with the current async execution context. */
export function currentRequestId(): string | undefined {
  return requestIdStorage.getStore();
}
