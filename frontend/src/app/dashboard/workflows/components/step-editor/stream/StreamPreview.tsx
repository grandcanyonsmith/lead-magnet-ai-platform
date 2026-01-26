import Image from "next/image";
import {
  FiDownload,
  FiExternalLink,
  FiImage,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";

interface StreamPreviewProps {
  viewMode: "split" | "terminal" | "preview";
  setViewMode: (mode: "split" | "terminal" | "preview") => void;
  previewLabel: string;
  previewObjectUrl: string | null;
  setIsPreviewOpen: (value: boolean) => void;
  previewFileName: string;
  showHtmlPreview: boolean;
  htmlSrcDoc: string;
  hasScreenshot: boolean;
  currentScreenshotSrc: string | null;
  hasComputerUse: boolean;
}

export function StreamPreview({
  viewMode,
  setViewMode,
  previewLabel,
  previewObjectUrl,
  setIsPreviewOpen,
  previewFileName,
  showHtmlPreview,
  htmlSrcDoc,
  hasScreenshot,
  currentScreenshotSrc,
  hasComputerUse,
}: StreamPreviewProps) {
  return (
    <div
      className={`flex flex-col transition-all duration-300 ease-in-out bg-gray-100 dark:bg-gray-900/50 ${
        viewMode === "split"
          ? "w-1/2"
          : viewMode === "preview"
            ? "w-full"
            : "hidden"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs shadow-sm z-10">
        <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
          <FiImage className="text-gray-400" />
          {previewLabel}
        </div>
        {previewObjectUrl && (
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setViewMode(viewMode === "preview" ? "split" : "preview")
              }
              className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              title={viewMode === "preview" ? "Split View" : "Expand Preview"}
            >
              {viewMode === "preview" ? (
                <FiMinimize2 className="w-3.5 h-3.5" />
              ) : (
                <FiMaximize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-1" />
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              title="Full Screen Preview"
            >
              <FiMaximize2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-1" />
            <a
              href={previewObjectUrl}
              download={previewFileName}
              className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Download"
            >
              <FiDownload className="w-3.5 h-3.5" />
            </a>
            <a
              href={previewObjectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Open in new tab"
            >
              <FiExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden relative group bg-gray-50/50 dark:bg-black/20">
        {showHtmlPreview ? (
          <div
            className="relative w-full h-full flex items-center justify-center cursor-zoom-in"
            onClick={() => setIsPreviewOpen(true)}
          >
            <div className="absolute inset-0 pattern-dots opacity-5 pointer-events-none" />
            <iframe
              title="HTML Preview"
              className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl"
              sandbox=""
              srcDoc={htmlSrcDoc}
            />

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
              <div className="bg-black/75 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm transform translate-y-2 group-hover:translate-y-0 transition-transform">
                Click to enlarge
              </div>
            </div>
          </div>
        ) : hasScreenshot && currentScreenshotSrc ? (
          <div
            className="relative w-full h-full flex items-center justify-center cursor-zoom-in"
            onClick={() => setIsPreviewOpen(true)}
          >
            <div className="absolute inset-0 pattern-dots opacity-5 pointer-events-none" />
            <Image
              src={currentScreenshotSrc}
              alt="Screenshot"
              fill
              sizes="(min-width: 1024px) 70vw, 100vw"
              className="object-contain shadow-xl rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all hover:scale-[1.01]"
              unoptimized
            />

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
              <div className="bg-black/75 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm transform translate-y-2 group-hover:translate-y-0 transition-transform">
                Click to enlarge
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-4 select-none">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center border border-dashed border-gray-200 dark:border-gray-700">
              <FiImage className="w-8 h-8 opacity-50" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-500">
                No preview yet
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {hasComputerUse
                  ? "Screenshots will appear here during execution"
                  : "HTML previews will appear here when detected"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
