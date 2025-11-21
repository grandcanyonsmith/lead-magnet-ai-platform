"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsController = void 0;
const db_1 = require("../utils/db");
const validation_1 = require("../utils/validation");
const rbac_1 = require("../utils/rbac");
const webhookToken_1 = require("../utils/webhookToken");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const env_1 = require("../utils/env");
const USER_SETTINGS_TABLE = env_1.env.userSettingsTable;
const API_URL = env_1.env.apiUrl || env_1.env.apiGatewayUrl;
class SettingsController {
    async get(_params, _body, _query, _tenantId, context) {
        try {
            if (!USER_SETTINGS_TABLE) {
                throw new errors_1.InternalServerError('USER_SETTINGS_TABLE environment variable is not configured');
            }
            const customerId = (0, rbac_1.getCustomerId)(context);
            // Use customer_id as tenant_id for backward compatibility (settings table uses tenant_id as key)
            const tenantId = customerId;
            logger_1.logger.debug('[SettingsController.get] Fetching settings', {
                customerId,
                tenantId,
                hasContext: !!context,
                hasAuth: !!context?.auth,
            });
            let settings = await db_1.db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
            // If settings don't exist, create default settings
            if (!settings) {
                logger_1.logger.info('[SettingsController.get] Creating default settings', { tenantId });
                settings = {
                    tenant_id: tenantId,
                    organization_name: '',
                    contact_email: '',
                    default_ai_model: 'gpt-4o',
                    api_usage_limit: 1000000,
                    api_usage_current: 0,
                    billing_tier: 'free',
                    onboarding_survey_completed: false,
                    onboarding_survey_responses: {},
                    onboarding_checklist: {
                        complete_profile: false,
                        create_first_lead_magnet: false,
                        view_generated_lead_magnets: false,
                    },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                await db_1.db.put(USER_SETTINGS_TABLE, settings);
            }
            // Auto-generate webhook_token if missing
            if (!settings?.webhook_token) {
                logger_1.logger.info('[SettingsController.get] Generating webhook token', { tenantId });
                const webhookToken = (0, webhookToken_1.generateWebhookToken)();
                settings = await db_1.db.update(USER_SETTINGS_TABLE, { tenant_id: tenantId }, {
                    webhook_token: webhookToken,
                    updated_at: new Date().toISOString(),
                });
            }
            // Construct webhook URL
            const webhookUrl = settings?.webhook_token
                ? `${API_URL}/v1/webhooks/${settings.webhook_token}`
                : null;
            return {
                statusCode: 200,
                body: {
                    ...settings,
                    webhook_url: webhookUrl,
                },
            };
        }
        catch (error) {
            if (error instanceof errors_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[SettingsController.get] Unexpected error', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                hasContext: !!context,
                hasAuth: !!context?.auth,
            });
            throw new errors_1.InternalServerError('Failed to retrieve settings', {
                originalError: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async update(_params, body, _query, _tenantId, context) {
        try {
            if (!USER_SETTINGS_TABLE) {
                throw new errors_1.InternalServerError('USER_SETTINGS_TABLE environment variable is not configured');
            }
            // Validate context and authentication
            if (!context) {
                logger_1.logger.error('[SettingsController.update] Missing request context');
                throw new errors_1.ApiError('Request context is missing', 500, 'MISSING_CONTEXT');
            }
            if (!context.auth) {
                logger_1.logger.error('[SettingsController.update] Missing authentication context', {
                    hasContext: !!context,
                });
                throw new errors_1.ApiError('Authentication required. Please sign in to access this resource.', 401, 'AUTHENTICATION_REQUIRED', {
                    message: 'User authentication context is missing. This may indicate a problem with the superadmin account configuration.',
                });
            }
            const customerId = (0, rbac_1.getCustomerId)(context);
            // Use customer_id as tenant_id for backward compatibility (settings table uses tenant_id as key)
            const tenantId = customerId;
            logger_1.logger.debug('[SettingsController.update] Updating settings', {
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
                data = (0, validation_1.validate)(validation_1.updateSettingsSchema, body);
            }
            catch (validationError) {
                logger_1.logger.warn('[SettingsController.update] Validation error', {
                    error: validationError instanceof Error ? validationError.message : String(validationError),
                    body,
                });
                throw new errors_1.ValidationError(validationError instanceof Error ? validationError.message : 'Invalid settings data', { body, validationError: validationError instanceof Error ? validationError.message : String(validationError) });
            }
            // Get existing settings
            let existing;
            try {
                existing = await db_1.db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
            }
            catch (dbError) {
                logger_1.logger.error('[SettingsController.update] Database error fetching settings', {
                    error: dbError instanceof Error ? dbError.message : String(dbError),
                    tenantId,
                    table: USER_SETTINGS_TABLE,
                });
                throw new errors_1.InternalServerError('Failed to fetch existing settings', {
                    originalError: dbError instanceof Error ? dbError.message : String(dbError),
                    tenantId,
                });
            }
            // Create or update settings
            try {
                if (!existing) {
                    // Create new settings
                    logger_1.logger.info('[SettingsController.update] Creating new settings', { tenantId });
                    existing = {
                        tenant_id: tenantId,
                        ...data,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };
                    await db_1.db.put(USER_SETTINGS_TABLE, existing);
                }
                else {
                    // Update existing
                    logger_1.logger.info('[SettingsController.update] Updating existing settings', { tenantId });
                    existing = await db_1.db.update(USER_SETTINGS_TABLE, { tenant_id: tenantId }, {
                        ...data,
                        updated_at: new Date().toISOString(),
                    });
                }
            }
            catch (dbError) {
                logger_1.logger.error('[SettingsController.update] Database error saving settings', {
                    error: dbError instanceof Error ? dbError.message : String(dbError),
                    tenantId,
                    table: USER_SETTINGS_TABLE,
                    isNew: !existing,
                });
                throw new errors_1.InternalServerError('Failed to save settings', {
                    originalError: dbError instanceof Error ? dbError.message : String(dbError),
                    tenantId,
                });
            }
            // Ensure webhook_token exists
            if (!existing?.webhook_token) {
                try {
                    logger_1.logger.info('[SettingsController.update] Generating webhook token', { tenantId });
                    const webhookToken = (0, webhookToken_1.generateWebhookToken)();
                    existing = await db_1.db.update(USER_SETTINGS_TABLE, { tenant_id: tenantId }, {
                        webhook_token: webhookToken,
                        updated_at: new Date().toISOString(),
                    });
                }
                catch (dbError) {
                    logger_1.logger.error('[SettingsController.update] Database error updating webhook token', {
                        error: dbError instanceof Error ? dbError.message : String(dbError),
                        tenantId,
                    });
                    // Don't fail the request if webhook token generation fails, just log it
                }
            }
            // Construct webhook URL
            const webhookUrl = existing?.webhook_token
                ? `${API_URL}/v1/webhooks/${existing.webhook_token}`
                : null;
            logger_1.logger.info('[SettingsController.update] Settings updated successfully', {
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
        }
        catch (error) {
            // Re-throw ApiError instances as-is
            if (error instanceof errors_1.ApiError) {
                throw error;
            }
            // Log and wrap unexpected errors
            logger_1.logger.error('[SettingsController.update] Unexpected error', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                hasContext: !!context,
                hasAuth: !!context?.auth,
                customerId: context?.auth?.customerId,
                role: context?.auth?.role,
            });
            throw new errors_1.InternalServerError('An error occurred while updating settings', {
                originalError: error instanceof Error ? error.message : String(error),
                customerId: context?.auth?.customerId,
                role: context?.auth?.role,
            });
        }
    }
    /**
     * Regenerate webhook token for a user
     */
    async regenerateWebhookToken(_params, _body, _query, _tenantId, context) {
        const customerId = (0, rbac_1.getCustomerId)(context);
        // Use customer_id as tenant_id for backward compatibility (settings table uses tenant_id as key)
        const tenantId = customerId;
        const webhookToken = (0, webhookToken_1.generateWebhookToken)();
        const updated = await db_1.db.update(USER_SETTINGS_TABLE, { tenant_id: tenantId }, {
            webhook_token: webhookToken,
            updated_at: new Date().toISOString(),
        });
        const webhookUrl = `${API_URL}/v1/webhooks/${webhookToken}`;
        return {
            statusCode: 200,
            body: {
                ...updated,
                webhook_url: webhookUrl,
                message: 'Webhook token regenerated successfully',
            },
        };
    }
    /**
     * Get webhook URL for a user
     */
    async getWebhookUrl(_params, _body, _query, _tenantId, context) {
        const customerId = (0, rbac_1.getCustomerId)(context);
        // Use customer_id as tenant_id for backward compatibility (settings table uses tenant_id as key)
        const tenantId = customerId;
        const settings = await db_1.db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
        if (!settings) {
            throw new Error('Settings not found');
        }
        // Auto-generate webhook_token if missing
        let webhookToken = settings.webhook_token;
        if (!webhookToken) {
            webhookToken = (0, webhookToken_1.generateWebhookToken)();
            await db_1.db.update(USER_SETTINGS_TABLE, { tenant_id: tenantId }, {
                webhook_token: webhookToken,
                updated_at: new Date().toISOString(),
            });
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
exports.settingsController = new SettingsController();
//# sourceMappingURL=settings.js.map