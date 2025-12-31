"use client";

import React, { useState } from "react";
import { useJobPreview } from "@/hooks/useJobPreview";
import {
  ArrowPathIcon,
  PhotoIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import type { Job } from "@/types/job";
import clsx from "clsx";

interface JobPreviewThumbnailProps {
  job: Job;
  size?: "sm" | "md" | "lg";
  showOnHover?: boolean;
  onPreviewClick?: (e: React.MouseEvent) => void;
}

export function JobPreviewThumbnail({
  job,
  size = "md",
  showOnHover = false,
  onPreviewClick,
}: JobPreviewThumbnailProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const preview = useJobPreview(job, {
    enabled: true,
    lazy: showOnHover && !isHovered,
  });

  // Trigger fetch on hover if lazy mode
  const handleMouseEnter = () => {
    if (showOnHover) {
      setIsHovered(true);
      preview.triggerFetch?.();
    }
  };

  const handleMouseLeave = () => {
    if (showOnHover) {
      setIsHovered(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (preview.url) {
      setShowModal(true);
    }
    onPreviewClick?.(e);
  };

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  const iconSizes = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  if (!preview.url && !preview.isLoading) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800",
          sizeClasses[size],
        )}
        title="No preview available"
      >
        <DocumentIcon
          className={clsx(
            "text-gray-400 dark:text-gray-500",
            iconSizes[size],
          )}
        />
      </div>
    );
  }

  if (preview.isLoading) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800",
          sizeClasses[size],
        )}
      >
        <ArrowPathIcon
          className={clsx(
            "animate-spin text-gray-400 dark:text-gray-500",
            iconSizes[size],
          )}
        />
      </div>
    );
  }

  const isImage = preview.contentType?.startsWith("image/");

  return (
    <>
      <div
        className={clsx(
          "relative rounded border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer transition-all hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md group",
          sizeClasses[size],
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        title="Click to preview"
      >
        {isImage ? (
          <img
            src={preview.url || undefined}
            alt="Job output preview"
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Fallback to icon if image fails to load
              const target = e.currentTarget;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent && !parent.querySelector(".fallback-icon")) {
                const icon = document.createElement("div");
                icon.className = `fallback-icon flex items-center justify-center w-full h-full bg-gray-50 dark:bg-gray-800`;
                icon.innerHTML = `<svg class="${iconSizes[size]} text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>`;
                parent.appendChild(icon);
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-gray-50 dark:bg-gray-800">
            <DocumentIcon
              className={clsx(
                "text-gray-400 dark:text-gray-500",
                iconSizes[size],
              )}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>

      {showModal && preview.url && (
        <FullScreenPreviewModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          contentType={preview.contentType || undefined}
          objectUrl={preview.url || undefined}
          fileName={`Preview - ${job.job_id}`}
        />
      )}
    </>
  );
}

