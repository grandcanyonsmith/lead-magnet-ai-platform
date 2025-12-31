/**
 * General settings form section
 */

"use client";

import { Settings } from "@/types";
import { FormField } from "./FormField";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { BuildingOfficeIcon } from "@heroicons/react/24/outline";

interface GeneralSettingsProps {
  settings: Settings;
  onChange: (field: keyof Settings, value: string) => void;
  errors?: Record<string, string>;
}

const AI_MODEL_OPTIONS = [
  { value: "gpt-5.2", label: "GPT-5.2" },
];

export function GeneralSettings({
  settings,
  onChange,
  errors,
}: GeneralSettingsProps) {
  return (
    <Card>
      <CardHeader className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-secondary/30">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <BuildingOfficeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-lg">
            General Information
          </CardTitle>
        </div>
        <CardDescription className="ml-12">
          Configure your organization details and default AI model preferences.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Company Name"
            name="organization_name"
            type="text"
            value={settings.organization_name || ""}
            onChange={(value) => onChange("organization_name", value)}
            error={errors?.organization_name}
            dataTour="organization-name"
            placeholder="Acme Corp"
          />

          <FormField
            label="Support Email"
            name="contact_email"
            type="email"
            value={settings.contact_email || ""}
            onChange={(value) => onChange("contact_email", value)}
            error={errors?.contact_email}
            helpText="Email address for notifications and support"
            dataTour="contact-email"
            placeholder="contact@example.com"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Website URL"
            name="website_url"
            type="url"
            value={settings.website_url || ""}
            onChange={(value) => onChange("website_url", value)}
            error={errors?.website_url}
            helpText="Your organization's website URL"
            placeholder="https://example.com"
          />

          <FormField
            label="Preferred AI Brain"
            name="default_ai_model"
            type="text"
            value={settings.default_ai_model || "gpt-5.2"}
            onChange={(value) => onChange("default_ai_model", value)}
            options={AI_MODEL_OPTIONS}
            helpText="Default AI model used for generating lead magnets"
          />
        </div>
      </CardContent>
    </Card>
  );
}
