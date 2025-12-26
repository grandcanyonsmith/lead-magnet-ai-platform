/**
 * General settings form section
 */

"use client";

import { Settings } from "@/types";
import { FormField } from "./FormField";

interface GeneralSettingsProps {
  settings: Settings;
  onChange: (field: keyof Settings, value: string) => void;
  errors?: Record<string, string>;
}

const AI_MODEL_OPTIONS = [
  { value: "gpt-5.1-codex", label: "GPT-5.1 Codex" },
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-5.1", label: "GPT-5.1" },
  { value: "gpt-5.2", label: "GPT-5.2" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "computer-use-preview", label: "Computer Use Preview" },
  { value: "o4-mini-deep-research", label: "O4-Mini-Deep-Research" },
];

import { BuildingOfficeIcon } from "@heroicons/react/24/outline";

export function GeneralSettings({
  settings,
  onChange,
  errors,
}: GeneralSettingsProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <BuildingOfficeIcon className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            General Information
          </h3>
        </div>
        <p className="text-sm text-gray-600 ml-12">
          Configure your organization details and default AI model preferences.
        </p>
      </div>

      <div className="p-8 space-y-8">
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
            value={settings.default_ai_model || "gpt-5.1-codex"}
            onChange={(value) => onChange("default_ai_model", value)}
            options={AI_MODEL_OPTIONS}
            helpText="Default AI model used for generating lead magnets"
          />
        </div>
      </div>
    </div>
  );
}
