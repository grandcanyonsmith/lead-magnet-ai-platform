import { db } from '../utils/db';
import { validate, updateSettingsSchema } from '../utils/validation';
import { RouteResponse } from '../routes';

const USER_SETTINGS_TABLE = process.env.USER_SETTINGS_TABLE!;

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

    return {
      statusCode: 200,
      body: settings,
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

    return {
      statusCode: 200,
      body: existing,
    };
  }
}

export const settingsController = new SettingsController();

