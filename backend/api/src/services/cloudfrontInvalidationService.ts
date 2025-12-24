import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

const cloudfrontClient = new CloudFrontClient({ region: env.awsRegion || 'us-east-1' });

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

  const callerReference = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  logger.info('[CloudFrontInvalidation] Creating invalidation', {
    distributionId,
    itemCount: items.length,
    items: items.slice(0, 10),
  });

  await cloudfrontClient.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: callerReference,
        Paths: {
          Quantity: items.length,
          Items: items,
        },
      },
    })
  );
}


