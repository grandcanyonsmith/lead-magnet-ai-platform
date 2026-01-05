/**
 * Cloudflare DNS integration component
 * Allows users to connect Cloudflare and automatically create DNS records
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import {
  useCloudflareStatus,
  useConnectCloudflare,
  useCreateDNSRecords,
  useDisconnectCloudflare,
} from "@/hooks/api/useCloudflare";
import { Settings } from "@/types";
import { FiCheck, FiX, FiLoader, FiExternalLink, FiShield } from "react-icons/fi";
import { toast } from "react-hot-toast";

interface CloudflareIntegrationProps {
  settings: Settings;
  cloudfrontDomain?: string;
}

export function CloudflareIntegration({
  settings,
  cloudfrontDomain,
}: CloudflareIntegrationProps) {
  const { status, loading: statusLoading, refetch } = useCloudflareStatus();
  const { connect, loading: connectLoading } = useConnectCloudflare();
  const { createRecords, loading: createLoading } = useCreateDNSRecords();
  const { disconnect, loading: disconnectLoading } = useDisconnectCloudflare();

  const [apiToken, setApiToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [creatingRecords, setCreatingRecords] = useState(false);

  const isConnected = status?.connected === true;
  const isLoading = statusLoading || connectLoading || disconnectLoading || createLoading;

  // Extract root domain from custom_domain
  const rootDomain = settings.custom_domain
    ? settings.custom_domain
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
        .split(".")
        .slice(-2)
        .join(".")
    : null;

  const handleConnect = async () => {
    if (!apiToken.trim()) {
      toast.error("Please enter your Cloudflare API token");
      return;
    }

    const success = await connect(apiToken);
    if (success) {
      setApiToken("");
      setShowTokenInput(false);
      await refetch();
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        "Are you sure you want to disconnect Cloudflare? This will not delete DNS records, but you won't be able to create new ones automatically."
      )
    ) {
      return;
    }

    const success = await disconnect();
    if (success) {
      await refetch();
    }
  };

  const handleCreateDNSRecords = async () => {
    if (!cloudfrontDomain) {
      toast.error("CloudFront domain not available. Please deploy infrastructure first.");
      return;
    }

    if (!rootDomain) {
      toast.error("Please set your custom domain first");
      return;
    }

    setCreatingRecords(true);

    try {
      // Extract subdomains from custom_domain if it's a full URL
      const customDomain = settings.custom_domain?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "";
      const formsSubdomain = customDomain.startsWith("forms.") ? "forms" : undefined;
      const assetsSubdomain = "assets"; // Always create assets subdomain

      const result = await createRecords({
        forms_subdomain: formsSubdomain,
        assets_subdomain: assetsSubdomain,
        cloudfront_domain: cloudfrontDomain,
      });

      if (result) {
        if (result.errors && result.errors.length > 0) {
          const errorMessages = result.errors.map((e) => `${e.name}: ${e.error}`).join(", ");
          toast.error(`Some records failed: ${errorMessages}`);
        } else {
          toast.success(
            `Successfully created ${result.records_created.length} DNS record(s)!`
          );
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create DNS records");
    } finally {
      setCreatingRecords(false);
    }
  };

  const openCloudflareTokenPage = () => {
    window.open(
      "https://dash.cloudflare.com/profile/api-tokens",
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader className="border-b border-gray-100 dark:border-border bg-blue-50/50 dark:bg-blue-900/20">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
            <FiShield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Cloudflare DNS Integration</CardTitle>
            <CardDescription className="mt-1">
              Automatically create DNS records in Cloudflare
            </CardDescription>
          </div>
          {isConnected && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <FiCheck className="w-4 h-4" />
              <span>Connected</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {!isConnected ? (
          <>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect your Cloudflare account to automatically create DNS records for your
                custom domain. Your API token is stored securely and encrypted.
              </p>

              {!showTokenInput ? (
                <Button
                  onClick={() => setShowTokenInput(true)}
                  className="w-full"
                  disabled={isLoading}
                >
                  <FiShield className="w-4 h-4 mr-2" />
                  Connect Cloudflare Account
                </Button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cloudflare API Token
                    </label>
                    <Input
                      type="password"
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                      placeholder="Enter your Cloudflare API token"
                      className="font-mono text-sm"
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Need a token?{" "}
                      <button
                        type="button"
                        onClick={openCloudflareTokenPage}
                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        Create one here
                        <FiExternalLink className="w-3 h-3" />
                      </button>
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Required permissions: Zone DNS Edit
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleConnect}
                      disabled={isLoading || !apiToken.trim()}
                      className="flex-1"
                    >
                      {connectLoading ? (
                        <>
                          <FiLoader className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <FiCheck className="w-4 h-4 mr-2" />
                          Connect
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowTokenInput(false);
                        setApiToken("");
                      }}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <FiCheck className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    Cloudflare Connected
                  </p>
                  {status?.connected_at && (
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Connected on {new Date(status.connected_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {rootDomain && cloudfrontDomain ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Create DNS Records
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    This will automatically create CNAME records in Cloudflare for:
                  </p>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-4 ml-4 list-disc">
                    <li>
                      <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                        forms.{rootDomain}
                      </code>{" "}
                      → {cloudfrontDomain}
                    </li>
                    <li>
                      <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                        assets.{rootDomain}
                      </code>{" "}
                      → {cloudfrontDomain}
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={handleCreateDNSRecords}
                  disabled={isLoading || creatingRecords}
                  className="w-full"
                >
                  {creatingRecords ? (
                    <>
                      <FiLoader className="w-4 h-4 mr-2 animate-spin" />
                      Creating DNS Records...
                    </>
                  ) : (
                    <>
                      <FiCheck className="w-4 h-4 mr-2" />
                      Create DNS Records Automatically
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {!rootDomain
                    ? "Please set your custom domain first to create DNS records."
                    : !cloudfrontDomain
                      ? "CloudFront domain not available. Please deploy infrastructure first."
                      : "Ready to create DNS records."}
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={isLoading}
                className="w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
              >
                <FiX className="w-4 h-4 mr-2" />
                Disconnect Cloudflare
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
