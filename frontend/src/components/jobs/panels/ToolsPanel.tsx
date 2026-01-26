"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import type {
  McpRequireApproval,
  McpToolConfig,
  Tool,
  ToolType,
} from "@/types/workflow";
import type {
  EditablePanel,
  ToolDetail,
} from "@/components/jobs/StepMetaTypes";
import {
  formatAllowedTools,
  getApprovalValue,
  getToolDisplayLabel,
  isMcpTool,
  parseAllowedTools,
} from "./utils";

type ToolsPanelProps = {
  id: string;
  toolDetails: ToolDetail[];
  editPanel?: EditablePanel | null;
  draftTools?: Tool[];
  onDraftToolsChange?: (tools: Tool[]) => void;
  renderEditButton?: (panel: EditablePanel) => JSX.Element | null;
  onCancel?: () => void;
  onSave?: () => void;
  isUpdating?: boolean;
  isToolsDirty?: boolean;
};

const AVAILABLE_TOOLS: ToolType[] = [
  "web_search",
  "computer_use_preview",
  "file_search",
  "code_interpreter",
  "shell",
  "image_generation",
];

const MCP_CATALOG = [
  { id: "browser", label: "Browser", serverLabel: "browser" },
  { id: "openai", label: "OpenAI", serverLabel: "openai" },
  { id: "openai-tools", label: "OpenAI Tools", serverLabel: "openai_tools" },
];

export function ToolsPanel({
  id,
  toolDetails,
  editPanel,
  draftTools,
  onDraftToolsChange,
  renderEditButton,
  onCancel,
  onSave,
  isUpdating,
  isToolsDirty,
}: ToolsPanelProps) {
  const [newToolName, setNewToolName] = useState<"" | ToolType>("");
  const [mcpCatalogSelection, setMcpCatalogSelection] = useState("");

  const handleAddTool = () => {
    if (!newToolName || !onDraftToolsChange) return;
    const currentTools = draftTools || [];
    // Check if tool already exists (simple string check)
    if (
      currentTools.some((tool) => {
        if (typeof tool === "string") {
          return tool === newToolName;
        }
        const name =
          "name" in tool && typeof tool.name === "string" ? tool.name : null;
        return (
          tool.type === newToolName ||
          (typeof name === "string" && name === newToolName)
        );
      })
    ) {
      return;
    }
    onDraftToolsChange([...currentTools, newToolName]);
    setNewToolName("");
  };

  const handleAddMcpCustom = () => {
    if (!onDraftToolsChange) return;
    const currentTools = draftTools || [];
    onDraftToolsChange([
      ...currentTools,
      {
        type: "mcp",
        server_label: "",
      },
    ]);
  };

  const handleAddMcpFromCatalog = () => {
    if (!onDraftToolsChange || !mcpCatalogSelection) return;
    const entry = MCP_CATALOG.find((item) => item.id === mcpCatalogSelection);
    if (!entry) return;
    const currentTools = draftTools || [];
    onDraftToolsChange([
      ...currentTools,
      {
        type: "mcp",
        server_label: entry.serverLabel,
      },
    ]);
    setMcpCatalogSelection("");
  };

  const handleRemoveTool = (index: number) => {
    if (!onDraftToolsChange) return;
    const currentTools = draftTools || [];
    const nextTools = [...currentTools];
    nextTools.splice(index, 1);
    onDraftToolsChange(nextTools);
  };

  const updateToolAt = (index: number, updater: (tool: Tool) => Tool) => {
    if (!onDraftToolsChange) return;
    const currentTools = draftTools || [];
    const nextTools = [...currentTools];
    nextTools[index] = updater(nextTools[index]);
    onDraftToolsChange(nextTools);
  };

  const updateMcpToolAt = (
    index: number,
    updater: (tool: McpToolConfig) => McpToolConfig,
  ) => {
    updateToolAt(index, (current) =>
      isMcpTool(current) ? updater(current) : current,
    );
  };

  return (
    <div
      id={id}
      className="rounded-lg border border-slate-200/70 bg-slate-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-slate-100/60 dark:border-slate-800/50 dark:bg-slate-950/25 dark:ring-slate-900/40 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
          Tools
        </div>
        {renderEditButton && renderEditButton("tools")}
      </div>
      
      {editPanel === "tools" && onDraftToolsChange ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {(draftTools || []).map((tool, idx) => {
              const name = getToolDisplayLabel(tool);
              const isMcp = isMcpTool(tool);
              const mcpTool = isMcp ? tool : null;
              const connectionType =
                isMcp && mcpTool?.connector_id ? "connector" : "remote";
              const isMissingConnection =
                isMcp && !mcpTool?.server_url && !mcpTool?.connector_id;
              return (
                <div
                  key={idx}
                  className="rounded-md border border-border/60 bg-background/70 px-2 py-2 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTool(idx)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded"
                      title="Remove tool"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isMcp && mcpTool && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Server label
                        </label>
                        <Input
                          value={mcpTool.server_label ?? ""}
                          onChange={(event) =>
                            updateMcpToolAt(idx, (current) => ({
                              ...current,
                              server_label: event.target.value,
                            }))
                          }
                          className="h-8"
                          placeholder="browser"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Connection type
                        </label>
                        <Select
                          value={connectionType}
                          onChange={(nextValue) =>
                            updateMcpToolAt(idx, (current) => ({
                              ...current,
                              server_url:
                                nextValue === "remote" ? current.server_url : undefined,
                              connector_id:
                                nextValue === "connector"
                                  ? current.connector_id
                                  : undefined,
                            }))
                          }
                          className="h-8"
                        >
                          <option value="remote">Remote server URL</option>
                          <option value="connector">Connector ID</option>
                        </Select>
                      </div>

                      {connectionType === "remote" ? (
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Server URL
                          </label>
                          <Input
                            value={mcpTool.server_url ?? ""}
                            onChange={(event) =>
                              updateMcpToolAt(idx, (current) => ({
                                ...current,
                                server_url: event.target.value.trim() || undefined,
                              }))
                            }
                            className="h-8"
                            placeholder="https://example.com/mcp"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Connector ID
                          </label>
                          <Input
                            value={mcpTool.connector_id ?? ""}
                            onChange={(event) =>
                              updateMcpToolAt(idx, (current) => ({
                                ...current,
                                connector_id: event.target.value.trim() || undefined,
                              }))
                            }
                            className="h-8"
                            placeholder="connector_xxx"
                          />
                        </div>
                      )}

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Authorization
                        </label>
                        <Input
                          value={mcpTool.authorization ?? ""}
                          onChange={(event) =>
                            updateMcpToolAt(idx, (current) => ({
                              ...current,
                              authorization: event.target.value,
                            }))
                          }
                          className="h-8"
                          placeholder="Bearer <token>"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Allowed tools
                        </label>
                        <Input
                          value={formatAllowedTools(
                            Array.isArray(mcpTool.allowed_tools)
                              ? mcpTool.allowed_tools
                              : undefined,
                          )}
                          onChange={(event) =>
                            updateMcpToolAt(idx, (current) => ({
                              ...current,
                              allowed_tools: parseAllowedTools(event.target.value),
                            }))
                          }
                          className="h-8"
                          placeholder="search, open, *"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Require approval
                        </label>
                        <Select
                          value={getApprovalValue(
                            mcpTool.require_approval,
                          )}
                          onChange={(nextValue) =>
                            updateMcpToolAt(idx, (current) => ({
                              ...current,
                              require_approval:
                                nextValue === "always" || nextValue === "never"
                                  ? (nextValue as McpRequireApproval)
                                  : undefined,
                            }))
                          }
                          className="h-8"
                        >
                          <option value="">Default behavior</option>
                          <option value="always">Always require approval</option>
                          <option value="never">Never require approval</option>
                        </Select>
                      </div>
                    </div>
                  )}

                  {isMissingConnection && (
                    <div className="rounded-md border border-amber-200/70 bg-amber-50/50 px-2 py-1 text-[11px] text-amber-700">
                      Add a server URL or connector ID to enable this MCP server.
                    </div>
                  )}
                </div>
              );
            })}
            {(draftTools || []).length === 0 && (
              <div className="text-muted-foreground italic px-2">No tools selected</div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Select
              value={newToolName}
              onChange={(val) => setNewToolName((val as ToolType) || "")}
              className="h-8 w-full sm:flex-1"
              placeholder="Select tool to add..."
            >
              <option value="">Select tool...</option>
              {AVAILABLE_TOOLS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddTool}
              disabled={!newToolName}
              className="h-8 w-full sm:w-auto px-2"
            >
              <FiPlus className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/70 px-2 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              MCP servers
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select
                value={mcpCatalogSelection}
                onChange={(val) => setMcpCatalogSelection(val)}
                className="h-8 w-full sm:flex-1"
              >
                <option value="">Add from catalog...</option>
                {MCP_CATALOG.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddMcpFromCatalog}
                disabled={!mcpCatalogSelection}
                className="h-8 w-full sm:w-auto px-2"
              >
                <FiPlus className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleAddMcpCustom}
                className="h-8 w-full sm:w-auto px-2"
              >
                Custom
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={!isToolsDirty || isUpdating}
              isLoading={isUpdating}
            >
              Update
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {toolDetails.map((tool) => (
            <div
              key={tool.id}
              className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 space-y-2"
            >
              <div className="text-xs font-semibold text-foreground">
                {tool.name}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Configuration
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px] font-mono whitespace-pre-wrap break-words">
                {tool.config ? (
                  JSON.stringify(tool.config, null, 2)
                ) : (
                  <span className="text-muted-foreground">No configuration</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
