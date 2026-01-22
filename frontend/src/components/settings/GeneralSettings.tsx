/**
 * General settings form section
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings } from "@/types";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_SERVICE_TIER,
  DEFAULT_TEXT_VERBOSITY,
  DEFAULT_TOOL_CHOICE,
  DEFAULT_WORKFLOW_IMPROVEMENT_REASONING_EFFORT,
  DEFAULT_WORKFLOW_IMPROVEMENT_SERVICE_TIER,
} from "@/constants/settingsDefaults";
import { FormField } from "./FormField";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderIntro } from "@/components/ui/CardHeaderIntro";
import { BuildingOfficeIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

import { AvatarUpload } from "./AvatarUpload";

interface GeneralSettingsProps {
  settings: Settings;
  onChange: (field: keyof Settings, value: string) => void;
  errors?: Record<string, string>;
}

const AI_MODEL_OPTIONS = [
  { value: "gpt-5.2", label: "GPT-5.2" },
];

const TOOL_CHOICE_OPTIONS = [
  { value: "required", label: "Required" },
  { value: "auto", label: "Auto" },
  { value: "none", label: "None" },
];

const SERVICE_TIER_OPTIONS = [
  { value: "auto", label: "Auto (AI decides)" },
  { value: "priority", label: "Priority (Fastest)" },
  { value: "default", label: "Default (Standard)" },
  { value: "flex", label: "Flex (Lower Cost)" },
  { value: "scale", label: "Scale (High Volume)" },
];

const OUTPUT_VERBOSITY_OPTIONS = [
  { value: "", label: "Default (Model decides)" },
  { value: "low", label: "Low - Concise" },
  { value: "medium", label: "Medium - Balanced" },
  { value: "high", label: "High - Detailed" },
];

const REVIEW_REASONING_OPTIONS = [
  { value: "high", label: "High (Default)" },
  { value: "xhigh", label: "Extra High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
];

interface TenantUserOption {
  user_id: string;
  email?: string;
  name?: string;
  role?: string;
}

export function GeneralSettings({
  settings,
  onChange,
  errors,
}: GeneralSettingsProps) {
  const { user } = useAuth();
  const [tenantUsers, setTenantUsers] = useState<TenantUserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      setUsersLoading(true);
      try {
        const response = await api.get<{ users?: TenantUserOption[] }>(
          "/admin/users/tenant",
          { params: { limit: 100 } },
        );
        if (isMounted) {
          setTenantUsers(response.users || []);
        }
      } catch (error) {
        if (isMounted) {
          setTenantUsers([]);
        }
      } finally {
        if (isMounted) {
          setUsersLoading(false);
        }
      }
    };

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const reviewerOptions = useMemo(() => {
    const currentLabelBase =
      user?.name && user?.email
        ? `${user.name} (${user.email})`
        : user?.name || user?.email;
    const currentLabel = currentLabelBase
      ? `Current user (${currentLabelBase})`
      : "Current user";
    const options = [
      { value: "", label: currentLabel },
      ...tenantUsers.map((tenantUser) => {
        const labelBase =
          tenantUser.name && tenantUser.email
            ? `${tenantUser.name} (${tenantUser.email})`
            : tenantUser.name || tenantUser.email || tenantUser.user_id;
        return {
          value: tenantUser.user_id,
          label: labelBase,
        };
      }),
    ];

    const seen = new Set<string>();
    return options.filter((option) => {
      if (!option.value) return true;
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  }, [tenantUsers, user]);

  return (
    <Card>
      <CardHeaderIntro
        icon={<BuildingOfficeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        iconWrapperClassName="bg-blue-50 dark:bg-blue-900/20"
        title="General Information"
        description="Configure your organization details and default AI preferences."
      />

      <CardContent className="space-y-8 pt-6">
        <div className="border-b border-gray-100 dark:border-border pb-8">
          <AvatarUpload />
        </div>

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
            value={settings.default_ai_model || DEFAULT_AI_MODEL}
            onChange={(value) => onChange("default_ai_model", value)}
            options={AI_MODEL_OPTIONS}
            helpText="Default AI model used for generating lead magnets"
          />

          <FormField
            label="Default Tool Usage"
            name="default_tool_choice"
            type="text"
            value={settings.default_tool_choice || DEFAULT_TOOL_CHOICE}
            onChange={(value) => onChange("default_tool_choice", value)}
            options={TOOL_CHOICE_OPTIONS}
            helpText="Default tool choice for new steps (you can override per-step)"
          />

          <FormField
            label="Default Service Tier"
            name="default_service_tier"
            type="text"
            value={settings.default_service_tier || DEFAULT_SERVICE_TIER}
            onChange={(value) => onChange("default_service_tier", value)}
            options={SERVICE_TIER_OPTIONS}
            helpText="Default service tier for new AI steps (override per-step if needed)"
          />

          <FormField
            label="Default Output Verbosity"
            name="default_text_verbosity"
            type="text"
            value={settings.default_text_verbosity || DEFAULT_TEXT_VERBOSITY}
            onChange={(value) => onChange("default_text_verbosity", value)}
            options={OUTPUT_VERBOSITY_OPTIONS}
            helpText="Default output verbosity for new AI steps (override per-step if needed)"
          />
        </div>

        <div className="space-y-3 border-t border-gray-100 dark:border-border pt-6">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Review & Improve Defaults
            </h4>
            <p className="text-xs text-muted-foreground">
              Applies to AI-generated workflow improvement suggestions.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Default Reviewer"
              name="default_workflow_improvement_user_id"
              type="text"
              value={
                settings.default_workflow_improvement_user_id &&
                settings.default_workflow_improvement_user_id !== "auto"
                  ? settings.default_workflow_improvement_user_id
                  : ""
              }
              onChange={(value) =>
                onChange("default_workflow_improvement_user_id", value)
              }
              options={reviewerOptions}
              helpText="Use the selected user as the reviewer for improvements"
              disabled={usersLoading}
            />
            <FormField
              label="Review Service Tier"
              name="default_workflow_improvement_service_tier"
              type="text"
            value={
              settings.default_workflow_improvement_service_tier ||
              DEFAULT_WORKFLOW_IMPROVEMENT_SERVICE_TIER
            }
              onChange={(value) =>
                onChange("default_workflow_improvement_service_tier", value)
              }
              options={SERVICE_TIER_OPTIONS}
              helpText="Service tier for generating improvement suggestions"
            />
            <FormField
              label="Review Reasoning"
              name="default_workflow_improvement_reasoning_effort"
              type="text"
              value={
              settings.default_workflow_improvement_reasoning_effort ||
              DEFAULT_WORKFLOW_IMPROVEMENT_REASONING_EFFORT
              }
              onChange={(value) =>
                onChange("default_workflow_improvement_reasoning_effort", value)
              }
              options={REVIEW_REASONING_OPTIONS}
              helpText="Reasoning depth for improvement suggestions"
            />
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
