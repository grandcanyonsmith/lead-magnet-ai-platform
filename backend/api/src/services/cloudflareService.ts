import { logger } from "../utils/logger";
import { ApiError } from "../utils/errors";

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

      const data = await response.json() as CloudflareAPIResponse<any>;
      return data.success === true;
    } catch (error) {
      logger.error("[CloudflareService] Token verification failed", { error });
      return false;
    }
  }

  /**
   * Get zone ID for a domain
   */
  async getZoneId(domain: string): Promise<string | null> {
    try {
      // Extract root domain (e.g., "forms.example.com" -> "example.com")
      const rootDomain = this.extractRootDomain(domain);
      
      const response = await fetch(
        `${this.baseUrl}/zones?name=${encodeURIComponent(rootDomain)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json() as CloudflareAPIResponse<CloudflareZone[]>;
      
      if (!data.success || !data.result || data.result.length === 0) {
        logger.warn("[CloudflareService] Zone not found", { domain: rootDomain });
        return null;
      }

      return data.result[0].id;
    } catch (error) {
      logger.error("[CloudflareService] Failed to get zone ID", { error, domain });
      throw new ApiError("Failed to find domain in Cloudflare", 500);
    }
  }

  /**
   * Create a DNS record
   */
  async createDNSRecord(
    zoneId: string,
    record: CloudflareDNSRecord
  ): Promise<CloudflareDNSRecord> {
    try {
      const response = await fetch(
        `${this.baseUrl}/zones/${zoneId}/dns_records`,
        {
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
        }
      );

      const data = await response.json() as CloudflareAPIResponse<CloudflareDNSRecord>;

      if (!data.success) {
        const errorMessage =
          data.errors?.map((e) => e.message).join(", ") || "Unknown error";
        logger.error("[CloudflareService] Failed to create DNS record", {
          errors: data.errors,
          record,
        });
        throw new ApiError(`Failed to create DNS record: ${errorMessage}`, 400);
      }

      return data.result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error("[CloudflareService] Error creating DNS record", { error, record });
      throw new ApiError("Failed to create DNS record", 500);
    }
  }

  /**
   * Check if a DNS record already exists
   */
  async recordExists(
    zoneId: string,
    name: string,
    type: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}&type=${type}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json() as CloudflareAPIResponse<CloudflareDNSRecord[]>;

      return (
        data.success === true &&
        data.result !== undefined &&
        data.result.length > 0
      );
    } catch (error) {
      logger.error("[CloudflareService] Error checking DNS record", { error, name, type });
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
