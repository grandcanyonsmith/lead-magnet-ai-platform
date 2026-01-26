import { FiMonitor, FiTablet, FiSmartphone } from "react-icons/fi";

interface PreviewHeaderProps {
  viewMode?: "desktop" | "tablet" | "mobile";
  onViewModeChange?: (mode: "desktop" | "tablet" | "mobile") => void;
  fileName?: string;
}

export function PreviewHeader({
  viewMode,
  onViewModeChange,
  fileName,
}: PreviewHeaderProps) {
  if (!onViewModeChange) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex gap-2">
        <button
          onClick={() => onViewModeChange("desktop")}
          className={`p-2 rounded-lg transition-colors ${
            viewMode === "desktop"
              ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          aria-label="Desktop view"
          title="Desktop view"
        >
          <FiMonitor className="w-5 h-5" />
        </button>
        <button
          onClick={() => onViewModeChange("tablet")}
          className={`p-2 rounded-lg transition-colors ${
            viewMode === "tablet"
              ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          aria-label="Tablet view"
          title="Tablet view"
        >
          <FiTablet className="w-5 h-5" />
        </button>
        <button
          onClick={() => onViewModeChange("mobile")}
          className={`p-2 rounded-lg transition-colors ${
            viewMode === "mobile"
              ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          aria-label="Mobile view"
          title="Mobile view"
        >
          <FiSmartphone className="w-5 h-5" />
        </button>
      </div>
      {fileName && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-md">
          {fileName}
        </div>
      )}
    </div>
  );
}
