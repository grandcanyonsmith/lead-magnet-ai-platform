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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-600 p-8 text-white shadow-lg">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-lg text-indigo-100">
            Welcome back! Here is an overview of your lead generation performance.
          </p>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 blur-3xl transform skew-x-12 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-indigo-500/30 blur-2xl"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              <div className="absolute right-0 top-0 p-4 opacity-5 transition-transform duration-300 group-hover:scale-110 group-hover:opacity-10">
                <Icon className="h-24 w-24 text-current" />
              </div>
              
              <div className="relative z-10">
                <div className="mb-4 flex items-center justify-between">
                  <div
                    className={`rounded-xl p-3 ${colorMap[stat.color]} ring-1 ring-inset`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
                <p className="mb-1 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  {stat.value.toLocaleString()}
                </p>
                <p className="mb-1 text-sm font-medium text-gray-600">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 sm:gap-8">
        {/* Main Content Area - Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Activity
              </h2>
              <Link
                href="/dashboard/jobs"
                className="group flex items-center gap-1 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
              >
                View all
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            
            <div className="divide-y divide-gray-50">
              {recentJobs.length > 0 ? (
                recentJobs.map((job) => (
                  <div
                    key={job.job_id}
                    className="group transition-colors hover:bg-gray-50/50 p-4 sm:p-6"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 transition-colors group-hover:bg-white group-hover:shadow-sm">
                          <DocumentCheckIcon className="h-5 w-5 text-gray-500 group-hover:text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                             <p className="truncate text-sm font-medium text-gray-900">
                              Job #{job.job_id.slice(-6)}
                            </p>
                            <span className="text-xs text-gray-400">•</span>
                            <p className="text-xs text-gray-500">
                                {job.created_at
                                  ? format(new Date(job.created_at), "MMM d, h:mm a")
                                  : "Unknown date"}
                            </p>
                          </div>
                          {job.workflow_id && (
                             <p className="mt-0.5 truncate text-xs text-gray-500">
                               Workflow: {job.workflow_id}
                             </p>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <DocumentDuplicateIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="mb-2 font-medium text-gray-900">No activity yet</p>
                  <p className="mb-4 text-sm">Create your first lead magnet to get started.</p>
                  <Link
                    href="/dashboard/workflows/new"
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Create Lead Magnet
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Area - Quick Actions & Info */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Quick Actions
            </h2>
            <div className="space-y-3">
              <Link
                href="/dashboard/workflows/new"
                className="group flex w-full items-center rounded-lg border border-gray-200 p-3 transition-all hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700"
              >
                <div className="mr-3 rounded-lg bg-indigo-100 p-2 text-indigo-600 transition-colors group-hover:bg-indigo-200 group-hover:text-indigo-800">
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <span className="font-medium text-gray-700 group-hover:text-indigo-900">New Lead Magnet</span>
              </Link>
              
              <Link
                href="/dashboard/workflows"
                className="group flex w-full items-center rounded-lg border border-gray-200 p-3 transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="mr-3 rounded-lg bg-gray-100 p-2 text-gray-600 transition-colors group-hover:bg-gray-200 group-hover:text-gray-800">
                  <DocumentDuplicateIcon className="h-5 w-5" />
                </div>
                <span className="font-medium text-gray-700 group-hover:text-gray-900">View Templates</span>
              </Link>

              <Link
                href="/dashboard/settings"
                className="group flex w-full items-center rounded-lg border border-gray-200 p-3 transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="mr-3 rounded-lg bg-gray-100 p-2 text-gray-600 transition-colors group-hover:bg-gray-200 group-hover:text-gray-800">
                  <Cog6ToothIcon className="h-5 w-5" />
                </div>
                <span className="font-medium text-gray-700 group-hover:text-gray-900">Settings</span>
              </Link>
            </div>
          </div>

          {/* Info Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-lg transition-transform hover:scale-[1.02]">
            <div className="relative z-10">
              <h2 className="mb-2 text-lg font-semibold">
                Boost Your Conversions
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-indigo-100">
                Lead magnets with personalized reports convert up to 10x better than generic PDFs.
              </p>
              <Link
                href="https://docs.leadmagnet.ai"
                target="_blank"
                className="inline-flex items-center rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                Read the guide <ArrowRightIcon className="ml-1 h-4 w-4" />
              </Link>
            </div>
            
            {/* Background decoration */}
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white opacity-10 blur-2xl"></div>
            <div className="absolute -left-10 top-10 h-20 w-20 rounded-full bg-purple-400 opacity-20 blur-xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
