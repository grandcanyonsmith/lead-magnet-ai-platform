"use client";

import { useEffect, useState } from "react";
import { getJobStats, TrackingStats } from "@/lib/api/tracking.client";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  FiActivity,
  FiUsers,
  FiMousePointer,
  FiClock,
  FiEye,
  FiMapPin,
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
      <div className="text-center py-12 text-gray-500">
        <p>No tracking data available yet.</p>
        <p className="text-sm mt-2">
          Tracking data will appear once visitors access your lead magnet.
        </p>
      </div>
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
      icon: FiMousePointer,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Unique Visitors",
      value: stats.unique_visitors.toLocaleString(),
      icon: FiUsers,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Total Sessions",
      value: stats.total_sessions.toLocaleString(),
      icon: FiActivity,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Avg Session Duration",
      value: formatDuration(stats.average_session_duration_seconds),
      icon: FiClock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Total Page Views",
      value: stats.total_page_views.toLocaleString(),
      icon: FiEye,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      label: "Avg Page Views/Session",
      value: stats.average_page_views_per_session.toFixed(1),
      icon: FiEye,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
    },
  ];

  const topLocations = Object.entries(stats.location_breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`${card.bgColor} rounded-lg p-4 border border-gray-200`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {card.label}
                  </p>
                  <p className={`text-2xl font-bold ${card.color} mt-1`}>
                    {card.value}
                  </p>
                </div>
                <Icon className={`${card.color} text-3xl opacity-50`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Location Breakdown */}
      {topLocations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiMapPin className="text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Top Locations
            </h3>
          </div>
          <div className="space-y-2">
            {topLocations.map(([country, count]) => (
              <div
                key={country}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-gray-700">{country}</span>
                <span className="font-semibold text-gray-900">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.total_clicks === 0 && stats.total_sessions === 0 && (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          <FiActivity className="mx-auto text-4xl text-gray-400 mb-3" />
          <p className="font-medium">No activity yet</p>
          <p className="text-sm mt-1">
            Share your lead magnet to start tracking engagement!
          </p>
        </div>
      )}
    </div>
  );
}
