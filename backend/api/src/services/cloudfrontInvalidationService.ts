import { env } from '../utils/env';
import { logger } from '../utils/logger';

function normalizePath(path: string): string {
  const trimmed = String(path || '').trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export async function invalidateCloudFrontPaths(paths: string[]): Promise<void> {
  const distributionId = (env.cloudfrontDistributionId || '').trim();
  if (!distributionId) {
    logger.warn('[CloudFrontInvalidation] CLOUDFRONT_DISTRIBUTION_ID not set; skipping invalidation', {
      paths: paths?.slice(0, 5),
    });
    return;
  }

  const items = (paths || []).map(normalizePath).filter(Boolean);
  if (items.length === 0) {
    return;
  }

  // Use AWS SDK v2 which is available in AWS Lambda runtimes. We avoid adding a new dependency
  // (and lockfile churn) by using the built-in SDK. In local dev, this may be missing; we no-op.
  let CloudFront: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AWS = require('aws-sdk');
    CloudFront = AWS?.CloudFront;
  } catch (error: any) {
    logger.warn('[CloudFrontInvalidation] aws-sdk not available; skipping invalidation', {
      error: error?.message || String(error),
    });
    return;
  }

  if (!CloudFront) {
    logger.warn('[CloudFrontInvalidation] aws-sdk CloudFront client not found; skipping invalidation');
    return;
  }

  const client = new CloudFront({ apiVersion: '2020-05-31' });
  const callerReference = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  logger.info('[CloudFrontInvalidation] Creating invalidation', {
    distributionId,
    itemCount: items.length,
    items: items.slice(0, 10),
  });

  await new Promise<void>((resolve, reject) => {
    client.createInvalidation(
      {
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: callerReference,
          Paths: {
            Quantity: items.length,
            Items: items,
          },
        },
      },
      (err: any) => {
        if (err) return reject(err);
        return resolve();
      }
    );
  });
}


