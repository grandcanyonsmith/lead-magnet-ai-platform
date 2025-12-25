import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@utils/db";
import { ApiError } from "@utils/errors";
import { env } from "@utils/env";
import { logger } from "@utils/logger";
import { delay } from "@utils/timeout";

function getUtcHourBucket(now: Date): { bucket: string; ttl: number } {
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
  const ttl = Math.floor(bucketEnd.getTime() / 1000) + 2 * 60 * 60; // keep 2h past boundary
  const bucket = bucketStart.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  return { bucket, ttl };
}

export class ShellAbuseControlService {
  /**
   * Per-IP, per-hour limiter for the public shell endpoint.
   */
  async consumeIpToken(args: {
    sourceIp: string;
    limitPerHour: number;
  }): Promise<{ count: number; limit: number; bucket: string }> {
    const tableName = env.rateLimitsTable;
    const sourceIp = (args.sourceIp || "unknown").trim() || "unknown";
    const limitPerHour = Number.isFinite(args.limitPerHour)
      ? Math.max(1, Math.floor(args.limitPerHour))
      : 10;

    const now = new Date();
    const { bucket, ttl } = getUtcHourBucket(now);
    const pk = `rl#shell#ip#${sourceIp}#hour#${bucket}`;
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
            "#ip = if_not_exists(#ip, :ip), " +
            "#bucket = if_not_exists(#bucket, :bucket)",
          ConditionExpression:
            "attribute_not_exists(#count) OR #count < :limit",
          ExpressionAttributeNames: {
            "#count": "count",
            "#ttl": "ttl",
            "#created_at": "created_at",
            "#updated_at": "updated_at",
            "#ip": "ip",
            "#bucket": "bucket",
          },
          ExpressionAttributeValues: {
            ":inc": 1,
            ":ttl": ttl,
            ":now": nowIso,
            ":limit": limitPerHour,
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
        logger.warn("[ShellAbuseControl] IP rate limit exceeded", {
          sourceIp,
          limitPerHour,
          bucket,
        });
        throw new ApiError("Rate limit exceeded. Please try again later.", 429);
      }
      logger.error(
        "[ShellAbuseControl] Failed to apply IP rate limiting (fail closed)",
        {
          sourceIp,
          error: error?.message || String(error),
        },
      );
      throw new ApiError(
        "Rate limiting unavailable. Please try again later.",
        503,
      );
    }
  }

  /**
   * Global concurrency gate implemented as a DynamoDB-backed counter.
   *
   * This is a best-effort queue: callers can optionally wait for up to `waitMs`
   * for a slot to free up (polling with jitter).
   */
  async acquireGlobalSlot(args: {
    maxInFlight: number;
    waitMs: number;
  }): Promise<{ release: () => Promise<void> }> {
    const tableName = env.rateLimitsTable;
    const maxInFlight = Number.isFinite(args.maxInFlight)
      ? Math.max(1, Math.floor(args.maxInFlight))
      : 5;
    const waitMs = Number.isFinite(args.waitMs)
      ? Math.max(0, Math.floor(args.waitMs))
      : 0;

    const pk = "sem#shell#global";
    const start = Date.now();

    const tryAcquire = async (): Promise<boolean> => {
      const now = new Date();
      const nowIso = now.toISOString();
      const ttl = Math.floor(now.getTime() / 1000) + 30 * 60; // leak protection
      try {
        await docClient.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { pk },
            UpdateExpression:
              "ADD #in_flight :inc " +
              "SET #ttl = :ttl, " +
              "#updated_at = :now, " +
              "#created_at = if_not_exists(#created_at, :now)",
            ConditionExpression:
              "attribute_not_exists(#in_flight) OR #in_flight < :limit",
            ExpressionAttributeNames: {
              "#in_flight": "in_flight",
              "#ttl": "ttl",
              "#created_at": "created_at",
              "#updated_at": "updated_at",
            },
            ExpressionAttributeValues: {
              ":inc": 1,
              ":ttl": ttl,
              ":now": nowIso,
              ":limit": maxInFlight,
            },
            ReturnValues: "NONE",
          }),
        );
        return true;
      } catch (error: any) {
        if (error?.name === "ConditionalCheckFailedException") {
          return false;
        }
        logger.error("[ShellAbuseControl] Failed to acquire global slot", {
          error: error?.message || String(error),
        });
        throw new ApiError(
          "Concurrency limiter unavailable. Please try again later.",
          503,
        );
      }
    };

    // Use `for (;;)` instead of `while (true)` to satisfy `no-constant-condition`
    // while still representing an intentional bounded wait loop.
    for (;;) {
      const acquired = await tryAcquire();
      if (acquired) {
        return {
          release: async () => {
            try {
              const now = new Date();
              const nowIso = now.toISOString();
              const ttl = Math.floor(now.getTime() / 1000) + 5 * 60;
              await docClient.send(
                new UpdateCommand({
                  TableName: tableName,
                  Key: { pk },
                  UpdateExpression:
                    "ADD #in_flight :dec SET #ttl = :ttl, #updated_at = :now",
                  ConditionExpression:
                    "attribute_exists(#in_flight) AND #in_flight >= :one",
                  ExpressionAttributeNames: {
                    "#in_flight": "in_flight",
                    "#ttl": "ttl",
                    "#updated_at": "updated_at",
                  },
                  ExpressionAttributeValues: {
                    ":dec": -1,
                    ":ttl": ttl,
                    ":now": nowIso,
                    ":one": 1,
                  },
                  ReturnValues: "NONE",
                }),
              );
            } catch (error: any) {
              logger.warn(
                "[ShellAbuseControl] Failed to release global slot (leak-protected by TTL)",
                {
                  error: error?.message || String(error),
                },
              );
            }
          },
        };
      }

      const elapsed = Date.now() - start;
      if (elapsed >= waitMs) {
        throw new ApiError("System is busy. Please try again later.", 429);
      }

      const remaining = waitMs - elapsed;
      const sleepMs =
        Math.min(500, Math.max(50, Math.floor(remaining / 5))) +
        Math.floor(Math.random() * 25);
      await delay(sleepMs);
    }
  }
}

export const shellAbuseControlService = new ShellAbuseControlService();
