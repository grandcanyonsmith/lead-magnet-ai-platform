"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useSettings, useUpdateSettings } from "@/hooks/api/useSettings";
import type { Settings } from "@/types";
import type { SettingsUpdateRequest } from "@/types/settings";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

type SettingsSection = "general" | "branding" | "delivery" | "billing";

type SettingsEditorContextValue = {
  section: SettingsSection;
  setSection: (section: SettingsSection) => void;

  settings: Settings | null;
  currentSettings: Settings | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;

  errors: Record<string, string>;
  setField: (field: keyof Settings, value: string) => void;

  saving: boolean;
  save: () => Promise<boolean>;

  hasUnsavedChanges: boolean;
  discardChanges: () => void;

  applyServerSettingsUpdate: (updatedSettings: Settings) => void;
};

const SettingsEditorContext = createContext<SettingsEditorContextValue | null>(
  null,
);

function normalizeDomain(domain?: string): string {
  if (!domain) return "";
  const trimmed = domain.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.origin;
  } catch {
    return trimmed;
  }
}

function sanitizeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeDomain(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.origin;
  } catch {
    return undefined;
  }
}

function validateForm(formData: Partial<Settings>): Record<string, string> {
  const newErrors: Record<string, string> = {};

  if (
    formData.contact_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)
  ) {
    newErrors.contact_email = "Please enter a valid email address";
  }

  if (formData.website_url && !/^https?:\/\/.+/.test(formData.website_url)) {
    newErrors.website_url =
      "Please enter a valid URL (must start with http:// or https://)";
  }

  if (formData.logo_url && !/^https?:\/\/.+/.test(formData.logo_url)) {
    newErrors.logo_url =
      "Please enter a valid URL (must start with http:// or https://)";
  }

  if (formData.ghl_webhook_url && !/^https?:\/\/.+/.test(formData.ghl_webhook_url)) {
    newErrors.ghl_webhook_url =
      "Please enter a valid URL (must start with http:// or https://)";
  }

  if (formData.custom_domain) {
    const value = formData.custom_domain.trim();
    const hasProtocol = /^https?:\/\//i.test(value);
    const candidate = hasProtocol ? value : `https://${value}`;
    try {
      const parsed = new URL(candidate);
      if (!parsed.hostname) {
        newErrors.custom_domain = "Please enter a valid domain";
      }
    } catch {
      newErrors.custom_domain = "Please enter a valid domain";
    }
  }

  if (
    formData.icp_document_url &&
    !/^https?:\/\/.+/.test(formData.icp_document_url)
  ) {
    newErrors.icp_document_url =
      "Please enter a valid URL (must start with http:// or https://)";
  }

  return newErrors;
}

export function SettingsEditorProvider({
  initialSection,
  children,
}: {
  initialSection: SettingsSection;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [formData, setFormData] = useState<Partial<Settings>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const initializedRef = useRef(false);
  const lastSavedRef = useRef<Partial<Settings>>({});

  const { settings, loading, error, refetch } = useSettings();
  const { updateSettings, loading: saving } = useUpdateSettings();

  // Initialize form data when settings first load (only once)
  useEffect(() => {
    if (settings && !initializedRef.current) {
      const initialFormData: Partial<Settings> = {
        organization_name: settings.organization_name || "",
        contact_email: settings.contact_email || "",
        website_url: sanitizeUrl(settings.website_url) || "",
        default_ai_model: settings.default_ai_model || "gpt-5.2",
        default_tool_choice: settings.default_tool_choice || "required",
        logo_url: sanitizeUrl(settings.logo_url) || "",
        ghl_webhook_url: sanitizeUrl(settings.ghl_webhook_url) || "",
        custom_domain: settings.custom_domain || "",
        lead_phone_field: settings.lead_phone_field || "",
        // Brand information fields
        brand_description: settings.brand_description || "",
        brand_voice: settings.brand_voice || "",
        target_audience: settings.target_audience || "",
        company_values: settings.company_values || "",
        industry: settings.industry || "",
        company_size: settings.company_size || "",
        brand_messaging_guidelines: settings.brand_messaging_guidelines || "",
        icp_document_url: sanitizeUrl(settings.icp_document_url) || "",
        // Values that can be updated outside of this form (e.g. regenerate token)
        webhook_url: settings.webhook_url || "",
      };

      setFormData(initialFormData);
      lastSavedRef.current = initialFormData;
      initializedRef.current = true;
    } else if (
      settings &&
      initializedRef.current &&
      Object.keys(lastSavedRef.current).length === 0
    ) {
      lastSavedRef.current = {
        organization_name: settings.organization_name || "",
        contact_email: settings.contact_email || "",
        website_url: settings.website_url || "",
        default_ai_model: settings.default_ai_model || "gpt-5.2",
        default_tool_choice: settings.default_tool_choice || "required",
        logo_url: settings.logo_url || "",
        ghl_webhook_url: settings.ghl_webhook_url || "",
        custom_domain: settings.custom_domain || "",
        lead_phone_field: settings.lead_phone_field || "",
        brand_description: settings.brand_description || "",
        brand_voice: settings.brand_voice || "",
        target_audience: settings.target_audience || "",
        company_values: settings.company_values || "",
        industry: settings.industry || "",
        company_size: settings.company_size || "",
        brand_messaging_guidelines: settings.brand_messaging_guidelines || "",
        icp_document_url: settings.icp_document_url || "",
        webhook_url: settings.webhook_url || "",
      };
    }
  }, [settings]);

  const hasUnsavedChanges = useMemo(() => {
    if (!settings) return false;
    const compareTo =
      Object.keys(lastSavedRef.current).length > 0
        ? lastSavedRef.current
        : settings;

    const formDomain = normalizeDomain(formData.custom_domain);
    const compareDomain = normalizeDomain(compareTo.custom_domain);

    return (
      formData.organization_name !== (compareTo.organization_name || "") ||
      formData.contact_email !== (compareTo.contact_email || "") ||
      formData.website_url !== (compareTo.website_url || "") ||
      formData.default_ai_model !==
        (compareTo.default_ai_model || "gpt-5.1-codex") ||
      formData.default_tool_choice !==
        (compareTo.default_tool_choice || "required") ||
      formData.logo_url !== (compareTo.logo_url || "") ||
      formData.ghl_webhook_url !== (compareTo.ghl_webhook_url || "") ||
      formDomain !== compareDomain ||
      formData.lead_phone_field !== (compareTo.lead_phone_field || "") ||
      formData.brand_description !== (compareTo.brand_description || "") ||
      formData.brand_voice !== (compareTo.brand_voice || "") ||
      formData.target_audience !== (compareTo.target_audience || "") ||
      formData.company_values !== (compareTo.company_values || "") ||
      formData.industry !== (compareTo.industry || "") ||
      formData.company_size !== (compareTo.company_size || "") ||
      formData.brand_messaging_guidelines !==
        (compareTo.brand_messaging_guidelines || "") ||
      formData.icp_document_url !== (compareTo.icp_document_url || "")
    );
  }, [settings, formData]);

  const isBilling = useMemo(() => {
    if (section === "billing") return true;
    // Defensive: keep behavior correct if a page forgets to set the section
    return pathname?.includes("/dashboard/settings/billing") || false;
  }, [pathname, section]);

  // Warn about unsaved changes on browser unload/refresh (matches existing behavior)
  useUnsavedChanges({
    hasUnsavedChanges: hasUnsavedChanges && !isBilling,
    message: "You have unsaved changes. Are you sure you want to leave?",
  });

  const setField = useCallback(
    (field: keyof Settings, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors],
  );

  const discardChanges = useCallback(() => {
    if (!settings) return;
    const reset: Partial<Settings> =
      Object.keys(lastSavedRef.current).length > 0
        ? lastSavedRef.current
        : {
            organization_name: settings.organization_name || "",
            contact_email: settings.contact_email || "",
            website_url: sanitizeUrl(settings.website_url) || "",
            default_ai_model: settings.default_ai_model || "gpt-5.2",
          default_tool_choice: settings.default_tool_choice || "required",
            logo_url: sanitizeUrl(settings.logo_url) || "",
            ghl_webhook_url: sanitizeUrl(settings.ghl_webhook_url) || "",
            custom_domain: settings.custom_domain || "",
            lead_phone_field: settings.lead_phone_field || "",
            brand_description: settings.brand_description || "",
            brand_voice: settings.brand_voice || "",
            target_audience: settings.target_audience || "",
            company_values: settings.company_values || "",
            industry: settings.industry || "",
            company_size: settings.company_size || "",
            brand_messaging_guidelines: settings.brand_messaging_guidelines || "",
            icp_document_url: sanitizeUrl(settings.icp_document_url) || "",
            webhook_url: settings.webhook_url || "",
          };
    setFormData((prev) => ({ ...prev, ...reset }));
    setErrors({});
  }, [settings]);

  const applyServerSettingsUpdate = useCallback(
    (updatedSettings: Settings) => {
      // Keep the UI responsive for fields that can be mutated outside of the main save form.
      if (typeof updatedSettings.webhook_url === "string") {
        setFormData((prev) => ({ ...prev, webhook_url: updatedSettings.webhook_url }));
      }
      refetch();
    },
    [refetch],
  );

  const save = useCallback(async (): Promise<boolean> => {
    const validationErrors = validateForm(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return false;

    const payload: SettingsUpdateRequest = {
      organization_name: formData.organization_name?.trim() || undefined,
      contact_email: formData.contact_email?.trim() || undefined,
      website_url: sanitizeUrl(formData.website_url),
      default_ai_model: formData.default_ai_model,
      default_tool_choice: formData.default_tool_choice,
      logo_url: sanitizeUrl(formData.logo_url),
      ghl_webhook_url: sanitizeUrl(formData.ghl_webhook_url),
      custom_domain: sanitizeDomain(formData.custom_domain),
      lead_phone_field: formData.lead_phone_field?.trim() || undefined,
      brand_description: formData.brand_description?.trim() || undefined,
      brand_voice: formData.brand_voice?.trim() || undefined,
      target_audience: formData.target_audience?.trim() || undefined,
      company_values: formData.company_values?.trim() || undefined,
      industry: formData.industry?.trim() || undefined,
      company_size: formData.company_size?.trim() || undefined,
      brand_messaging_guidelines:
        formData.brand_messaging_guidelines?.trim() || undefined,
      icp_document_url: sanitizeUrl(formData.icp_document_url),
    };

    const updated = await updateSettings(payload);
    if (!updated) return false;

    const savedFormData: Partial<Settings> = {
      organization_name: payload.organization_name || "",
      contact_email: payload.contact_email || "",
      website_url: payload.website_url || "",
      default_ai_model: payload.default_ai_model || "gpt-5.1-codex",
      default_tool_choice: payload.default_tool_choice || "required",
      logo_url: payload.logo_url || "",
      ghl_webhook_url: payload.ghl_webhook_url || "",
      custom_domain: payload.custom_domain || "",
      lead_phone_field: payload.lead_phone_field || "",
      brand_description: payload.brand_description || "",
      brand_voice: payload.brand_voice || "",
      target_audience: payload.target_audience || "",
      company_values: payload.company_values || "",
      industry: payload.industry || "",
      company_size: payload.company_size || "",
      brand_messaging_guidelines: payload.brand_messaging_guidelines || "",
      icp_document_url: payload.icp_document_url || "",
    };

    setFormData((prev) => ({ ...prev, ...savedFormData }));
    lastSavedRef.current = { ...lastSavedRef.current, ...savedFormData };
    refetch();

    return true;
  }, [formData, updateSettings, refetch]);

  const currentSettings = useMemo<Settings | null>(() => {
    if (!settings) return null;
    return { ...settings, ...formData } as Settings;
  }, [settings, formData]);

  const value = useMemo<SettingsEditorContextValue>(
    () => ({
      section,
      setSection,
      settings,
      currentSettings,
      loading,
      error,
      refetch,
      errors,
      setField,
      saving,
      save,
      hasUnsavedChanges,
      discardChanges,
      applyServerSettingsUpdate,
    }),
    [
      section,
      settings,
      currentSettings,
      loading,
      error,
      refetch,
      errors,
      setField,
      saving,
      save,
      hasUnsavedChanges,
      discardChanges,
      applyServerSettingsUpdate,
    ],
  );

  return (
    <SettingsEditorContext.Provider value={value}>
      {children}
    </SettingsEditorContext.Provider>
  );
}

export function useSettingsEditor(): SettingsEditorContextValue {
  const ctx = useContext(SettingsEditorContext);
  if (!ctx) {
    throw new Error(
      "useSettingsEditor must be used within a SettingsEditorProvider",
    );
  }
  return ctx;
}


