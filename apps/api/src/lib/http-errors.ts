// filepath: apps/api/src/lib/http-errors.ts
/**
 * Typed HTTP error class so the global onError handler can map known
 * errors to clean status codes and hide internals from clients.
 *
 * Routes throw `throw new HttpError(400, 'Invalid request')` and the
 * framework converts to a JSON body `{ error, requestId }` with the
 * correct status code. Anything else becomes a 500 with a generic body.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const isHttpError = (e: unknown): e is HttpError =>
  e instanceof HttpError || (typeof e === 'object' && e !== null && (e as any).name === 'HttpError');
