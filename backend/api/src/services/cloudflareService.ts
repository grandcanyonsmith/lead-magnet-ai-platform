import { logger } from "../utils/logger";
import {
  CloudflareError,
  CloudflareRateLimitError,
  CloudflareRecordExistsError,
} from "../utils/errors";
import { withRetry } from "../utils/retry";

interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

interface CloudflareDNSRecord {
  id?: string;
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
}

interface CloudflareAPIResponse<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
}

/**
 * Type guard for Cloudflare API responses
 */
function isCloudflareResponse<T>(data: unknown): data is CloudflareAPIResponse<T> {
  return (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    typeof (data as any).success === "boolean" &&
    "result" in data
  );
}

/**
 * Map Cloudflare error codes to user-friendly messages
 */
const CLOUDFLARE_ERROR_MESSAGES: Record<number, string> = {
  1003: "Invalid API token. Please check your token permissions.",
  1004: "Invalid API token format.",
  1005: "Invalid API token. Token may have been revoked.",
  6003: "Invalid request headers.",
  7000: "No route for that URI.",
  7003: "Domain not found in Cloudflare. Please ensure the domain is added to your Cloudflare account first.",
  81053: "DNS record already exists.",
  81057: "DNS record already exists with this name and type.",
  81058: "Invalid DNS record content.",
  81059: "Invalid DNS record name.",
  9004: "Rate limit exceeded. Please try again in a moment.",
  9109: "Invalid request format.",
};

/**
 * Service for interacting with Cloudflare API
 */
export class CloudflareService {
  private apiToken: string;
  private baseUrl = "https://api.cloudflare.com/client/v4";

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  /**
   * Verify API token is valid
   */
  async verifyToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user/tokens/verify`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new CloudflareRateLimitError(retryAfter || undefined);
      }

      const rawData = await response.json();
      if (!isCloudflareResponse<any>(rawData)) {
        logger.error("[CloudflareService] Invalid API response format", {
          status: response.status,
        });
        return false;
      }

      const data = rawData;
      return data.success === true;
    } catch (error) {
      if (error instanceof CloudflareRateLimitError) {
        throw error;
      }
      logger.error("[CloudflareService] Token verification failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get zone ID for a domain
   * Iteratively checks for the zone by stripping subdomains until a match is found.
   */
  async getZoneId(domain: string): Promise<{ id: string; name: string } | null> {
    let currentDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const originalDomain = currentDomain;
    const startTime = Date.now();
    let lastError: Error | null = null;

    // Keep checking as long as we have at least a domain and TLD (e.g. "example.com")
    while (currentDomain.includes(".") && currentDomain.split(".").length >= 2) {
      try {
        const response = await withRetry(
          async () => {
            return await fetch(
              `${this.baseUrl}/zones?name=${encodeURIComponent(currentDomain)}`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${this.apiToken}`,
                  "Content-Type": "application/json",
                },
              },
            );
          },
          {
            maxRetries: 3,
            retryableErrors: [429, 500, 502, 503, 504],
          },
        );

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          throw new CloudflareRateLimitError(retryAfter || undefined);
        }

        const rawData = await response.json();
        if (!isCloudflareResponse<CloudflareZone[]>(rawData)) {
          logger.error("[CloudflareService] Invalid API response format", {
            domain: currentDomain,
            status: response.status,
          });
          // Don't throw here, just try next parent domain or fail later
          lastError = new CloudflareError("Invalid response from Cloudflare API", undefined, 500);
        } else {
          const data = rawData;

          if (data.success && data.result && data.result.length > 0) {
            logger.info("[CloudflareService] Zone found", {
              searchDomain: currentDomain,
              originalDomain,
              zoneId: data.result[0].id,
              zoneName: data.result[0].name,
              duration: Date.now() - startTime,
            });
            return {
              id: data.result[0].id,
              name: data.result[0].name,
            };
          }
          
          // If success but no result, it means zone not found for this domain part.
          // Continue loop.
        }

      } catch (error) {
        if (error instanceof CloudflareRateLimitError) {
          throw error;
        }
        // Store error and continue to next parent domain
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn("[CloudflareService] Error checking zone for domain part", {
          domainPart: currentDomain,
          error: lastError.message
        });
      }

      // Strip first part to try parent domain
      const parts = currentDomain.split(".");
      if (parts.length <= 2) {
        // We just checked "example.com" or "co.uk" and failed. Stop.
        break;
      }
      currentDomain = parts.slice(1).join(".");
    }

    logger.warn("[CloudflareService] Zone not found after iterative search", {
      domain: originalDomain,
      duration: Date.now() - startTime,
      lastError: lastError?.message,
    });
    
    // If we exit loop without returning, we didn't find it.
    // If we had a specific error that wasn't "not found", we might want to log it.
    
    return null;
  }

  /**
   * Create a DNS record
   */
  async createDNSRecord(
    zoneId: string,
    record: CloudflareDNSRecord,
  ): Promise<CloudflareDNSRecord> {
    const startTime = Date.now();

    try {
      const response = await withRetry(
        async () => {
          return await fetch(`${this.baseUrl}/zones/${zoneId}/dns_records`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: record.type,
              name: record.name,
              content: record.content,
              ttl: record.ttl || 1, // Auto TTL
              proxied: record.proxied !== undefined ? record.proxied : false, // DNS only by default
            }),
          });
        },
        {
          maxRetries: 3,
          retryableErrors: [429, 500, 502, 503, 504],
        },
      );

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new CloudflareRateLimitError(retryAfter || undefined);
      }

      const rawData = await response.json();
      if (!isCloudflareResponse<CloudflareDNSRecord>(rawData)) {
        logger.error("[CloudflareService] Invalid API response format", {
          zoneId,
          record,
          status: response.status,
        });
        throw new CloudflareError("Invalid response from Cloudflare API", undefined, 500);
      }

      const data = rawData;

      if (!data.success) {
        // Check for specific error codes
        const errorCode = data.errors?.[0]?.code;
        if (errorCode === 81057 || errorCode === 81053) {
          throw new CloudflareRecordExistsError(record.name);
        }

        const errorMessage =
          data.errors
            ?.map((e) => CLOUDFLARE_ERROR_MESSAGES[e.code] || e.message)
            .join(", ") || "Unknown error";
        logger.error("[CloudflareService] Failed to create DNS record", {
          errors: data.errors,
          record,
          zoneId,
          duration: Date.now() - startTime,
        });
        throw new CloudflareError(
          `Failed to create DNS record: ${errorMessage}`,
          String(errorCode),
          400,
          {
            errors: data.errors,
            record,
          },
        );
      }

      logger.info("[CloudflareService] DNS record created", {
        zoneId,
        recordName: record.name,
        recordType: record.type,
        target: record.content,
        duration: Date.now() - startTime,
      });

      return data.result;
    } catch (error) {
      if (
        error instanceof CloudflareError ||
        error instanceof CloudflareRateLimitError ||
        error instanceof CloudflareRecordExistsError
      ) {
        throw error;
      }
      logger.error("[CloudflareService] Error creating DNS record", {
        error: error instanceof Error ? error.message : String(error),
        record,
        zoneId,
        duration: Date.now() - startTime,
      });
      throw new CloudflareError("Failed to create DNS record", undefined, 500, {
        originalError: error instanceof Error ? error.message : String(error),
        record,
      });
    }
  }

  /**
   * Check if a DNS record already exists
   */
  async recordExists(zoneId: string, name: string, type: string): Promise<boolean> {
    try {
      const response = await withRetry(
        async () => {
          return await fetch(
            `${this.baseUrl}/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}&type=${type}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${this.apiToken}`,
                "Content-Type": "application/json",
              },
            },
          );
        },
        {
          maxRetries: 2,
          retryableErrors: [429, 500, 502, 503, 504],
        },
      );

      const rawData = await response.json();
      if (!isCloudflareResponse<CloudflareDNSRecord[]>(rawData)) {
        logger.warn("[CloudflareService] Invalid API response format when checking record", {
          zoneId,
          name,
          type,
        });
        return false;
      }

      const data = rawData;

      return (
        data.success === true &&
        data.result !== undefined &&
        data.result.length > 0
      );
    } catch (error) {
      logger.error("[CloudflareService] Error checking DNS record", {
        error: error instanceof Error ? error.message : String(error),
        name,
        type,
        zoneId,
      });
      return false;
    }
  }
}
