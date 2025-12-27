import React, { useMemo } from "react";
import {
  BoltIcon,
  UserGroupIcon,
  DocumentCheckIcon,
} from "@heroicons/react/24/outline";
import { AnalyticsOverview } from "@/types/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

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

  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600 ring-blue-500/20",
    green: "bg-green-100 text-green-600 ring-green-500/20",
    purple: "bg-purple-100 text-purple-600 ring-purple-500/20",
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card
            key={stat.label}
            className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md border-gray-100"
          >
            <div className="absolute right-0 top-0 p-4 opacity-5 transition-transform duration-300 group-hover:scale-110 group-hover:opacity-10">
              <Icon className="h-24 w-24 text-current" />
            </div>

            <CardContent className="relative z-10 pt-6">
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

