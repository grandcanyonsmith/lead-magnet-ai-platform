/**
 * Billing and usage display section
 */

"use client";

import { useState, useEffect } from "react";
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  CreditCardIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { useUsage } from "@/hooks/api/useSettings";
import { DateRangePicker } from "./DateRangePicker";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ServiceUsage } from "@/types/usage";
import { UsageCharts } from "./UsageCharts";
import { ExportButton } from "./ExportButton";
import { BillingClient, SubscriptionInfo } from "@/lib/api/billing.client";
import { authService } from "@/lib/auth";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function BillingUsage() {
  const router = useRouter();
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    null,
  );
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null,
  );
  const [portalLoading, setPortalLoading] = useState(false);

  // Initialize date range to current month
  useEffect(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(firstDayOfMonth.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  }, []);

  // Load subscription info
  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const token = await authService.getIdToken();
        if (!token) return;

        const billingClient = new BillingClient({
          getToken: () => token,
        });

        const subInfo = await billingClient.getSubscription();
        setSubscription(subInfo);
      } catch (err: any) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to load subscription:", err);
        }
        setSubscriptionError(err.message || "Failed to load subscription");
      } finally {
        setSubscriptionLoading(false);
      }
    };

    loadSubscription();
  }, []);

  const { usage, loading, error, refetch } = useUsage(startDate, endDate);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const token = await authService.getIdToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const billingClient = new BillingClient({
        getToken: () => token,
      });

      const baseUrl = window.location.origin;
      const { portal_url } = await billingClient.createPortalSession(
        `${baseUrl}/dashboard/settings/billing`,
      );

      // Redirect to Stripe Customer Portal
      window.location.href = portal_url;
    } catch (err: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to create portal session:", err);
      }
      toast.error(
        err.message || "Failed to open billing portal. Please try again.",
      );
      setPortalLoading(false);
    }
  };

  const getSubscriptionStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300";
      case "past_due":
      case "unpaid":
        return "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300";
      case "trialing":
        return "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300";
      case "canceled":
      case "no_subscription":
        return "bg-gray-100 dark:bg-secondary text-gray-800 dark:text-muted-foreground";
      default:
        return "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300";
    }
  };

  const getSubscriptionStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "past_due":
        return "Past Due";
      case "unpaid":
        return "Unpaid";
      case "trialing":
        return "Trial";
      case "canceled":
        return "Canceled";
      case "no_subscription":
        return "No Subscription";
      default:
        return status;
    }
  };

  const formatServiceName = (serviceType: string): string => {
    return serviceType
      .replace(/openai_/g, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Subscription Section */}
      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-secondary/30 flex flex-row items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <CreditCardIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Billing & Subscription</CardTitle>
              <CardDescription>
                Manage your subscription plan and payment methods.
              </CardDescription>
            </div>
          </div>

          {subscription?.has_subscription && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              disabled={portalLoading}
              isLoading={portalLoading}
            >
              {!portalLoading && (
                <>
                  Manage Billing
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2 text-gray-400" />
                </>
              )}
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-6">
          {subscriptionLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-100 dark:bg-secondary rounded w-1/4"></div>
              <div className="h-20 bg-gray-50 dark:bg-secondary/50 rounded-lg"></div>
            </div>
          ) : subscriptionError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <ExclamationCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{subscriptionError}</p>
            </div>
          ) : subscription ? (
            <div className="bg-gradient-to-br from-gray-50 dark:from-secondary/30 to-white dark:to-card border border-gray-200 dark:border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getSubscriptionStatusColor(subscription.status)}`}
                    >
                      {getSubscriptionStatusLabel(subscription.status)}
                    </span>
                  </div>
                </div>
                {subscription.current_period_end && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1">
                      Renews
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-foreground">
                      {new Date(
                        subscription.current_period_end * 1000,
                      ).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </div>

              {!subscription.has_subscription && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <ExclamationCircleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-amber-900 dark:text-amber-300">
                        No active subscription
                      </h4>
                      <p className="text-sm text-amber-800 dark:text-amber-300/80 mt-1 mb-3">
                        Subscribe now to unlock full access to Lead Magnet AI
                        features.
                      </p>
                      <Button
                        onClick={() => router.push("/setup-billing")}
                        className="bg-amber-600 hover:bg-amber-700 text-white border-none"
                      >
                        Start Subscription
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {subscription.has_subscription && subscription.usage && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-gray-200 dark:border-border">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-muted-foreground mb-1">Period Usage</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-foreground">
                      {(typeof subscription.usage.total_tokens === "number"
                        ? subscription.usage.total_tokens
                        : 0
                      ).toLocaleString()}
                      <span className="text-sm font-normal text-gray-500 dark:text-muted-foreground ml-1">
                        tokens
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-muted-foreground mb-1">Reported Units</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-foreground">
                      {(typeof subscription.usage.units_1k === "number"
                        ? subscription.usage.units_1k
                        : 0
                      ).toLocaleString()}
                      <span className="text-sm font-normal text-gray-500 dark:text-muted-foreground ml-1">
                        × 1k
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-muted-foreground mb-1">Est. Cost</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-foreground">
                      $
                      {(typeof subscription.usage.total_upcharge_cost ===
                      "number"
                        ? subscription.usage.total_upcharge_cost
                        : 0
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Usage Analytics Section */}
      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-secondary/30 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <ChartBarIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Usage Analytics</CardTitle>
                <CardDescription>
                  Track API consumption and costs over time.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />
              {usage && (
                <ExportButton
                  usage={usage}
                  startDate={startDate}
                  endDate={endDate}
                />
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <LoadingState message="Loading usage data..." />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : usage ? (
            <div className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-5 border border-blue-100 dark:border-blue-800/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                      <CurrencyDollarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                      Total Upcharge
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                    ${(usage.openai?.total_upcharge || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Billable amount</p>
                </div>

                <div className="bg-green-50/50 dark:bg-green-900/10 rounded-xl p-5 border border-green-100 dark:border-green-800/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-md">
                      <CurrencyDollarIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-medium text-green-900 dark:text-green-300">
                      Actual Cost
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-300">
                    ${(usage.openai?.total_actual || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">Provider cost</p>
                </div>

                <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-xl p-5 border border-purple-100 dark:border-purple-800/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                      <ChartBarIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-sm font-medium text-purple-900 dark:text-purple-300">
                      Total Tokens
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                    {usage.summary?.total_tokens?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Input + Output</p>
                </div>

                <div className="bg-orange-50/50 dark:bg-orange-900/10 rounded-xl p-5 border border-orange-100 dark:border-orange-800/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-md">
                      <DocumentTextIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <span className="text-sm font-medium text-orange-900 dark:text-orange-300">
                      API Calls
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">
                    {usage.summary?.total_calls || 0}
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Requests made</p>
                </div>
              </div>

              {/* Usage Charts */}
              {usage.openai?.by_service &&
                Object.keys(usage.openai.by_service).length > 0 && (
                  <Card className="border-gray-200 shadow-none">
                    <CardHeader className="px-6 py-4">
                      <h4 className="text-base font-semibold text-gray-900">
                        Usage Breakdown
                      </h4>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-0">
                      <UsageCharts usage={usage} />
                    </CardContent>
                  </Card>
                )}

              {/* Detailed Table */}
              <div className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-border bg-gray-50/50 dark:bg-secondary/30">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-foreground">
                    Service Details
                  </h4>
                </div>

                {usage.openai?.by_service &&
                Object.keys(usage.openai.by_service).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-border">
                      <thead className="bg-gray-50 dark:bg-secondary/30">
                        <tr>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider"
                          >
                            Service
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider"
                          >
                            Calls
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider"
                          >
                            Input Tokens
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider"
                          >
                            Output Tokens
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider"
                          >
                            Actual Cost
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-right text-xs font-medium text-gray-900 dark:text-foreground uppercase tracking-wider"
                          >
                            Upcharge Cost
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
                        {Object.values(usage.openai.by_service).map(
                          (service: ServiceUsage) => (
                            <tr
                              key={service.service_type}
                              className="hover:bg-gray-50/50 dark:hover:bg-secondary/50 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-foreground">
                                {formatServiceName(service.service_type)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-muted-foreground text-right">
                                {service.calls.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-muted-foreground text-right">
                                {service.input_tokens.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-muted-foreground text-right">
                                {service.output_tokens.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-muted-foreground text-right font-mono">
                                ${service.actual_cost.toFixed(4)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-foreground text-right font-mono bg-gray-50/30 dark:bg-secondary/30">
                                ${service.upcharge_cost.toFixed(4)}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-muted-foreground">
                    <DocumentTextIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-muted-foreground/40 mb-3" />
                    <p className="text-lg font-medium text-gray-900 dark:text-foreground mb-1">
                      No usage data found
                    </p>
                    <p className="text-sm">
                      No API calls were recorded for the selected date range.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500 dark:text-muted-foreground bg-gray-50 dark:bg-secondary/30 rounded-xl border-2 border-dashed border-gray-200 dark:border-border">
              <ChartBarIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-muted-foreground/40 mb-3" />
              <p className="text-lg font-medium text-gray-900 dark:text-foreground">
                Select a date range
              </p>
              <p className="text-sm mt-1">
                Choose a start and end date above to view your usage statistics.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
