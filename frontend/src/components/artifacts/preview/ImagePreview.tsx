import { useState } from "react";
import Image from "next/image";
import { FiImage } from "react-icons/fi";

interface ImagePreviewProps {
  isFullScreen: boolean;
  previewObjectUrl: string | null | undefined;
  fileName?: string;
  isInView: boolean;
}

export function ImagePreview({
  isFullScreen,
  previewObjectUrl,
  fileName,
  isInView,
}: ImagePreviewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (isFullScreen) {
    // Full-screen mode: use regular img tag for better scaling
    return (
      <div className="relative flex items-center justify-center w-full h-full">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <FiImage className="w-12 h-12 text-white/50 animate-pulse" />
          </div>
        )}
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <FiImage className="w-12 h-12 text-white/50" />
          </div>
        )}
        {isInView && previewObjectUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewObjectUrl}
            alt={fileName || "Preview"}
            className={`max-w-[95vw] max-h-[95vh] object-contain ${
              imageLoaded ? "opacity-100" : "opacity-0"
            } transition-opacity`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            style={{ maxWidth: "95vw", maxHeight: "95vh" }}
          />
        )}
      </div>
    );
  }

  // Regular mode: use Next.js Image with fill
  return (
    <div className="relative w-full h-full flex items-center justify-center min-h-0">
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <FiImage className="w-12 h-12 text-gray-400 dark:text-gray-500 animate-pulse" />
        </div>
      )}
      {imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <FiImage className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
      )}
      {isInView && previewObjectUrl && (
        <div className="relative w-full h-full flex items-center justify-center p-4">
          <Image
            src={previewObjectUrl}
            alt={fileName || "Preview"}
            fill
            className={`object-contain ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            unoptimized
            sizes="(max-width: 768px) 100vw, 95vw"
          />
        </div>
      )}
    </div>
  );
}
