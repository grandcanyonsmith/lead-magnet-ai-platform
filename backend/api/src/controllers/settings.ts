import { db } from '../utils/db';
import { validate, updateSettingsSchema } from '../utils/validation';
import { RouteResponse } from '../routes';
import { generateWebhookToken } from '../utils/webhookToken';

const USER_SETTINGS_TABLE = process.env.USER_SETTINGS_TABLE!;
const API_URL = process.env.API_URL || process.env.API_GATEWAY_URL || '';

class SettingsController {
  async get(tenantId: string): Promise<RouteResponse> {
    let settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });

    // If settings don't exist, create default settings
    if (!settings) {
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
      await db.put(USER_SETTINGS_TABLE, settings);
    }

    // Auto-generate webhook_token if missing
    if (!settings.webhook_token) {
      const webhookToken = generateWebhookToken();
      settings = await db.update(USER_SETTINGS_TABLE, { tenant_id: tenantId }, {
        webhook_token: webhookToken,
        updated_at: new Date().toISOString(),
      });
    }

    // Construct webhook URL
    const webhookUrl = settings.webhook_token
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

  async update(tenantId: string, body: any): Promise<RouteResponse> {
    const data = validate(updateSettingsSchema, body);

    let existing = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });

    if (!existing) {
      // Create new settings
      existing = {
        tenant_id: tenantId,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await db.put(USER_SETTINGS_TABLE, existing);
    } else {
      // Update existing
      existing = await db.update(USER_SETTINGS_TABLE, { tenant_id: tenantId }, {
        ...data,
        updated_at: new Date().toISOString(),
      });
    }

    // Ensure webhook_token exists
    if (!existing.webhook_token) {
      const webhookToken = generateWebhookToken();
      existing = await db.update(USER_SETTINGS_TABLE, { tenant_id: tenantId }, {
        webhook_token: webhookToken,
        updated_at: new Date().toISOString(),
      });
    }

    // Construct webhook URL
    const webhookUrl = existing.webhook_token
      ? `${API_URL}/v1/webhooks/${existing.webhook_token}`
      : null;

    return {
      statusCode: 200,
      body: {
        ...existing,
        webhook_url: webhookUrl,
      },
    };
  }

  /**
   * Regenerate webhook token for a user
   */
  async regenerateWebhookToken(tenantId: string): Promise<RouteResponse> {
    const webhookToken = generateWebhookToken();
    
    const updated = await db.update(USER_SETTINGS_TABLE, { tenant_id: tenantId }, {
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
  async getWebhookUrl(tenantId: string): Promise<RouteResponse> {
    const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });

    if (!settings) {
      throw new Error('Settings not found');
    }

    // Auto-generate webhook_token if missing
    let webhookToken = settings.webhook_token;
    if (!webhookToken) {
      webhookToken = generateWebhookToken();
      await db.update(USER_SETTINGS_TABLE, { tenant_id: tenantId }, {
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

export const settingsController = new SettingsController();

