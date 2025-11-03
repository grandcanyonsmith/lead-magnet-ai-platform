const DEFAULT_TIMEOUT_MS = parseInt(process.env.OPENAI_RESPONSES_TIMEOUT_MS || '840000', 10); // 14 minutes (840s) - leave buffer for Lambda timeout

export async function callResponsesWithTimeout<T>(
  promiseFactory: () => Promise<T>,
  contextLabel: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Responses API ${contextLabel} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return await Promise.race([promiseFactory(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export const RESPONSES_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;


