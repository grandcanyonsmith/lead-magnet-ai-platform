import React from "react";
import { FiFile, FiDownload, FiExternalLink } from "react-icons/fi";
import { Artifact } from "@/types/artifact";

interface GeneratedFilesListProps {
  fileArtifacts: Artifact[];
}

export function GeneratedFilesList({ fileArtifacts }: GeneratedFilesListProps) {
  if (!fileArtifacts || fileArtifacts.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 md:mt-2.5 pt-3 md:pt-2.5 border-t border-gray-200 dark:border-gray-700">
      <span className="text-sm md:text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2.5 md:mb-2 block">
        Generated Files:
      </span>
      <div className="grid grid-cols-1 gap-2">
        {fileArtifacts.map((artifact, idx) => {
          const artifactUrl = artifact.object_url || artifact.public_url;
          const fileName =
            artifact.file_name || artifact.artifact_name || `File ${idx + 1}`;
          const fileType = artifact.content_type || "application/octet-stream";

          return (
            <div
              key={artifact.artifact_id || idx}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                  <FiFile className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                    title={fileName}
                  >
                    {fileName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {fileType}
                  </p>
                </div>
              </div>

              {artifactUrl && (
                <div className="flex items-center gap-2">
                  <a
                    href={artifactUrl}
                    download={fileName}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Download"
                  >
                    <FiDownload className="w-4 h-4" />
                  </a>
                  <a
                    href={artifactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Open in new tab"
                  >
                    <FiExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
