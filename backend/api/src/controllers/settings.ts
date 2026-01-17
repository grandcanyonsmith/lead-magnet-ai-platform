import { db } from "../utils/db";
import { validate, updateSettingsSchema } from "../utils/validation";
import { RouteResponse } from "../routes";
import { RequestContext } from "../routes/router";
import { getCustomerId } from "../utils/rbac";
import { generateWebhookToken } from "../utils/webhookToken";
import { logger } from "../utils/logger";
import {
  ApiError,
  InternalServerError,
  ValidationError,
} from "../utils/errors";
import { env } from "../utils/env";

const USER_SETTINGS_TABLE = env.userSettingsTable;
const API_URL = env.apiUrl || env.apiGatewayUrl;

class SettingsController {
  private normalizeOrigin(value: unknown): string {
    const raw = (value == null ? "" : String(value)).trim();
    return raw.replace(/\/+$/g, "");
  }

  private async assertCustomDomainAvailable(
    tenantId: string,
    desiredOrigin: string,
    currentOrigin?: string,
  ): Promise<void> {
    const desired = this.normalizeOrigin(desiredOrigin);
    const current = this.normalizeOrigin(currentOrigin);
    if (!desired || desired === current) return;

    try {
      // No GSI exists on custom_domain yet, so we scan (acceptable for low volume).
      // If/when this scales, add a GSI on custom_domain or a separate mapping table.
      const items = await db.scan(USER_SETTINGS_TABLE);
      const conflict = items.find((item: any) => {
        const itemDomain = this.normalizeOrigin(item?.custom_domain);
        return itemDomain && itemDomain === desired && item?.tenant_id !== tenantId;
      });

      if (conflict) {
        throw new ValidationError(
          "This custom domain is already connected to another account.",
          { custom_domain: desired },
        );
      }
    } catch (error) {
      // If the error is a ValidationError, rethrow as-is.
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error(
        "[SettingsController] Failed to verify custom domain uniqueness",
        {
          error: error instanceof Error ? error.message : String(error),
          tenantId,
          desiredOrigin,
        },
      );
      throw new InternalServerError(
        "Unable to verify custom domain availability. Please try again.",
      );
    }
  }

  async get(
    _params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    try {
      if (!USER_SETTINGS_TABLE) {
        throw new InternalServerError(
          "USER_SETTINGS_TABLE environment variable is not configured",
        );
      }

      const customerId = getCustomerId(context);
      // Use customer_id as tenant_id for backward compatibility (settings table uses tenant_id as key)
      const tenantId = customerId;

      logger.debug("[SettingsController.get] Fetching settings", {
        customerId,
        tenantId,
        hasContext: !!context,
        hasAuth: !!context?.auth,
      });

      let settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });

      const now = new Date().toISOString();
      const defaultSettings = {
        organization_name: "",
        contact_email: "",
        default_ai_model: "gpt-5.2",
        default_tool_choice: "required",
        default_service_tier: "auto",
        default_text_verbosity: "",
        default_workflow_improvement_user_id: "",
        default_workflow_improvement_service_tier: "priority",
        default_workflow_improvement_reasoning_effort: "high",
        api_usage_limit: 1000000,
        api_usage_current: 0,
        billing_tier: "free",
        onboarding_survey_completed: false,
        onboarding_survey_responses: {},
        onboarding_checklist: {
          complete_profile: false,
          create_first_lead_magnet: false,
          view_generated_lead_magnets: false,
        },
        folders: [] as any[],
      };

      // If settings don't exist, create default settings
      if (!settings) {
        logger.info("[SettingsController.get] Creating default settings", {
          tenantId,
        });
        settings = {
          tenant_id: tenantId,
          ...defaultSettings,
          created_at: now,
          updated_at: now,
        };
        await db.put(USER_SETTINGS_TABLE, settings);
      } else {
        // Backfill any missing settings fields to prevent partial/incomplete records
        const merged = {
          ...defaultSettings,
          ...settings,
          onboarding_survey_responses:
            settings.onboarding_survey_responses &&
            typeof settings.onboarding_survey_responses === "object"
              ? settings.onboarding_survey_responses
              : {},
          onboarding_checklist: {
            ...defaultSettings.onboarding_checklist,
            ...(settings.onboarding_checklist &&
            typeof settings.onboarding_checklist === "object"
              ? settings.onboarding_checklist
              : {}),
          },
          folders: Array.isArray(settings.folders) ? settings.folders : [],
        };

        const updates: Record<string, any> = {};

        // Top-level defaults
        for (const key of Object.keys(defaultSettings)) {
          if ((settings as any)[key] === undefined) {
            updates[key] = (merged as any)[key];
          }
        }

        // Nested fixes even when key exists but is malformed
        if (
          !settings.onboarding_checklist ||
          typeof settings.onboarding_checklist !== "object"
        ) {
          updates.onboarding_checklist = merged.onboarding_checklist;
        } else {
          const existingChecklist = settings.onboarding_checklist || {};
          const hasAllChecklistKeys = Object.keys(
            defaultSettings.onboarding_checklist,
          ).every((k) => (existingChecklist as any)[k] !== undefined);
          if (!hasAllChecklistKeys) {
            updates.onboarding_checklist = merged.onboarding_checklist;
          }
        }

        if (
          !settings.onboarding_survey_responses ||
          typeof settings.onboarding_survey_responses !== "object"
        ) {
          updates.onboarding_survey_responses =
            merged.onboarding_survey_responses;
        }

        if (!Array.isArray(settings.folders)) {
          updates.folders = merged.folders;
        }

        if (!settings.created_at) {
          updates.created_at = now;
        }

        if (Object.keys(updates).length > 0) {
          settings = await db.update(
            USER_SETTINGS_TABLE,
            { tenant_id: tenantId },
            {
              ...updates,
              updated_at: now,
            },
          );
        } else {
          settings = merged;
        }
      }

      // Auto-generate webhook_token if missing
      if (!settings?.webhook_token) {
        logger.info("[SettingsController.get] Generating webhook token", {
          tenantId,
        });
        const webhookToken = generateWebhookToken();
        settings = await db.update(
          USER_SETTINGS_TABLE,
          { tenant_id: tenantId },
          {
            webhook_token: webhookToken,
            updated_at: now,
          },
        );
      }

      // Construct webhook URL
      const webhookUrl = settings?.webhook_token
        ? `${API_URL}/v1/webhooks/${settings.webhook_token}`
        : null;

      // Include CloudFront domain if available (for DNS setup)
      const cloudfrontDomain = env.cloudfrontDomain || '';

      return {
        statusCode: 200,
        body: {
          ...settings,
          webhook_url: webhookUrl,
          cloudfront_domain: cloudfrontDomain || undefined,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error("[SettingsController.get] Unexpected error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        hasContext: !!context,
        hasAuth: !!context?.auth,
      });
      throw new InternalServerError("Failed to retrieve settings", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async update(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    try {
      if (!USER_SETTINGS_TABLE) {
        throw new InternalServerError(
          "USER_SETTINGS_TABLE environment variable is not configured",
        );
      }

      // Validate context and authentication
      if (!context) {
        logger.error("[SettingsController.update] Missing request context");
        throw new ApiError(
          "Request context is missing",
          500,
          "MISSING_CONTEXT",
        );
      }

      if (!context.auth) {
        logger.error(
          "[SettingsController.update] Missing authentication context",
          {
            hasContext: !!context,
          },
        );
        throw new ApiError(
          "Authentication required. Please sign in to access this resource.",
          401,
          "AUTHENTICATION_REQUIRED",
          {
            message:
              "User authentication context is missing. This may indicate a problem with the superadmin account configuration.",
          },
        );
      }

      const customerId = getCustomerId(context);
      // Use customer_id as tenant_id for backward compatibility (settings table uses tenant_id as key)
      const tenantId = customerId;

      logger.debug("[SettingsController.update] Updating settings", {
        customerId,
        tenantId,
        role: context.auth.role,
        isImpersonating: context.auth.isImpersonating,
        hasBody: !!body,
        bodyKeys: body ? Object.keys(body) : [],
      });

      // Validate request body
      let data;
      try {
        data = validate(updateSettingsSchema, body);
      } catch (validationError) {
        logger.warn("[SettingsController.update] Validation error", {
          error:
            validationError instanceof Error
              ? validationError.message
              : String(validationError),
          body,
        });
        throw new ValidationError(
          validationError instanceof Error
            ? validationError.message
            : "Invalid settings data",
          {
            body,
            validationError:
              validationError instanceof Error
                ? validationError.message
                : String(validationError),
          },
        );
      }

      // Get existing settings
      let existing;
      try {
        existing = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
      } catch (dbError) {
        logger.error(
          "[SettingsController.update] Database error fetching settings",
          {
            error: dbError instanceof Error ? dbError.message : String(dbError),
            tenantId,
            table: USER_SETTINGS_TABLE,
          },
        );
        throw new InternalServerError("Failed to fetch existing settings", {
          originalError:
            dbError instanceof Error ? dbError.message : String(dbError),
          tenantId,
        });
      }

      // Enforce uniqueness of custom_domain across tenants (per-account domain mapping).
      if (data?.custom_domain && typeof data.custom_domain === 'string') {
        await this.assertCustomDomainAvailable(
          tenantId,
          data.custom_domain,
          existing?.custom_domain,
        );
      }

      // Create or update settings
      try {
        if (!existing) {
          // Create new settings
          logger.info("[SettingsController.update] Creating new settings", {
            tenantId,
          });
          existing = {
            tenant_id: tenantId,
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await db.put(USER_SETTINGS_TABLE, existing);
        } else {
          // Update existing
          logger.info(
            "[SettingsController.update] Updating existing settings",
            { tenantId },
          );
          existing = await db.update(
            USER_SETTINGS_TABLE,
            { tenant_id: tenantId },
            {
              ...data,
              updated_at: new Date().toISOString(),
            },
          );
        }
      } catch (dbError) {
        logger.error(
          "[SettingsController.update] Database error saving settings",
          {
            error: dbError instanceof Error ? dbError.message : String(dbError),
            tenantId,
            table: USER_SETTINGS_TABLE,
            isNew: !existing,
          },
        );
        throw new InternalServerError("Failed to save settings", {
          originalError:
            dbError instanceof Error ? dbError.message : String(dbError),
          tenantId,
        });
      }

      // Ensure webhook_token exists
      if (!existing?.webhook_token) {
        try {
          logger.info("[SettingsController.update] Generating webhook token", {
            tenantId,
          });
          const webhookToken = generateWebhookToken();
          existing = await db.update(
            USER_SETTINGS_TABLE,
            { tenant_id: tenantId },
            {
              webhook_token: webhookToken,
              updated_at: new Date().toISOString(),
            },
          );
        } catch (dbError) {
          logger.error(
            "[SettingsController.update] Database error updating webhook token",
            {
              error:
                dbError instanceof Error ? dbError.message : String(dbError),
              tenantId,
            },
          );
          // Don't fail the request if webhook token generation fails, just log it
        }
      }

      // Construct webhook URL
      const webhookUrl = existing?.webhook_token
        ? `${API_URL}/v1/webhooks/${existing.webhook_token}`
        : null;

      logger.info("[SettingsController.update] Settings updated successfully", {
        tenantId,
        updatedFields: Object.keys(data),
      });

      return {
        statusCode: 200,
        body: {
          ...existing,
          webhook_url: webhookUrl,
        },
      };
    } catch (error) {
      // Re-throw ApiError instances as-is
      if (error instanceof ApiError) {
        throw error;
      }

      // Log and wrap unexpected errors
      logger.error("[SettingsController.update] Unexpected error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        hasContext: !!context,
        hasAuth: !!context?.auth,
        customerId: context?.auth?.customerId,
        role: context?.auth?.role,
      });

      throw new InternalServerError(
        "An error occurred while updating settings",
        {
          originalError: error instanceof Error ? error.message : String(error),
          customerId: context?.auth?.customerId,
          role: context?.auth?.role,
        },
      );
    }
  }

  /**
   * Regenerate webhook token for a user
   */
  async regenerateWebhookToken(
    _params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const customerId = getCustomerId(context);
    // Use customer_id as tenant_id for backward compatibility (settings table uses tenant_id as key)
    const tenantId = customerId;

    const webhookToken = generateWebhookToken();

    const updated = await db.update(
      USER_SETTINGS_TABLE,
      { tenant_id: tenantId },
      {
        webhook_token: webhookToken,
        updated_at: new Date().toISOString(),
      },
    );

    const webhookUrl = `${API_URL}/v1/webhooks/${webhookToken}`;

    return {
      statusCode: 200,
      body: {
        ...updated,
        webhook_url: webhookUrl,
        message: "Webhook token regenerated successfully",
      },
    };
  }

  /**
   * Get webhook URL for a user
   */
  async getWebhookUrl(
    _params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const customerId = getCustomerId(context);
    // Use customer_id as tenant_id for backward compatibility (settings table uses tenant_id as key)
    const tenantId = customerId;

    const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });

    if (!settings) {
      throw new Error("Settings not found");
    }

    // Auto-generate webhook_token if missing
    let webhookToken = settings.webhook_token;
    if (!webhookToken) {
      webhookToken = generateWebhookToken();
      await db.update(
        USER_SETTINGS_TABLE,
        { tenant_id: tenantId },
        {
          webhook_token: webhookToken,
          updated_at: new Date().toISOString(),
        },
      );
    }

    const webhookUrl = `${API_URL}/v1/webhooks/${webhookToken}`;

    return {
      statusCode: 200,
      body: {
        webhook_url: webhookUrl,
        webhook_token: webhookToken,
      },
    };
  }
}

export const settingsController = new SettingsController();
