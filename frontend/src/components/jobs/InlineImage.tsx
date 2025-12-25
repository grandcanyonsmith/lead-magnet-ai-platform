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
}

export function InlineImage({ url, alt, className = "" }: InlineImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
        className={`my-4 md:my-2 p-4 md:p-3 bg-red-50 border-2 border-red-200 rounded-xl ${className}`}
      >
        <div className="flex items-center gap-3 md:gap-2 text-base md:text-sm text-red-700">
          <FiAlertCircle className="w-5 h-5 md:w-4 md:h-4 flex-shrink-0" />
          <span>Failed to load image</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 md:mt-2 block text-sm md:text-xs text-blue-600 hover:text-blue-800 active:text-blue-900 hover:underline break-all touch-target py-2 md:py-1 min-h-[44px] md:min-h-0"
        >
          {url}
        </a>
      </div>
    );
  }

  return (
    <div className={`my-4 md:my-2 w-full ${className}`}>
      <div className="rounded-xl overflow-hidden border-2 border-gray-200 bg-white p-2 md:p-1">
        <div className="relative w-full aspect-video bg-gray-50 rounded-lg overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="flex items-center gap-3 md:gap-2 text-base md:text-sm text-gray-500">
                <FiImage className="w-6 h-6 md:w-5 md:h-5 animate-pulse" />
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
              maxHeight: "600px",
            }}
            unoptimized
          />
        </div>
      </div>
      {!loading && !error && (
        <div className="mt-3 md:mt-1 px-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm md:text-xs text-blue-600 hover:text-blue-800 active:text-blue-900 hover:underline break-all block touch-target py-2 md:py-1 min-h-[44px] md:min-h-0"
          >
            {url}
          </a>
        </div>
      )}
    </div>
  );
}
