/**
 * Branding settings form section
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import { Settings } from "@/types";
import { FormField } from "./FormField";
import { Card, CardContent } from "@/components/ui/Card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { CardHeaderIntro } from "@/components/ui/CardHeaderIntro";
import { SectionLabel } from "@/components/ui/SectionLabel";
import {
  PhotoIcon,
  SparklesIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

interface BrandingSettingsProps {
  settings: Settings;
  onChange: (field: keyof Settings, value: string) => void;
  errors?: Record<string, string>;
}

export function BrandingSettings({
  settings,
  onChange,
  errors,
}: BrandingSettingsProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageError(false);
  };

  return (
    <div className="space-y-6">
      {/* Visual Identity Section */}
      <Card>
        <CardHeaderIntro
          icon={<PhotoIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
          iconWrapperClassName="bg-purple-50 dark:bg-purple-900/20"
          title="Visual Identity"
          description="Customize how your brand appears on forms and lead magnets."
        />

        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <FormField
                label={
                  <>
                    Logo URL
                    <span
                      className="ml-2 text-xs text-gray-500 dark:text-muted-foreground"
                      title="Logo URL that will appear on all forms"
                    >
                      ℹ️
                    </span>
                  </>
                }
                name="logo_url"
                type="url"
                value={settings.logo_url || ""}
                onChange={(value) => onChange("logo_url", value)}
                error={errors?.logo_url}
                helpText="Direct URL to your logo image (PNG, JPG, SVG)"
                placeholder="https://example.com/logo.png"
              />

              {imageError && (
                <AlertBanner
                  variant="error"
                  icon={<span aria-hidden>⚠️</span>}
                  description="Failed to load image. Please check that the URL is correct and public."
                />
              )}
            </div>

            <div className="bg-gray-50 dark:bg-secondary/30 rounded-xl border border-gray-200 dark:border-border p-6 flex flex-col items-center justify-center min-h-[160px]">
              <SectionLabel className="mb-4">Logo Preview</SectionLabel>
              {settings.logo_url && !imageError ? (
                <div className="relative h-20 w-full max-w-[240px]">
                  <Image
                    src={settings.logo_url}
                    alt="Logo preview"
                    fill
                    className="object-contain"
                    onError={handleImageError}
                    onLoad={handleImageLoad}
                    unoptimized
                  />
                </div>
              ) : (
                <div className="text-center text-gray-400 dark:text-muted-foreground/70">
                  <PhotoIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <span className="text-sm">No logo set</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Voice & Context */}
      <Card>
        <CardHeaderIntro
          icon={<SparklesIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          iconWrapperClassName="bg-indigo-50 dark:bg-indigo-900/20"
          title="Brand Identity"
          description="Train the AI on your brand's voice, values, and target audience."
        />

        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Industry"
              name="industry"
              type="text"
              value={settings.industry || ""}
              onChange={(value) => onChange("industry", value)}
              error={errors?.industry}
              placeholder="e.g. SaaS, Healthcare, E-commerce"
            />

            <FormField
              label="Company Size"
              name="company_size"
              type="text"
              value={settings.company_size || ""}
              onChange={(value) => onChange("company_size", value)}
              error={errors?.company_size}
              placeholder="e.g. 1-10, 50-200, Enterprise"
            />
          </div>

          <div className="space-y-6">
            <FormField
              label="About Your Brand"
              name="brand_description"
              type="textarea"
              value={settings.brand_description || ""}
              onChange={(value) => onChange("brand_description", value)}
              error={errors?.brand_description}
              helpText="What does your company do? What makes it unique?"
              placeholder="We help small businesses..."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Tone of Voice"
                name="brand_voice"
                type="textarea"
                value={settings.brand_voice || ""}
                onChange={(value) => onChange("brand_voice", value)}
                error={errors?.brand_voice}
                helpText="Tone and style (e.g. professional, witty)"
                placeholder="Professional yet approachable..."
              />

              <FormField
                label="Ideal Customer"
                name="target_audience"
                type="textarea"
                value={settings.target_audience || ""}
                onChange={(value) => onChange("target_audience", value)}
                error={errors?.target_audience}
                helpText="Who are you writing for?"
                placeholder="Marketing managers at tech startups..."
              />
            </div>

            <FormField
              label="Key Messages & Rules"
              name="brand_messaging_guidelines"
              type="textarea"
              value={settings.brand_messaging_guidelines || ""}
              onChange={(value) =>
                onChange("brand_messaging_guidelines", value)
              }
              error={errors?.brand_messaging_guidelines}
              helpText="Key messages, dos and don'ts"
              placeholder="Always focus on benefits over features..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeaderIntro
          icon={<DocumentTextIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          iconWrapperClassName="bg-amber-50 dark:bg-amber-900/20"
          title="Resources"
          description="External documents to provide additional context."
        />

        <CardContent className="p-8">
          <FormField
            label="Reference Document (URL)"
            name="icp_document_url"
            type="url"
            value={settings.icp_document_url || ""}
            onChange={(value) => onChange("icp_document_url", value)}
            error={errors?.icp_document_url}
            helpText="Link to a public PDF or document describing your Ideal Customer Profile"
            placeholder="https://example.com/icp.pdf"
          />
        </CardContent>
      </Card>
    </div>
  );
}
