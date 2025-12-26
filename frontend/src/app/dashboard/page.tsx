"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { authService } from "@/lib/auth";
import {
  BoltIcon,
  UserGroupIcon,
  DocumentCheckIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  ArrowRightIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { AnalyticsResponse, AnalyticsOverview } from "@/types/analytics";
import { Job } from "@/types/job";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { logger } from "@/utils/logger";
import { handleError } from "@/utils/error-handling";

export default function DashboardPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const [analyticsData, jobsData] = await Promise.all([
        api.getAnalytics({ days: 30 }),
        api.jobs.getJobs({ limit: 5 }),
      ]);
      setAnalytics(analyticsData);
      setRecentJobs(jobsData.jobs);
    } catch (error) {
      handleError(error, {
        showToast: false,
        logError: true,
      });
      logger.error("Failed to load dashboard data", {
        error,
        context: "DashboardPage",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAndLoad = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        if (!authenticated) {
          router.push("/auth/login");
          return;
        }

        setAuthChecked(true);
        await loadDashboardData();
      } catch (error) {
        logger.error("Auth check failed", { error, context: "DashboardPage" });
        router.push("/auth/login");
      }
    };

    checkAndLoad();
  }, [router, loadDashboardData]);

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
        description: "Total submissions across all forms",
      },
      {
        label: "Reports Generated",
        value: overview.completed_jobs || 0,
        icon: DocumentCheckIcon,
        color: "green",
        description: "Successfully processed lead magnets",
      },
      {
        label: "Active Magnets",
        value: overview.active_workflows || 0,
        icon: BoltIcon,
        color: "purple",
        description: "Workflows currently accepting submissions",
      },
    ],
    [overview],
  );

  const colorMap: Record<string, string> = useMemo(
    () => ({
      blue: "bg-blue-100 text-blue-600 ring-blue-500/20",
      green: "bg-green-100 text-green-600 ring-green-500/20",
      purple: "bg-purple-100 text-purple-600 ring-purple-500/20",
    }),
    [],
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-4 bg-gray-200 rounded w-96 max-w-full"></div>
        </div>

        {/* Stats Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 h-32"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
              </div>
              <div className="space-y-2">
                <div className="h-8 bg-gray-200 rounded w-16"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-gray-200 rounded-xl"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Dashboard
        </h1>
        <p className="mt-2 text-base text-gray-600 max-w-3xl">
          Welcome back! Here's what's happening with your lead magnets today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-5 sm:p-6 border border-gray-100 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-300">
                <Icon className="w-24 h-24 text-current" />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`p-3 rounded-xl ${colorMap[stat.color]} ring-1`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1 tracking-tight">
                  {stat.value.toLocaleString()}
                </p>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {stat.label}
                </p>
                <p className="text-xs text-gray-400">
                  {stat.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Main Content Area - Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Activity
              </h2>
              <Link
                href="/dashboard/jobs"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 group"
              >
                View all
                <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            
            <div className="divide-y divide-gray-50">
              {recentJobs.length > 0 ? (
                recentJobs.map((job) => (
                  <div
                    key={job.job_id}
                    className="p-4 sm:p-6 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                          <DocumentCheckIcon className="w-5 h-5 text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            Job #{job.job_id.slice(-6)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {job.created_at
                              ? format(new Date(job.created_at), "MMM d, yyyy 'at' h:mm a")
                              : "Unknown date"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p>No recent activity found.</p>
                  <Link
                    href="/dashboard/workflows/new"
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium mt-2 inline-block"
                  >
                    Create your first lead magnet &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Area - Quick Actions & Info */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <div className="space-y-3">
              <Link
                href="/dashboard/workflows/new"
                className="flex items-center w-full p-3 rounded-lg border border-gray-200 hover:border-primary-200 hover:bg-primary-50/50 hover:text-primary-700 transition-all group"
              >
                <div className="p-2 bg-primary-100 text-primary-600 rounded-lg mr-3 group-hover:bg-primary-200 transition-colors">
                  <SparklesIcon className="w-5 h-5" />
                </div>
                <span className="font-medium text-gray-700 group-hover:text-primary-800">New Lead Magnet</span>
              </Link>
              
              <Link
                href="/dashboard/workflows"
                className="flex items-center w-full p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group"
              >
                <div className="p-2 bg-gray-100 text-gray-600 rounded-lg mr-3 group-hover:bg-gray-200 transition-colors">
                  <DocumentDuplicateIcon className="w-5 h-5" />
                </div>
                <span className="font-medium text-gray-700">View Templates</span>
              </Link>

              <Link
                href="/dashboard/settings"
                className="flex items-center w-full p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group"
              >
                <div className="p-2 bg-gray-100 text-gray-600 rounded-lg mr-3 group-hover:bg-gray-200 transition-colors">
                  <Cog6ToothIcon className="w-5 h-5" />
                </div>
                <span className="font-medium text-gray-700">Settings</span>
              </Link>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg text-white p-6 relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-lg font-semibold mb-2">
                Boost Your Conversions
              </h2>
              <p className="text-indigo-100 text-sm mb-4 leading-relaxed">
                Lead magnets with personalized reports convert up to 10x better than generic PDFs.
              </p>
              <Link
                href="https://docs.leadmagnet.ai"
                target="_blank"
                className="inline-flex items-center text-sm font-medium text-white hover:text-indigo-100 transition-colors"
              >
                Read the guide <ArrowRightIcon className="w-4 h-4 ml-1" />
              </Link>
            </div>
            
            {/* Background decoration */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="absolute top-10 -left-10 w-20 h-20 bg-purple-400 opacity-20 rounded-full blur-xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
