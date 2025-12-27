import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  DocumentDuplicateIcon,
  DocumentCheckIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Job } from "@/types/job";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";

interface RecentActivityProps {
  jobs: Job[];
}

export function RecentActivity({ jobs }: RecentActivityProps) {
  return (
    <SectionCard
      title="Recent Activity"
      padding="none"
      actions={
        <Link href="/dashboard/jobs">
          <Button variant="ghost" size="sm" className="group text-primary-600 hover:text-primary-700 hover:bg-primary-50">
            View all
            <ArrowRightIcon className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </Link>
      }
    >
      <div className="divide-y divide-gray-50">
        {jobs.length > 0 ? (
          jobs.map((job) => (
            <Link
              key={job.job_id}
              href={`/dashboard/jobs/${job.job_id}`}
              className="group block transition-colors hover:bg-gray-50/50 p-4 sm:p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 transition-colors group-hover:bg-white group-hover:shadow-sm">
                    <DocumentCheckIcon className="h-5 w-5 text-gray-500 group-hover:text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-gray-900 group-hover:text-primary-600 transition-colors">
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
            </Link>
          ))
        ) : (
          <div className="p-8 text-center text-gray-500">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <DocumentDuplicateIcon className="h-6 w-6 text-gray-400" />
            </div>
            <p className="mb-2 font-medium text-gray-900">No activity yet</p>
            <p className="mb-4 text-sm">
              Create your first lead magnet to get started.
            </p>
            <Link href="/dashboard/workflows/new">
              <Button>
                Create Lead Magnet
              </Button>
            </Link>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

