interface JsonViewToggleProps {
  viewMode: "markdown" | "json";
  onChange: (mode: "markdown" | "json") => void;
  size?: "default" | "compact";
  className?: string;
}

export function JsonViewToggle({
  viewMode,
  onChange,
  size = "default",
  className = "",
}: JsonViewToggleProps) {
  const isCompact = size === "compact";
  const buttonBase = isCompact
    ? "px-2 py-0.5 text-[10px] font-semibold"
    : "px-2.5 py-1 text-[11px] font-semibold";
  const buttonClass = (active: boolean) =>
    `${buttonBase} rounded-md border transition-colors ${
      active
        ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
    }`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className={`uppercase tracking-wide text-gray-500 dark:text-gray-400 ${
          isCompact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        Preview
      </span>
      <div className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 p-0.5">
        <button
          type="button"
          className={buttonClass(viewMode === "markdown")}
          aria-pressed={viewMode === "markdown"}
          onClick={() => onChange("markdown")}
        >
          Markdown
        </button>
        <button
          type="button"
          className={buttonClass(viewMode === "json")}
          aria-pressed={viewMode === "json"}
          onClick={() => onChange("json")}
        >
          JSON
        </button>
      </div>
    </div>
  );
}
