"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import {
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  DocumentTextIcon,
  BoltIcon,
  UserGroupIcon,
  DocumentCheckIcon,
} from "@heroicons/react/24/outline";
import { AnalyticsResponse, AnalyticsOverview } from "@/types/analytics";
import { logger } from "@/utils/logger";
import { handleError } from "@/utils/error-handling";

export default function DashboardPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await api.getAnalytics({ days: 30 });
      setAnalytics(data);
    } catch (error) {
      handleError(error, {
        showToast: false,
        logError: true,
      });
      logger.error("Failed to load analytics", {
        error,
        context: "DashboardPage",
      });
      // Don't redirect on API errors - just show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAndLoad = async () => {
      try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
          router.push("/auth/login");
          return;
        }

        setAuthChecked(true);
        await loadAnalytics();
      } catch (error) {
        logger.error("Auth check failed", { error, context: "DashboardPage" });
        router.push("/auth/login");
      }
    };

    checkAndLoad();
  }, [router, loadAnalytics]);

  // Move all hooks before any early returns
  const overview: AnalyticsOverview = useMemo(
    () =>
      analytics?.overview || {
        total_jobs: 0,
        completed_jobs: 0,
        failed_jobs: 0,
        pending_jobs: 0,
        success_rate: 0,
        avg_processing_time_seconds: 0,
        total_submissions: 0,
        total_workflows: 0,
        active_workflows: 0,
      },
    [analytics?.overview],
  );

  const stats = useMemo(
    () => [
      {
        label: "Leads Collected",
        value: overview.total_submissions || 0,
        icon: UserGroupIcon,
        color: "blue",
      },
      {
        label: "Reports Generated",
        value: overview.completed_jobs || 0,
        icon: DocumentCheckIcon,
        color: "green",
      },
      {
        label: "Active Magnets",
        value: overview.active_workflows || 0,
        icon: BoltIcon,
        color: "purple",
      },
    ],
    [overview],
  );

  const colorMap: Record<string, string> = useMemo(
    () => ({
      blue: "bg-blue-100 text-blue-600",
      green: "bg-green-100 text-green-600",
      purple: "bg-purple-100 text-purple-600",
    }),
    [],
  );

  if (loading) {
    return (
      <div>
        {/* Header skeleton */}
        <div className="mb-4 sm:mb-6">
          <div className="h-7 sm:h-8 lg:h-9 bg-gray-200 rounded w-48 mb-2 sm:mb-2 animate-pulse"></div>
          <div className="h-4 sm:h-5 bg-gray-200 rounded w-96 max-w-full animate-pulse"></div>
        </div>

        {/* Stats Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gray-200 rounded-lg sm:rounded-xl animate-pulse"></div>
              </div>
              <div className="h-8 sm:h-9 bg-gray-200 rounded w-20 mb-1 animate-pulse"></div>
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Quick Actions skeleton */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-32 mb-3 sm:mb-4 animate-pulse"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="h-11 sm:h-12 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Additional Information skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg sm:rounded-xl shadow-sm border border-blue-100 p-4 sm:p-6">
            <div className="h-5 sm:h-6 bg-gray-300 rounded w-48 mb-2 sm:mb-3 animate-pulse"></div>
            <div className="space-y-2 sm:space-y-3">
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-full animate-pulse"></div>
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-5/6 animate-pulse"></div>
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-4/6 animate-pulse"></div>
            </div>
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <div className="h-5 sm:h-6 bg-gray-200 rounded w-40 mb-3 sm:mb-4 animate-pulse"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <div className="h-5 sm:h-6 bg-gray-200 rounded w-36 mb-3 sm:mb-4 animate-pulse"></div>
            <div className="h-4 sm:h-5 bg-gray-200 rounded w-full animate-pulse"></div>
            <div className="h-4 sm:h-5 bg-gray-200 rounded w-3/4 mt-2 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
          Dashboard
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Create and manage AI-powered lead magnets that convert leads 10x
          better
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 sm:p-6 border border-gray-100 group"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div
                  className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${colorMap[stat.color]} group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-gray-600 font-medium leading-tight">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 sm:mb-8">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <a
            href="/dashboard/workflows/new"
            className="flex items-center justify-center px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm sm:text-base"
            aria-label="Create a new lead magnet workflow"
          >
            <BoltIcon
              className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
              aria-hidden="true"
            />
            Create Lead Magnet
          </a>
        </div>
      </div>

      {/* Additional Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg sm:rounded-xl shadow-sm border border-blue-100 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">
            What are Lead Magnets?
          </h2>
          <p className="text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3 leading-relaxed">
            Lead Magnets are personalized tools that generate custom content for your visitors.
            Instead of a generic PDF, you deliver a tailored report.
          </p>
          <p className="text-xs sm:text-sm text-gray-700 font-semibold">
            🚀 <strong>10x more effective</strong> at converting visitors into leads!
          </p>
        </div>

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
            Recent Activity
          </h2>
          <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
            View your collected leads and generated reports in the{" "}
            <a
              href="/dashboard/jobs"
              className="text-primary-600 hover:text-primary-700 font-medium"
              aria-label="View generated lead magnets"
            >
              Activity tab
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
