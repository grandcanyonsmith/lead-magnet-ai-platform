export async function callResponsesWithTimeout<T>(
  promiseFactory: () => Promise<T>,
  _contextLabel: string, // Parameter kept for compatibility but not used
  _timeoutMs?: number // Parameter kept for compatibility but not used
): Promise<T> {
  // No timeout - just call the promise factory directly
  return await promiseFactory();
}

export const RESPONSES_TIMEOUT_MS = 0; // No timeout


