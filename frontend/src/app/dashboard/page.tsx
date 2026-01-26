"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useJobs } from "@/hooks/api/useJobs";
import { useAnalytics } from "@/hooks/api/useAnalytics";
import {
  Sparkles,
  Zap,
  LayoutTemplate,
  Settings,
  ArrowRight,
} from "lucide-react";
import { AnalyticsOverview } from "@/types/analytics";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { UsageChart } from "@/components/dashboard/UsageChart";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [greeting, setGreeting] = useState("Welcome back");

  const { jobs: recentJobs, loading: isJobsLoading } = useJobs({ limit: 5 });

  const { data: analytics, loading: isAnalyticsLoading } = useAnalytics({
    days: 30,
  });

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

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
    [analytics?.overview]
  );

  const trends = useMemo(
    () =>
      analytics?.trends || {
        jobs_by_day: {},
        submissions_by_day: {},
      },
    [analytics?.trends]
  );

  const isLoading = isAuthLoading || isJobsLoading || isAnalyticsLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <PageHeader
        heading={`${greeting}, ${firstName}`}
        description="Here's what's happening with your lead magnets today."
      >
        <Button 
          onClick={() => router.push("/dashboard/workflows/new")}
          className="gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
        >
          <Sparkles className="h-4 w-4" />
          Create Lead Magnet
        </Button>
      </PageHeader>

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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Link href="/dashboard/workflows/new">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 group hover:border-primary/50"
                >
                  <div className="bg-primary/10 p-2 rounded-md text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">New Lead Magnet</span>
                    <span className="text-xs text-muted-foreground">
                      Create AI workflow
                    </span>
                  </div>
                </Button>
              </Link>
              <Link href="/dashboard/workflows">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 group hover:border-primary/50"
                >
                  <div className="bg-primary/10 p-2 rounded-md text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <LayoutTemplate className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">Templates</span>
                    <span className="text-xs text-muted-foreground">
                      Browse library
                    </span>
                  </div>
                </Button>
              </Link>
              <Link href="/dashboard/settings">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 group hover:border-primary/50"
                >
                  <div className="bg-primary/10 p-2 rounded-md text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">Settings</span>
                    <span className="text-xs text-muted-foreground">
                      Manage account
                    </span>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Info Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 p-6 text-white shadow-lg transition-transform hover:scale-[1.02]">
            <div className="relative z-10">
              <h2 className="mb-2 text-lg font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-300" />
                Pro Tip
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-violet-100/90">
                Personalized reports convert up to 10x better than generic PDFs.
                Try adding more specific inputs to your forms.
              </p>
              <Link
                href="https://docs.leadmagnet.ai"
                target="_blank"
                className="inline-flex items-center rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 hover:shadow-sm ring-1 ring-white/20"
              >
                Read the guide <ArrowRight className="ml-1 h-4 w-4" />
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
