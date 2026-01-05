import { RouteResponse } from "../routes";
import { RequestContext } from "../routes/router";
import { CloudflareService } from "../services/cloudflareService";
import { db } from "../utils/db";
import { getCustomerId } from "../utils/rbac";
import { logger } from "../utils/logger";
import {
  ApiError,
  ValidationError,
  CloudflareZoneNotFoundError,
  CloudflareRecordExistsError,
  CloudflareRateLimitError,
} from "../utils/errors";
import { env } from "../utils/env";
import { validate } from "../utils/validation";
import { z } from "zod";

const USER_SETTINGS_TABLE = env.userSettingsTable;

// Validation schemas
const connectCloudflareSchema = z.object({
  api_token: z.string().min(1, "API token is required"),
});

const createDNSRecordsSchema = z.object({
  forms_subdomain: z.string().optional(),
  assets_subdomain: z.string().optional(),
  cloudfront_domain: z.string().min(1, "CloudFront domain is required"),
});

class CloudflareController {
  /**
   * Connect Cloudflare account (store API token)
   */
  async connect(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext
  ): Promise<RouteResponse> {
    if (!context?.auth) {
      throw new ApiError("Authentication required", 401);
    }

    const customerId = getCustomerId(context);
    const tenantId = customerId;

    try {
      const data = validate(connectCloudflareSchema, body);

      // Verify token is valid
      const cloudflare = new CloudflareService(data.api_token);
      const isValid = await cloudflare.verifyToken();

      if (!isValid) {
        throw new ValidationError("Invalid Cloudflare API token");
      }

      // Store token in user settings (encrypted at rest via DynamoDB encryption)
      // Note: In production, consider using AWS Secrets Manager for API tokens
      await db.update(
        USER_SETTINGS_TABLE,
        { tenant_id: tenantId },
        {
          cloudflare_api_token: data.api_token, // Stored encrypted by DynamoDB
          cloudflare_connected: true,
          cloudflare_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );

      logger.info("[CloudflareController] Cloudflare connected", { tenantId });

      return {
        statusCode: 200,
        body: {
          message: "Cloudflare account connected successfully",
          connected: true,
        },
      };
    } catch (error) {
      if (error instanceof ApiError || error instanceof ValidationError) {
        throw error;
      }
      logger.error("[CloudflareController] Error connecting Cloudflare", { error });
      throw new ApiError("Failed to connect Cloudflare account", 500);
    }
  }

  /**
   * Create DNS records automatically
   */
  async createDNSRecords(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext
  ): Promise<RouteResponse> {
    if (!context?.auth) {
      throw new ApiError("Authentication required", 401);
    }

    const customerId = getCustomerId(context);
    const tenantId = customerId;

    try {
      const data = validate(createDNSRecordsSchema, body);

      // Get stored Cloudflare API token
      const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
      
      if (!settings?.cloudflare_api_token) {
        throw new ApiError(
          "Cloudflare not connected. Please connect your Cloudflare account first.",
          400
        );
      }

      const cloudflare = new CloudflareService(settings.cloudflare_api_token);

      // Extract root domain from custom_domain setting
      const customDomain = settings.custom_domain;
      if (!customDomain) {
        throw new ApiError(
          "Custom domain not set. Please set your custom domain first.",
          400
        );
      }

      // Clean domain
      const cleanDomain = customDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");

      // Get zone ID and name
      const zoneInfo = await cloudflare.getZoneId(cleanDomain);
      if (!zoneInfo) {
        throw new CloudflareZoneNotFoundError(cleanDomain);
      }
      
      const { id: zoneId, name: rootDomain } = zoneInfo;

      const recordsCreated: Array<{ name: string; type: string; content: string }> = [];
      const errors: Array<{ name: string; error: string }> = [];

      // Create forms subdomain record (if provided)
      if (data.forms_subdomain) {
        const formsName = data.forms_subdomain.includes(".")
          ? data.forms_subdomain
          : `${data.forms_subdomain}.${rootDomain}`;
        
        try {
          const exists = await cloudflare.recordExists(zoneId, formsName, "CNAME");
          if (exists) {
            errors.push({
              name: formsName,
              error: "Record already exists. You can update it manually in Cloudflare or delete it first.",
            });
          } else {
            await cloudflare.createDNSRecord(zoneId, {
              type: "CNAME",
              name: formsName,
              content: data.cloudfront_domain,
              proxied: false, // DNS only (gray cloud)
            });
            recordsCreated.push({
              name: formsName,
              type: "CNAME",
              content: data.cloudfront_domain,
            });
          }
        } catch (error: any) {
          if (error instanceof CloudflareRecordExistsError) {
            errors.push({
              name: formsName,
              error: error.message,
            });
          } else if (error instanceof CloudflareRateLimitError) {
            errors.push({
              name: formsName,
              error: error.message,
            });
          } else {
            const errorMessage =
              error instanceof CloudflareZoneNotFoundError
                ? error.message
                : error.message || "Failed to create record";
            errors.push({
              name: formsName,
              error: errorMessage,
            });
          }
        }
      }

      // Create assets subdomain record (if provided)
      if (data.assets_subdomain) {
        const assetsName = data.assets_subdomain.includes(".")
          ? data.assets_subdomain
          : `${data.assets_subdomain}.${rootDomain}`;
        
        try {
          const exists = await cloudflare.recordExists(zoneId, assetsName, "CNAME");
          if (exists) {
            errors.push({
              name: assetsName,
              error: "Record already exists. You can update it manually in Cloudflare or delete it first.",
            });
          } else {
            await cloudflare.createDNSRecord(zoneId, {
              type: "CNAME",
              name: assetsName,
              content: data.cloudfront_domain,
              proxied: false, // DNS only (gray cloud)
            });
            recordsCreated.push({
              name: assetsName,
              type: "CNAME",
              content: data.cloudfront_domain,
            });
          }
        } catch (error: any) {
          if (error instanceof CloudflareRecordExistsError) {
            errors.push({
              name: assetsName,
              error: error.message,
            });
          } else if (error instanceof CloudflareRateLimitError) {
            errors.push({
              name: assetsName,
              error: error.message,
            });
          } else {
            const errorMessage =
              error instanceof CloudflareZoneNotFoundError
                ? error.message
                : error.message || "Failed to create record";
            errors.push({
              name: assetsName,
              error: errorMessage,
            });
          }
        }
      }

      logger.info("[CloudflareController] DNS records created", {
        tenantId,
        recordsCreated: recordsCreated.length,
        errors: errors.length,
      });

      return {
        statusCode: 200,
        body: {
          message: `Created ${recordsCreated.length} DNS record(s)`,
          records_created: recordsCreated,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      if (
        error instanceof ApiError ||
        error instanceof ValidationError ||
        error instanceof CloudflareZoneNotFoundError ||
        error instanceof CloudflareRateLimitError
      ) {
        throw error;
      }
      logger.error("[CloudflareController] Error creating DNS records", {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
      });
      throw new ApiError("Failed to create DNS records", 500);
    }
  }

  /**
   * Get Cloudflare connection status
   */
  async getStatus(
    _params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext
  ): Promise<RouteResponse> {
    if (!context?.auth) {
      throw new ApiError("Authentication required", 401);
    }

    const customerId = getCustomerId(context);
    const tenantId = customerId;

    const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });

    return {
      statusCode: 200,
      body: {
        connected: !!settings?.cloudflare_api_token,
        connected_at: settings?.cloudflare_connected_at || null,
      },
    };
  }

  /**
   * Disconnect Cloudflare account
   */
  async disconnect(
    _params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext
  ): Promise<RouteResponse> {
    if (!context?.auth) {
      throw new ApiError("Authentication required", 401);
    }

    const customerId = getCustomerId(context);
    const tenantId = customerId;

    await db.update(
      USER_SETTINGS_TABLE,
      { tenant_id: tenantId },
      {
        cloudflare_api_token: null,
        cloudflare_connected: false,
        cloudflare_connected_at: null,
        updated_at: new Date().toISOString(),
      }
    );

    logger.info("[CloudflareController] Cloudflare disconnected", { tenantId });

    return {
      statusCode: 200,
      body: {
        message: "Cloudflare account disconnected",
        connected: false,
      },
    };
  }
}

export const cloudflareController = new CloudflareController();
