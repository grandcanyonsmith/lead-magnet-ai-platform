"use client";

import { useState } from "react";
import { PreviewRenderer } from "./PreviewRenderer";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  FiDownload,
  FiExternalLink,
  FiClock,
  FiMaximize2,
  FiFile,
} from "react-icons/fi";
import { Artifact } from "@/types";
import { cn } from "@/lib/utils";

interface PreviewCardProps {
  artifact: Artifact;
}

export function PreviewCard({ artifact }: PreviewCardProps) {
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);

  const formatBytes = (bytes?: number) => {
    if (!bytes && bytes !== 0) return "-";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getFileExtension = (fileName?: string, contentType?: string) => {
    if (fileName && fileName.includes(".")) {
      return fileName.split(".").pop()?.toUpperCase() || "FILE";
    }
    if (contentType) {
      const type = contentType.split("/")[1];
      return type.toUpperCase();
    }
    return "FILE";
  };

  const downloadUrl = artifact.object_url || artifact.public_url;

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-md hover:border-primary/50 flex flex-col h-full">
      <div 
        className="relative aspect-[16/10] bg-muted cursor-pointer"
        onClick={() => setIsFullScreenOpen(true)}
      >
        <PreviewRenderer
          contentType={artifact.content_type || artifact.mime_type}
          objectUrl={downloadUrl}
          fileName={artifact.file_name || artifact.artifact_name}
          className="w-full h-full"
          artifactId={artifact.artifact_id}
        />
        
        {/* Type Badge Overlay */}
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="secondary" className="font-bold text-[10px] shadow-sm bg-background/90 backdrop-blur-sm">
            {getFileExtension(
              artifact.file_name || artifact.artifact_name,
              artifact.content_type || artifact.mime_type,
            )}
          </Badge>
        </div>

        {/* Hover Overlay for Quick Expand */}
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-background/80 backdrop-blur-sm p-2 rounded-full shadow-sm text-foreground">
             <FiMaximize2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      <CardContent className="p-3 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate" title={artifact.file_name || artifact.artifact_name || "Artifact"}>
              {artifact.file_name || artifact.artifact_name || "Artifact"}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <FiClock className="w-3 h-3" />
                {formatDate(artifact.created_at)}
              </span>
              <span>•</span>
              <span className="font-mono">
                {formatBytes(artifact.size_bytes || artifact.file_size_bytes)}
              </span>
            </div>
          </div>
        </div>
        
        {artifact.artifact_type && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className="text-[10px] font-normal px-1.5 h-5">
              {artifact.artifact_type}
            </Badge>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-2 pt-0 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => setIsFullScreenOpen(true)}
        >
          <FiMaximize2 className="w-3 h-3 mr-1.5" />
          Preview
        </Button>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            download={
              artifact.file_name ||
              artifact.artifact_name ||
              `download.${artifact.content_type?.split("/")[1]}`
            }
            className="w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="default" size="sm" className="w-full h-8 text-xs">
              <FiDownload className="w-3 h-3 mr-1.5" />
              Download
            </Button>
          </a>
        ) : (
          <Button variant="ghost" size="sm" className="w-full h-8 text-xs" disabled>
            No URL
          </Button>
        )}
      </CardFooter>

      <FullScreenPreviewModal
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
        contentType={artifact.content_type || artifact.mime_type}
        objectUrl={downloadUrl}
        fileName={artifact.file_name || artifact.artifact_name}
        artifactId={artifact.artifact_id}
      />
    </Card>
  );
}
