"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionCard } from "@/components/ui/SectionCard";

interface UsageChartProps {
  trends: {
    jobs_by_day: Record<string, number>;
    submissions_by_day: Record<string, number>;
  };
}

export function UsageChart({ trends }: UsageChartProps) {
  const data = useMemo(() => {
    const dates = new Set([
      ...Object.keys(trends.jobs_by_day || {}),
      ...Object.keys(trends.submissions_by_day || {}),
    ]);

    return Array.from(dates)
      .sort()
      .map((date) => ({
        date: new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        jobs: trends.jobs_by_day[date] || 0,
        submissions: trends.submissions_by_day[date] || 0,
      }));
  }, [trends]);

  if (data.length === 0) {
    return (
      <SectionCard title="Usage Trends">
        <div className="flex h-[300px] items-center justify-center text-gray-400">
          No data available
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Usage Trends">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              itemStyle={{ fontSize: "12px", fontWeight: 500 }}
              labelStyle={{ color: "#6b7280", marginBottom: "4px" }}
            />
            <Area
              type="monotone"
              dataKey="jobs"
              name="Jobs"
              stroke="#6366f1"
              fillOpacity={1}
              fill="url(#colorJobs)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="submissions"
              name="Submissions"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorSubmissions)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

