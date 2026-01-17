/**
 * Inline Image Component
 * Renders an image inline with error handling and loading states
 */

import { useState } from "react";
import Image from "next/image";
import { FiImage, FiAlertCircle } from "react-icons/fi";

interface InlineImageProps {
  url: string;
  alt?: string;
  className?: string;
  size?: "default" | "compact";
}

export function InlineImage({
  url,
  alt,
  className = "",
  size = "default",
}: InlineImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isCompact = size === "compact";
  const displayUrl =
    url.length > 48 ? `${url.slice(0, 28)}...${url.slice(-12)}` : url;

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  if (error) {
    return (
      <div
        className={`${
          isCompact ? "my-2 p-3" : "my-4 p-4"
        } bg-red-50 border border-red-200 rounded-xl ${className}`}
      >
        <div
          className={`flex items-center gap-2 ${
            isCompact ? "text-xs" : "text-sm"
          } text-red-700`}
        >
          <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Failed to load image</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${
            isCompact ? "mt-2 text-xs" : "mt-3 text-sm"
          } block text-blue-600 hover:text-blue-800 hover:underline truncate`}
          title={url}
        >
          {displayUrl}
        </a>
      </div>
    );
  }

  return (
    <div
      className={`${
        isCompact ? "my-2 max-w-[160px]" : "my-4 w-full"
      } ${className}`}
    >
      <div
        className={`rounded-xl overflow-hidden border ${
          isCompact ? "border-gray-200 p-1" : "border-2 border-gray-200 p-2"
        } bg-white`}
      >
        <div
          className={`relative w-full ${
            isCompact ? "aspect-square" : "aspect-video"
          } bg-gray-50 rounded-lg overflow-hidden`}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div
                className={`flex items-center gap-2 ${
                  isCompact ? "text-xs" : "text-sm"
                } text-gray-500`}
              >
                <FiImage
                  className={`${
                    isCompact ? "w-4 h-4" : "w-5 h-5"
                  } animate-pulse`}
                />
                <span>Loading image...</span>
              </div>
            </div>
          )}
          <Image
            src={url}
            alt={alt || "Inline image"}
            fill
            onLoad={handleLoad}
            onError={handleError}
            className={`object-contain rounded-lg transition-opacity duration-200 ${
              loading ? "opacity-0 absolute" : "opacity-100"
            }`}
            style={{
              maxHeight: isCompact ? "200px" : "600px",
            }}
            unoptimized
          />
        </div>
      </div>
      {!loading && !error && (
        <div className={`${isCompact ? "mt-2 px-1" : "mt-3 px-2"}`}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${
              isCompact ? "text-xs" : "text-sm"
            } text-blue-600 hover:text-blue-800 hover:underline truncate block`}
            title={url}
          >
            {displayUrl}
          </a>
        </div>
      )}
    </div>
  );
}
