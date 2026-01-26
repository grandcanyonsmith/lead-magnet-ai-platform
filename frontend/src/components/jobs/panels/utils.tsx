import React from "react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { DetailRow } from "@/components/jobs/StepMetaTypes";
import { McpRequireApproval, McpToolConfig, Tool } from "@/types/workflow";
import { getToolName } from "@/utils/stepMeta";

export const getOutputText = (value: unknown) => {
  if (value === null || value === undefined) return "No output yet";
  if (typeof value === "string") {
    return value.trim() || "No output yet";
  }
  const text = JSON.stringify(value, null, 2);
  return text || "No output yet";
};

export const isMarkdownLike = (value: string) =>
  /(^|\n)#{1,6}\s/.test(value) ||
  /```/.test(value) ||
  /\*\*[^*]+\*\*/.test(value) ||
  /__[^_]+__/.test(value) ||
  /(^|\n)\s*[-*+]\s+/.test(value) ||
  /(^|\n)\s*\d+\.\s+/.test(value) ||
  /\[[^\]]+\]\([^)]+\)/.test(value);

export const renderDependencyOutputPreview = (value: unknown) => {
  const preview = getOutputText(value);
  if (typeof preview === "string" && isMarkdownLike(preview)) {
    return (
      <MarkdownRenderer
        value={preview}
        className="prose prose-sm max-w-none text-[11px] leading-snug text-foreground/90 dark:prose-invert prose-p:my-1 prose-headings:my-1 prose-li:my-0 prose-pre:my-1 prose-pre:overflow-x-auto"
        fallbackClassName="whitespace-pre-wrap break-words text-[11px] leading-snug"
      />
    );
  }

  return <pre className="whitespace-pre-wrap break-words">{preview}</pre>;
};

export function DetailRows({ rows }: { rows: DetailRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-2 py-1"
        >
          <span className="text-[11px] font-medium text-muted-foreground">
            {row.label}
          </span>
          <span
            className={`text-[11px] font-semibold ${
              row.muted ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export const isMcpTool = (tool: Tool): tool is McpToolConfig =>
  Boolean(tool) &&
  typeof tool === "object" &&
  !Array.isArray(tool) &&
  tool.type === "mcp";

export const formatAllowedTools = (allowedTools?: string[]) => {
  if (!Array.isArray(allowedTools) || allowedTools.length === 0) return "";
  return allowedTools.join(", ");
};

export const parseAllowedTools = (value: string): string[] | undefined => {
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.length > 0 ? tokens : undefined;
};

export const getApprovalValue = (value?: McpRequireApproval): "" | McpRequireApproval => {
  if (value === "always" || value === "never") return value;
  return "";
};

export const getMcpDisplayLabel = (tool: McpToolConfig): string => {
  const serverLabel = tool.server_label?.trim() || null;
  const connectorId = tool.connector_id?.trim() || null;
  const serverUrl = tool.server_url?.trim() || null;
  if (serverLabel) return `mcp:${serverLabel}`;
  if (connectorId) return `mcp:${connectorId}`;
  if (serverUrl) {
    try {
      const parsed = new URL(serverUrl);
      if (parsed.hostname) return `mcp:${parsed.hostname}`;
    } catch {
      return `mcp:${serverUrl}`;
    }
  }
  return "mcp";
};

export const getToolDisplayLabel = (tool: Tool): string => {
  if (typeof tool === "string") return tool;
  if (tool.type === "mcp") {
    return getMcpDisplayLabel(tool);
  }
  if ("name" in tool && typeof tool.name === "string" && tool.name.trim()) {
    return tool.name.trim();
  }
  return tool.type || "Unknown";
};
