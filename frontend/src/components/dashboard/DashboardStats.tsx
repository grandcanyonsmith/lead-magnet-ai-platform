import React, { useMemo } from "react";
import {
  BoltIcon,
  UserGroupIcon,
  DocumentCheckIcon,
} from "@heroicons/react/24/outline";
import { AnalyticsOverview } from "@/types/analytics";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface DashboardStatsProps {
  overview: AnalyticsOverview;
}

export function DashboardStats({ overview }: DashboardStatsProps) {
  const stats = useMemo(
    () => [
      {
        label: "Leads Collected",
        value: overview.total_submissions || 0,
        icon: UserGroupIcon,
        color: "blue",
        description: "Total submissions across all forms",
        trend: "+12% from last month", // Placeholder for trend
      },
      {
        label: "Reports Generated",
        value: overview.completed_jobs || 0,
        icon: DocumentCheckIcon,
        color: "green",
        description: "Successfully processed lead magnets",
        trend: "+5% from last month", // Placeholder for trend
      },
      {
        label: "Active Magnets",
        value: overview.active_workflows || 0,
        icon: BoltIcon,
        color: "purple",
        description: "Workflows currently accepting submissions",
        trend: "Stable", // Placeholder for trend
      },
    ],
    [overview],
  );

  const colorStyles: Record<string, { bg: string; text: string; icon: string }> = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-900/20",
      text: "text-blue-700 dark:text-blue-300",
      icon: "text-blue-600 dark:text-blue-400",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-900/20",
      text: "text-green-700 dark:text-green-300",
      icon: "text-green-600 dark:text-green-400",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-900/20",
      text: "text-purple-700 dark:text-purple-300",
      icon: "text-purple-600 dark:text-purple-400",
    },
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const styles = colorStyles[stat.color];

        return (
          <Card
            key={stat.label}
            className={cn(
              "group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-border/50 bg-card",
            )}
            style={{
              animationDelay: `${index * 100}ms`,
            }}
          >
            <div className="absolute right-0 top-0 p-4 opacity-[0.03] dark:opacity-[0.05] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.08]">
              <Icon className="h-32 w-32 text-foreground" />
            </div>

            <CardContent className="relative z-10 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div
                  className={cn(
                    "rounded-xl p-3 ring-1 ring-inset ring-black/5 dark:ring-white/10 transition-colors duration-300",
                    styles.bg,
                    styles.text
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                {/* <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                  {stat.trend}
                </span> */}
              </div>
              
              <div className="space-y-1">
                <p className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl tabular-nums">
                  {stat.value.toLocaleString()}
                </p>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
              </div>
              
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
