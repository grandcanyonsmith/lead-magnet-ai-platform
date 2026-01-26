"use client";

import React, { useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { Select } from "@/components/ui/Select";
import type { Tool, McpToolConfig, McpRequireApproval } from "@/types/workflow";
import {
  CONTROL_BASE,
  FIELD_LABEL,
  FIELD_OPTIONAL,
  HELP_TEXT,
  SELECT_CONTROL,
} from "./constants";

type McpCatalogEntry = {
  id: string;
  label: string;
  serverLabel: string;
  serverUrl?: string;
  allowedTools?: string[];
  requireApproval?: McpRequireApproval;
};

const MCP_CATALOG: McpCatalogEntry[] = [
  { id: "browser", label: "Browser", serverLabel: "browser" },
  { id: "notion", label: "Notion", serverLabel: "notion" },
  { id: "openai", label: "OpenAI", serverLabel: "openai" },
  { id: "openai-tools", label: "OpenAI Tools", serverLabel: "openai_tools" },
  {
    id: "aws-resources",
    label: "AWS Resources (Deep Research)",
    serverLabel: "aws_resources",
    serverUrl: "https://deep-research-server-grandcanyonsmit.replit.app/sse/",
    allowedTools: ["aws_resources_query_or_modify"],
  },
];

const isMcpTool = (tool: Tool): tool is McpToolConfig =>
  Boolean(tool) && typeof tool === "object" && tool.type === "mcp";

const formatAllowedTools = (allowedTools?: string[]) => {
  if (!Array.isArray(allowedTools) || allowedTools.length === 0) return "";
  return allowedTools.join(", ");
};

const parseAllowedTools = (value: string): string[] | undefined => {
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.length > 0 ? tokens : undefined;
};

const resolveConnectionType = (tool: McpToolConfig): "remote" | "connector" =>
  tool.connector_id ? "connector" : "remote";

const getApprovalValue = (
  value?: McpRequireApproval,
): "" | McpRequireApproval => {
  if (value === "always" || value === "never") return value;
  return "";
};

interface McpToolsConfigProps {
  tools: Tool[] | undefined;
  onToolsChange: (nextTools: Tool[]) => void;
}

export default function McpToolsConfig({
  tools,
  onToolsChange,
}: McpToolsConfigProps) {
  const [catalogSelection, setCatalogSelection] = useState("");
  const currentTools = Array.isArray(tools) ? [...tools] : [];
  const mcpEntries = currentTools
    .map((tool, index) => (isMcpTool(tool) ? { tool, index } : null))
    .filter(
      (entry): entry is { tool: McpToolConfig; index: number } =>
        entry !== null,
    );

  const updateTool = (
    index: number,
    updater: (tool: McpToolConfig) => McpToolConfig,
  ) => {
    const nextTools = [...currentTools];
    const current = nextTools[index];
    if (!isMcpTool(current)) return;
    nextTools[index] = updater(current);
    onToolsChange(nextTools);
  };

  const handleRemove = (index: number) => {
    const nextTools = [...currentTools];
    nextTools.splice(index, 1);
    onToolsChange(nextTools);
  };

  const handleAddCustom = () => {
    onToolsChange([
      ...currentTools,
      {
        type: "mcp",
        server_label: "",
      },
    ]);
  };

  const handleAddCatalog = () => {
    if (!catalogSelection) return;
    const entry = MCP_CATALOG.find((item) => item.id === catalogSelection);
    if (!entry) return;
    onToolsChange([
      ...currentTools,
      {
        type: "mcp",
        server_label: entry.serverLabel,
        server_url: entry.serverUrl,
        allowed_tools: entry.allowedTools,
        require_approval: entry.requireApproval,
      },
    ]);
    setCatalogSelection("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-semibold text-foreground">
          MCP servers
        </div>
        <span className="text-xs text-muted-foreground">
          {mcpEntries.length > 0
            ? `${mcpEntries.length} configured`
            : "None configured"}
        </span>
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Select
            value={catalogSelection}
            onChange={(nextValue) => setCatalogSelection(nextValue)}
            className={SELECT_CONTROL}
            aria-label="Select MCP catalog entry"
          >
            <option value="">Add from catalog...</option>
            {MCP_CATALOG.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={handleAddCatalog}
            disabled={!catalogSelection}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiPlus className="h-3.5 w-3.5" />
            Add
          </button>
          <button
            type="button"
            onClick={handleAddCustom}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-border"
          >
            <FiPlus className="h-3.5 w-3.5" />
            Custom
          </button>
        </div>

        {mcpEntries.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Add an MCP server to let this step use external tools.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {mcpEntries.map(({ tool, index }, entryIndex) => {
          const connectionType = resolveConnectionType(tool);
          const isMissingConnection = !tool.server_url && !tool.connector_id;
          return (
            <div
              key={`mcp-${index}`}
              className="rounded-xl border border-border/60 bg-background/80 p-4 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  MCP server {entryIndex + 1}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-700"
                  title="Remove MCP server"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    className={FIELD_LABEL}
                    htmlFor={`mcp-label-${index}`}
                  >
                    <span>Server label</span>
                    <span className={FIELD_OPTIONAL}>(Required)</span>
                  </label>
                  <input
                    id={`mcp-label-${index}`}
                    value={tool.server_label || ""}
                    onChange={(event) =>
                      updateTool(index, (current) => ({
                        ...current,
                        server_label: event.target.value,
                      }))
                    }
                    className={CONTROL_BASE}
                    placeholder="e.g. browser"
                  />
                  <p className={HELP_TEXT}>
                    Used by the model to reference this MCP server.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className={FIELD_LABEL}>
                    <span>Connection type</span>
                    <span className={FIELD_OPTIONAL}>(Optional)</span>
                  </label>
                  <Select
                    value={connectionType}
                    onChange={(nextValue) =>
                      updateTool(index, (current) => ({
                        ...current,
                        server_url:
                          nextValue === "remote" ? current.server_url : undefined,
                        connector_id:
                          nextValue === "connector"
                            ? current.connector_id
                            : undefined,
                      }))
                    }
                    className={SELECT_CONTROL}
                    aria-label="Select MCP connection type"
                  >
                    <option value="remote">Remote server URL</option>
                    <option value="connector">Connector ID</option>
                  </Select>
                  <p className={HELP_TEXT}>
                    Choose whether this MCP entry connects to a remote server or a
                    connector.
                  </p>
                </div>

                {connectionType === "remote" ? (
                  <div className="space-y-1.5 md:col-span-2">
                    <label
                      className={FIELD_LABEL}
                      htmlFor={`mcp-url-${index}`}
                    >
                      <span>Server URL</span>
                      <span className={FIELD_OPTIONAL}>(Required)</span>
                    </label>
                    <input
                      id={`mcp-url-${index}`}
                      value={tool.server_url || ""}
                      onChange={(event) =>
                        updateTool(index, (current) => ({
                          ...current,
                          server_url: event.target.value.trim() || undefined,
                        }))
                      }
                      className={CONTROL_BASE}
                      placeholder="https://example.com/mcp"
                    />
                    <p className={HELP_TEXT}>
                      Remote MCP server endpoint (streamable HTTP or SSE).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 md:col-span-2">
                    <label
                      className={FIELD_LABEL}
                      htmlFor={`mcp-connector-${index}`}
                    >
                      <span>Connector ID</span>
                      <span className={FIELD_OPTIONAL}>(Required)</span>
                    </label>
                    <input
                      id={`mcp-connector-${index}`}
                      value={tool.connector_id || ""}
                      onChange={(event) =>
                        updateTool(index, (current) => ({
                          ...current,
                          connector_id: event.target.value.trim() || undefined,
                        }))
                      }
                      className={CONTROL_BASE}
                      placeholder="connector_xxx"
                    />
                    <p className={HELP_TEXT}>
                      Connector identifier for hosted MCP integrations.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5 md:col-span-2">
                  <label
                    className={FIELD_LABEL}
                    htmlFor={`mcp-auth-${index}`}
                  >
                    <span>Authorization</span>
                    <span className={FIELD_OPTIONAL}>(Optional)</span>
                  </label>
                  <input
                    id={`mcp-auth-${index}`}
                    value={tool.authorization || ""}
                    onChange={(event) => {
                      let value = event.target.value;
                      // If the user pastes a raw Notion token, automatically format it as a Bearer token
                      if (value.trim().startsWith("ntn_") && !value.toLowerCase().includes("bearer")) {
                        value = `Bearer ${value.trim()}`;
                      }
                      updateTool(index, (current) => ({
                        ...current,
                        authorization: value,
                      }));
                    }}
                    className={CONTROL_BASE}
                    placeholder="Bearer <token>"
                  />
                  <p className={HELP_TEXT}>
                    OAuth token or API key header value if the server requires it.
                  </p>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label
                    className={FIELD_LABEL}
                    htmlFor={`mcp-tools-${index}`}
                  >
                    <span>Allowed tools</span>
                    <span className={FIELD_OPTIONAL}>(Optional)</span>
                  </label>
                  <input
                    id={`mcp-tools-${index}`}
                    value={formatAllowedTools(tool.allowed_tools)}
                    onChange={(event) =>
                      updateTool(index, (current) => ({
                        ...current,
                        allowed_tools: parseAllowedTools(event.target.value),
                      }))
                    }
                    className={CONTROL_BASE}
                    placeholder="e.g. search, open, *"
                  />
                  <p className={HELP_TEXT}>
                    Comma-separated list to filter tools; use * to allow all.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    className={FIELD_LABEL}
                    htmlFor={`mcp-approval-${index}`}
                  >
                    <span>Require approval</span>
                    <span className={FIELD_OPTIONAL}>(Optional)</span>
                  </label>
                  <Select
                    id={`mcp-approval-${index}`}
                    value={getApprovalValue(tool.require_approval)}
                    onChange={(nextValue) =>
                      updateTool(index, (current) => ({
                        ...current,
                        require_approval:
                          nextValue === "always" || nextValue === "never"
                            ? (nextValue as McpRequireApproval)
                            : undefined,
                      }))
                    }
                    className={SELECT_CONTROL}
                  >
                    <option value="">Default behavior</option>
                    <option value="always">Always require approval</option>
                    <option value="never">Never require approval</option>
                  </Select>
                  <p className={HELP_TEXT}>
                    Controls whether MCP tool calls pause for approval.
                  </p>
                </div>
              </div>

              {isMissingConnection && (
                <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-xs text-amber-700">
                  Add a server URL or connector ID to enable this MCP server.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
