import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@utils/db";
import { ApiError } from "@utils/errors";
import { env } from "@utils/env";
import { logger } from "@utils/logger";

/**
 * Simple DynamoDB-backed per-IP, per-form, per-hour rate limiter.
 *
 * Implementation notes:
 * - Uses a single-item atomic counter (`ADD count :inc`) guarded by a ConditionExpression.
 * - Uses TTL to auto-expire counters.
 * - Key design avoids hot partitions in normal use by including form+ip+hour bucket.
 */
export class RateLimitService {
  async consumeFormSubmissionToken(args: {
    tenantId: string;
    formId: string;
    sourceIp: string;
    limitPerHour: number;
  }): Promise<{ count: number; limit: number; bucket: string }> {
    const tableName = env.rateLimitsTable;
    const { tenantId, formId } = args;

    if (!tableName || tableName.trim().length === 0) {
      // Fail closed would break public forms if misconfigured; fail open but log loudly.
      logger.warn(
        "[RateLimitService] RATE_LIMITS_TABLE not configured; skipping rate limiting",
        {
          tenantId,
          formId,
        },
      );
      return { count: 0, limit: args.limitPerHour, bucket: "unknown" };
    }

    const sourceIp = (args.sourceIp || "unknown").trim() || "unknown";
    const limitPerHour = Number.isFinite(args.limitPerHour)
      ? Math.max(1, Math.floor(args.limitPerHour))
      : 10;

    const now = new Date();
    const bucketStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        0,
        0,
        0,
      ),
    );
    const bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000);

    // Keep counters around a bit longer than the hour so late-arriving requests still compare correctly.
    const ttl = Math.floor(bucketEnd.getTime() / 1000) + 2 * 60 * 60;

    const bucket = bucketStart.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const pk = `rl#tenant#${tenantId}#form#${formId}#ip#${sourceIp}#hour#${bucket}`;
    const nowIso = now.toISOString();

    try {
      const result = await docClient.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { pk },
          UpdateExpression:
            "ADD #count :inc " +
            "SET #ttl = :ttl, " +
            "#updated_at = :now, " +
            "#created_at = if_not_exists(#created_at, :now), " +
            "#tenant_id = if_not_exists(#tenant_id, :tenant_id), " +
            "#form_id = if_not_exists(#form_id, :form_id), " +
            "#ip = if_not_exists(#ip, :ip), " +
            "#bucket = if_not_exists(#bucket, :bucket)",
          ConditionExpression:
            "attribute_not_exists(#count) OR #count < :limit",
          ExpressionAttributeNames: {
            "#count": "count",
            "#ttl": "ttl",
            "#created_at": "created_at",
            "#updated_at": "updated_at",
            "#tenant_id": "tenant_id",
            "#form_id": "form_id",
            "#ip": "ip",
            "#bucket": "bucket",
          },
          ExpressionAttributeValues: {
            ":inc": 1,
            ":ttl": ttl,
            ":now": nowIso,
            ":limit": limitPerHour,
            ":tenant_id": tenantId,
            ":form_id": formId,
            ":ip": sourceIp,
            ":bucket": bucket,
          },
          ReturnValues: "UPDATED_NEW",
        }),
      );

      const count = (result.Attributes?.count as number) || 0;
      return { count, limit: limitPerHour, bucket };
    } catch (error: any) {
      if (error?.name === "ConditionalCheckFailedException") {
        logger.warn("[RateLimitService] Rate limit exceeded", {
          tenantId,
          formId,
          sourceIp,
          limitPerHour,
          bucket,
        });
        throw new ApiError("Rate limit exceeded. Please try again later.", 429);
      }

      logger.error(
        "[RateLimitService] Failed to apply rate limiting (fail open)",
        {
          tenantId,
          formId,
          sourceIp,
          error: error?.message || String(error),
        },
      );

      // Fail open: don't break form submissions if limiter table has transient issues.
      return { count: 0, limit: limitPerHour, bucket };
    }
  }
}

export const rateLimitService = new RateLimitService();
