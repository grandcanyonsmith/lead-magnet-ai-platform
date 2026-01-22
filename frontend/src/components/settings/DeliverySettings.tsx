/**
 * Delivery settings form section
 */

"use client";

import { Settings } from "@/types";
import { FormField } from "./FormField";
import { FiCopy, FiRefreshCw, FiExternalLink } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useRegenerateWebhookToken } from "@/hooks/api/useSettings";
import { WebhookTester } from "./WebhookTester";
import { CloudflareIntegration } from "./CloudflareIntegration";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderIntro } from "@/components/ui/CardHeaderIntro";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { InlineCode } from "@/components/ui/InlineCode";
import { SectionLabel } from "@/components/ui/SectionLabel";
import {
  ServerStackIcon,
  GlobeAltIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import { useState, useEffect } from "react";

interface DeliverySettingsProps {
  settings: Settings;
  onChange: (field: keyof Settings, value: string) => void;
  onSettingsUpdate: (updatedSettings: Settings) => void;
  errors?: Record<string, string>;
}

export function DeliverySettings({
  settings,
  onChange,
  onSettingsUpdate,
  errors,
}: DeliverySettingsProps) {
  const { regenerateToken, loading: isRegenerating } =
    useRegenerateWebhookToken();
  const [currentHost, setCurrentHost] = useState("");
  const [cloudfrontDomain, setCloudfrontDomain] = useState<string | undefined>(
    (settings as any).cloudfront_domain
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentHost(window.location.host);
    }
    // Get CloudFront domain from settings if available
    if ((settings as any).cloudfront_domain) {
      setCloudfrontDomain((settings as any).cloudfront_domain);
    }
  }, [settings]);

  const handleCopyWebhookUrl = async () => {
    if (settings.webhook_url) {
      try {
        await navigator.clipboard.writeText(settings.webhook_url);
        toast.success("Webhook URL copied to clipboard!");
      } catch (error) {
        toast.error("Failed to copy to clipboard");
      }
    }
  };

  const handleCopyHost = async () => {
    if (currentHost) {
      try {
        await navigator.clipboard.writeText(currentHost);
        toast.success("Host copied to clipboard!");
      } catch (error) {
        toast.error("Failed to copy host");
      }
    }
  };

  const handleTestDomain = () => {
    if (!settings.custom_domain) return;
    const domain = settings.custom_domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    // Try https first, but fall back to http if needed isn't really possible with window.open
    // We'll just open the domain as entered or prefixed with https
    const url = /^https?:\/\//.test(settings.custom_domain) 
      ? settings.custom_domain 
      : `https://${domain}`;
    window.open(url, "_blank");
  };

  const handleRegenerateToken = async () => {
    if (
      !confirm(
        "Are you sure you want to regenerate your webhook token? The old URL will stop working.",
      )
    ) {
      return;
    }

    const updatedSettings = await regenerateToken();
    if (updatedSettings) {
      onSettingsUpdate(updatedSettings);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeaderIntro
          icon={
            <ServerStackIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
          }
          iconWrapperClassName="bg-green-50 dark:bg-green-900/20"
          title="Receive Leads via Webhook"
          description="Configure endpoints to receive form submissions and trigger automation."
        />

        <CardContent className="p-8 space-y-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground">
                Your Webhook URL
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={handleCopyWebhookUrl}
                  disabled={!settings.webhook_url}
                  className="text-xs h-8"
                >
                  <FiCopy className="w-3.5 h-3.5 mr-1.5" />
                  Copy URL
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={handleRegenerateToken}
                  disabled={isRegenerating || !settings.webhook_url}
                  className="text-xs h-8 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                >
                  <FiRefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 ${isRegenerating ? "animate-spin" : ""}`}
                  />
                  Regenerate
                </Button>
              </div>
            </div>

            <div className="relative">
              <Input
                type="text"
                value={settings.webhook_url || ""}
                readOnly
                className="font-mono text-gray-600 dark:text-foreground bg-gray-50 dark:bg-secondary"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-muted-foreground">
              POST requests to this URL with <InlineCode>workflow_id</InlineCode>{" "}
              and <InlineCode>form_data</InlineCode> will trigger workflow execution.
            </p>

            {settings.webhook_url && (
              <div className="mt-6 border border-gray-200 dark:border-border rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-secondary px-4 py-2 border-b border-gray-200 dark:border-border flex justify-between items-center">
                  <SectionLabel as="span">Example Usage</SectionLabel>
                </div>
                <div className="bg-gray-900 dark:bg-gray-950 p-4 overflow-x-auto">
                  <pre className="text-xs text-blue-300 dark:text-blue-400 font-mono">
                    {`curl -X POST "${settings.webhook_url}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workflow_id": "wf_xxxxx",
    "form_data": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+14155551234"
    }
  }'`}
                  </pre>
                </div>
              </div>
            )}

            {settings.webhook_url && (
              <div className="mt-6">
                <WebhookTester webhookUrl={settings.webhook_url} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeaderIntro
          icon={
            <GlobeAltIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          }
          iconWrapperClassName="bg-blue-50 dark:bg-blue-900/20"
          title="Integrations & Domain"
          description="Set up external integrations and domain settings."
        />

        <CardContent className="p-8 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <FormField
              label="CRM Integration (Webhook)"
              name="ghl_webhook_url"
              type="url"
              value={settings.ghl_webhook_url || ""}
              onChange={(value) => onChange("ghl_webhook_url", value)}
              error={errors?.ghl_webhook_url}
              helpText="Your CRM/GoHighLevel webhook endpoint for SMS/Email delivery"
              placeholder="https://api.crm.com/webhook/..."
            />

            <div className="border-t border-gray-100 dark:border-gray-800 pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <FormField
                    label="Custom Domain"
                    name="custom_domain"
                    type="text"
                    value={settings.custom_domain || ""}
                    onChange={(value) => onChange("custom_domain", value)}
                    error={errors?.custom_domain}
                    placeholder="forms.yourdomain.com"
                  />
                  
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 border border-gray-100 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Setup Instructions</h4>
                    <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-2.5">
                      <li>Log in to your DNS provider</li>
                      <li>Create a <strong>CNAME</strong> record</li>
                      <li>Set <strong>Name</strong> to your subdomain (e.g., <em>forms</em>)</li>
                      <li>
                        <div>Set <strong>Value</strong> to:</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <InlineCode className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs select-all break-all">
                            {currentHost || "loading..."}
                          </InlineCode>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleCopyHost} 
                            className="h-7 w-7 p-0 shrink-0"
                            title="Copy host"
                          >
                            <FiCopy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    </ol>
                    
                    {settings.custom_domain && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleTestDomain}
                          className="w-full text-xs"
                        >
                          <FiExternalLink className="mr-2 h-3.5 w-3.5" />
                          Test Configuration
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <FormField
                    label="Lead Phone Field"
                    name="lead_phone_field"
                    type="text"
                    value={settings.lead_phone_field || ""}
                    onChange={(value) => onChange("lead_phone_field", value)}
                    error={errors?.lead_phone_field}
                    helpText='Field name in your form (e.g., "phone")'
                    placeholder="phone"
                  />
                </div>
              </div>

              {/* Cloudflare Integration */}
              {settings.custom_domain && (
                <div className="pt-4">
                  <CloudflareIntegration
                    settings={settings}
                    cloudfrontDomain={cloudfrontDomain}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
