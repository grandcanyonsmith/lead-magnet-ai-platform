import { logger } from "../utils/logger";
import {
  CloudflareError,
  CloudflareRateLimitError,
  CloudflareZoneNotFoundError,
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
  7003: "Domain not found in Cloudflare. Please ensure the domain is added to your Cloudflare account first.",
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
   */
  async getZoneId(domain: string): Promise<string | null> {
    const rootDomain = this.extractRootDomain(domain);
    const startTime = Date.now();

    try {
      const response = await withRetry(
        async () => {
          return await fetch(
            `${this.baseUrl}/zones?name=${encodeURIComponent(rootDomain)}`,
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
          domain: rootDomain,
          status: response.status,
        });
        throw new CloudflareError("Invalid response from Cloudflare API", undefined, 500);
      }

      const data = rawData;

      if (!data.success) {
        // Check for specific error codes
        const errorCode = data.errors?.[0]?.code;
        if (errorCode === 7003) {
          throw new CloudflareZoneNotFoundError(rootDomain);
        }

        const errorMessage =
          data.errors?.map((e) => CLOUDFLARE_ERROR_MESSAGES[e.code] || e.message).join(", ") ||
          "Unknown error";
        throw new CloudflareError(errorMessage, String(errorCode), 400, {
          errors: data.errors,
        });
      }

      if (!data.result || data.result.length === 0) {
        logger.warn("[CloudflareService] Zone not found", {
          domain: rootDomain,
          duration: Date.now() - startTime,
        });
        return null;
      }

      logger.info("[CloudflareService] Zone found", {
        domain: rootDomain,
        zoneId: data.result[0].id,
        duration: Date.now() - startTime,
      });

      return data.result[0].id;
    } catch (error) {
      if (
        error instanceof CloudflareError ||
        error instanceof CloudflareRateLimitError ||
        error instanceof CloudflareZoneNotFoundError
      ) {
        throw error;
      }
      logger.error("[CloudflareService] Failed to get zone ID", {
        error: error instanceof Error ? error.message : String(error),
        domain: rootDomain,
        duration: Date.now() - startTime,
      });
      throw new CloudflareError("Failed to find domain in Cloudflare", undefined, 500, {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
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
        if (errorCode === 81057) {
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

  /**
   * Extract root domain from subdomain
   * e.g., "forms.example.com" -> "example.com"
   */
  private extractRootDomain(domain: string): string {
    const parts = domain.split(".");
    if (parts.length <= 2) {
      return domain;
    }
    // Return last two parts (domain + TLD)
    return parts.slice(-2).join(".");
  }
}
