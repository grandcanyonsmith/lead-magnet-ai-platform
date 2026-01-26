import { logger } from '@utils/logger';
import { RouteResponse } from '@routes/routes';
import { RequestContext } from '@routes/router';

export interface StreamOptions {
  onDelta: (text: string) => void;
}

export async function handleStream(
  context: RequestContext | undefined,
  streamFn: (options: StreamOptions) => Promise<any>,
  fallbackFn: () => Promise<RouteResponse>,
  logPrefix: string = '[Stream Helper]'
): Promise<RouteResponse> {
  const res = (context as any)?.res;
  if (!res) {
    return await fallbackFn();
  }

  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  try {
    const result = await streamFn({
      onDelta: (text) => {
        try {
          res.write(JSON.stringify({ type: 'delta', text }) + '\n');
        } catch (e) {
          logger.error(`${logPrefix} Failed to serialize delta`, {
            error: String(e),
          });
        }
      },
    });

    try {
      const serialized = JSON.stringify({ type: 'done', result });
      res.write(serialized + '\n');
    } catch (e) {
      logger.error(`${logPrefix} Failed to serialize result`, {
        error: String(e),
      });
      res.write(
        JSON.stringify({
          type: 'error',
          message: 'Failed to serialize result',
        }) + '\n',
      );
    }
  } catch (error: any) {
    res.write(
      JSON.stringify({
        type: 'error',
        message: error?.message || 'Failed to stream response',
      }) + '\n',
    );
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }

  return { statusCode: 200, body: { handled: true } };
}
