"use client";

import { useEffect, useState } from "react";
import { getJobStats, TrackingStats } from "@/lib/api/tracking.client";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatPill } from "@/components/ui/StatPill";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  FiActivity,
  FiUsers,
  FiMousePointer,
  FiClock,
  FiEye,
} from "react-icons/fi";

interface JobTrackingStatsProps {
  jobId: string;
}

export function JobTrackingStats({ jobId }: JobTrackingStatsProps) {
  const [stats, setStats] = useState<TrackingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        setError(null);
        const data = await getJobStats(jobId);
        setStats(data);
      } catch (err: any) {
        setError(err.message || "Failed to load tracking stats");
      } finally {
        setLoading(false);
      }
    }

    if (jobId) {
      loadStats();
    }
  }, [jobId]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!stats) {
    return (
      <EmptyState
        title="No tracking data yet"
        message="Tracking data will appear once visitors access your lead magnet."
        className="rounded-xl border border-dashed border-border bg-muted/30"
      />
    );
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  };

  const statCards = [
    {
      label: "Total Clicks",
      value: stats.total_clicks.toLocaleString(),
      icon: <FiMousePointer className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: "Unique Visitors",
      value: stats.unique_visitors.toLocaleString(),
      icon: <FiUsers className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: "Total Sessions",
      value: stats.total_sessions.toLocaleString(),
      icon: <FiActivity className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: "Avg Session Duration",
      value: formatDuration(stats.average_session_duration_seconds),
      icon: <FiClock className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: "Total Page Views",
      value: stats.total_page_views.toLocaleString(),
      icon: <FiEye className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: "Avg Page Views/Session",
      value: stats.average_page_views_per_session.toFixed(1),
      icon: <FiEye className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  const topLocations = Object.entries(stats.location_breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Engagement metrics"
        description="Snapshot of how visitors are interacting with your lead magnet."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {statCards.map((card) => (
            <StatPill
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
            />
          ))}
        </div>
      </SectionCard>

      {topLocations.length > 0 && (
        <SectionCard
          title="Top locations"
          description="Where your visitors are coming from."
        >
          <div className="space-y-2">
            {topLocations.map(([country, count]) => (
              <div
                key={country}
                className="flex items-center justify-between py-2 border-b border-border/60 last:border-0"
              >
                <span className="text-muted-foreground">{country}</span>
                <span className="font-semibold text-foreground">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {stats.total_clicks === 0 && stats.total_sessions === 0 && (
        <EmptyState
          title="No activity yet"
          message="Share your lead magnet to start tracking engagement."
          icon={<FiActivity className="h-6 w-6 text-gray-400" />}
          className="rounded-xl border border-dashed border-border bg-muted/30"
        />
      )}
    </div>
  );
}
