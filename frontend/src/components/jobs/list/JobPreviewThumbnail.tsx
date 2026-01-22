"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
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
  const [imageError, setImageError] = useState(false);
  const preview = useJobPreview(job, {
    enabled: true,
    lazy: showOnHover && !isHovered,
  });
  const isImage = preview.contentType?.startsWith("image/");
  const imageUrl = preview.url || "";

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

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
        {isImage && imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt="Job output preview"
            fill
            sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 50vw"
            className="object-cover"
            onError={() => setImageError(true)}
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-gray-50 dark:bg-gray-800">
            {isImage ? (
              <PhotoIcon
                className={clsx(
                  "text-gray-400 dark:text-gray-500",
                  iconSizes[size],
                )}
              />
            ) : (
              <DocumentIcon
                className={clsx(
                  "text-gray-400 dark:text-gray-500",
                  iconSizes[size],
                )}
              />
            )}
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

