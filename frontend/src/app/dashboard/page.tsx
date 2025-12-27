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
import { Button } from "@/components/ui/Button";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

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

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome back, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Here's what's happening with your lead magnets today.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/workflows/new">
            <Button className="gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
              <SparklesIcon className="h-4 w-4" />
              Create Lead Magnet
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <DashboardStats overview={overview} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content Area - Charts & Activity */}
        <div className="lg:col-span-2 space-y-6">
          <UsageChart trends={trends} />
          <RecentActivity jobs={recentJobs} />
        </div>

        {/* Sidebar Area - Quick Actions & Info */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <SectionCard title="Quick Actions">
            <div className="space-y-2">
              <Link
                href="/dashboard/workflows/new"
                className="group flex w-full items-center rounded-lg border border-transparent p-3 transition-all hover:bg-accent hover:text-accent-foreground"
              >
                <div className="mr-3 rounded-md bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <span className="block font-medium">New Lead Magnet</span>
                  <span className="text-xs text-muted-foreground">Create a new AI-powered workflow</span>
                </div>
              </Link>

              <Link
                href="/dashboard/workflows"
                className="group flex w-full items-center rounded-lg border border-transparent p-3 transition-all hover:bg-accent hover:text-accent-foreground"
              >
                <div className="mr-3 rounded-md bg-muted p-2 text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <DocumentDuplicateIcon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <span className="block font-medium">View Templates</span>
                  <span className="text-xs text-muted-foreground">Browse pre-made templates</span>
                </div>
              </Link>

              <Link
                href="/dashboard/settings"
                className="group flex w-full items-center rounded-lg border border-transparent p-3 transition-all hover:bg-accent hover:text-accent-foreground"
              >
                <div className="mr-3 rounded-md bg-muted p-2 text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Cog6ToothIcon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <span className="block font-medium">Settings</span>
                  <span className="text-xs text-muted-foreground">Manage your account</span>
                </div>
              </Link>
            </div>
          </SectionCard>

          {/* Info Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 p-6 text-white shadow-lg transition-transform hover:scale-[1.02]">
            <div className="relative z-10">
              <h2 className="mb-2 text-lg font-semibold flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-yellow-300" />
                Pro Tip
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-violet-100/90">
                Personalized reports convert up to 10x better than generic PDFs. Try adding more specific inputs to your forms.
              </p>
              <Link
                href="https://docs.leadmagnet.ai"
                target="_blank"
                className="inline-flex items-center rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 hover:shadow-sm ring-1 ring-white/20"
              >
                Read the guide <ArrowRightIcon className="ml-1 h-4 w-4" />
              </Link>
            </div>

            {/* Background decoration */}
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
            <div className="absolute -left-10 top-10 h-20 w-20 rounded-full bg-purple-400/20 blur-xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
