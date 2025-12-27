/**
 * Branding settings form section
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import { Settings } from "@/types";
import { FormField } from "./FormField";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
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
        <CardHeader className="border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-purple-50 rounded-lg">
              <PhotoIcon className="w-5 h-5 text-purple-600" />
            </div>
            <CardTitle className="text-lg">
              Visual Identity
            </CardTitle>
          </div>
          <CardDescription className="ml-12">
            Customize how your brand appears on forms and lead magnets.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <FormField
                label={
                  <>
                    Logo URL
                    <span
                      className="ml-2 text-xs text-gray-500"
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
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">⚠️</span>
                  <p className="text-sm text-red-700">
                    Failed to load image. Please check that the URL is correct
                    and public.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center min-h-[160px]">
              <p className="text-xs font-medium text-gray-500 mb-4 uppercase tracking-wider">
                Logo Preview
              </p>
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
                <div className="text-center text-gray-400">
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
        <CardHeader className="border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <SparklesIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <CardTitle className="text-lg">
              Brand Identity
            </CardTitle>
          </div>
          <CardDescription className="ml-12">
            Train the AI on your brand&apos;s voice, values, and target
            audience.
          </CardDescription>
        </CardHeader>

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
        <CardHeader className="border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-amber-50 rounded-lg">
              <DocumentTextIcon className="w-5 h-5 text-amber-600" />
            </div>
            <CardTitle className="text-lg">Resources</CardTitle>
          </div>
          <CardDescription className="ml-12">
            External documents to provide additional context.
          </CardDescription>
        </CardHeader>

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
