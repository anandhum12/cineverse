/** Framework-free error type so domain services stay testable outside Next.js. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
