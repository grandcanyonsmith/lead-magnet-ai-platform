"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useJobs } from "@/hooks/api/useJobs";
import { useAnalytics } from "@/hooks/api/useAnalytics";
import {
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  ArrowRightIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { AnalyticsOverview } from "@/types/analytics";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { UsageChart } from "@/components/dashboard/UsageChart";
import { SectionCard } from "@/components/ui/SectionCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const {
    jobs: recentJobs,
    loading: isJobsLoading,
  } = useJobs({ limit: 5 });

  const {
    data: analytics,
    loading: isAnalyticsLoading,
  } = useAnalytics({ days: 30 });

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthLoading, isAuthenticated, router]);

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

  const trends = useMemo(
    () =>
      analytics?.trends || {
        jobs_by_day: {},
        submissions_by_day: {},
      },
    [analytics?.trends],
  );

  const isLoading = isAuthLoading || isJobsLoading || isAnalyticsLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
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
      <DashboardStats overview={overview} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 sm:gap-8">
        {/* Main Content Area - Charts & Activity */}
        <div className="lg:col-span-2 space-y-6">
          <UsageChart trends={trends} />
          <RecentActivity jobs={recentJobs} />
        </div>

        {/* Sidebar Area - Quick Actions & Info */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <SectionCard title="Quick Actions">
            <div className="space-y-3">
              <Link
                href="/dashboard/workflows/new"
                className="group flex w-full items-center rounded-lg border border-gray-200 p-3 transition-all hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700"
              >
                <div className="mr-3 rounded-lg bg-indigo-100 p-2 text-indigo-600 transition-colors group-hover:bg-indigo-200 group-hover:text-indigo-800">
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <span className="font-medium text-gray-700 group-hover:text-indigo-900">
                  New Lead Magnet
                </span>
              </Link>

              <Link
                href="/dashboard/workflows"
                className="group flex w-full items-center rounded-lg border border-gray-200 p-3 transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="mr-3 rounded-lg bg-gray-100 p-2 text-gray-600 transition-colors group-hover:bg-gray-200 group-hover:text-gray-800">
                  <DocumentDuplicateIcon className="h-5 w-5" />
                </div>
                <span className="font-medium text-gray-700 group-hover:text-gray-900">
                  View Templates
                </span>
              </Link>

              <Link
                href="/dashboard/settings"
                className="group flex w-full items-center rounded-lg border border-gray-200 p-3 transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="mr-3 rounded-lg bg-gray-100 p-2 text-gray-600 transition-colors group-hover:bg-gray-200 group-hover:text-gray-800">
                  <Cog6ToothIcon className="h-5 w-5" />
                </div>
                <span className="font-medium text-gray-700 group-hover:text-gray-900">
                  Settings
                </span>
              </Link>
            </div>
          </SectionCard>

          {/* Info Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-lg transition-transform hover:scale-[1.02]">
            <div className="relative z-10">
              <h2 className="mb-2 text-lg font-semibold">
                Boost Your Conversions
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-indigo-100">
                Lead magnets with personalized reports convert up to 10x better
                than generic PDFs.
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
