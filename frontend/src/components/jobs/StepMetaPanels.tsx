"use client";

import { useMemo, useState } from "react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { useAIModelOptions } from "@/hooks/useAIModelOptions";
import { REASONING_EFFORT_LABELS, SERVICE_TIER_LABELS } from "@/utils/stepMeta";
import type {
  AIModel,
  ImageGenerationSettings,
  McpRequireApproval,
  McpToolConfig,
  ServiceTier,
  Tool,
  ToolType,
} from "@/types/workflow";
import type {
  DependencyPreview,
  DetailRow,
  EditablePanel,
  ImageSettingRow,
  ModelRestriction,
  ReasoningEffortOption,
  ToolDetail,
} from "@/components/jobs/StepMetaTypes";

const getOutputText = (value: unknown) => {
  if (value === null || value === undefined) return "No output yet";
  if (typeof value === "string") {
    return value.trim() || "No output yet";
  }
  const text = JSON.stringify(value, null, 2);
  return text || "No output yet";
};

const isMarkdownLike = (value: string) =>
  /(^|\n)#{1,6}\s/.test(value) ||
  /```/.test(value) ||
  /\*\*[^*]+\*\*/.test(value) ||
  /__[^_]+__/.test(value) ||
  /(^|\n)\s*[-*+]\s+/.test(value) ||
  /(^|\n)\s*\d+\.\s+/.test(value) ||
  /\[[^\]]+\]\([^)]+\)/.test(value);

const renderDependencyOutputPreview = (value: unknown) => {
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

function DetailRows({ rows }: { rows: DetailRow[] }) {
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

type ModelDetailsPanelProps = {
  id: string;
  editPanel: EditablePanel | null;
  draftModel: AIModel;
  onDraftModelChange: (model: AIModel) => void;
  modelRestriction: ModelRestriction;
  renderEditButton: (panel: EditablePanel) => JSX.Element | null;
  onCancel: () => void;
  onSave: () => void;
  isUpdating: boolean;
  isModelDirty: boolean;
  isModelAllowed: boolean;
  modelDetailsRows: DetailRow[];
};

export function ModelDetailsPanel({
  id,
  editPanel,
  draftModel,
  onDraftModelChange,
  modelRestriction,
  renderEditButton,
  onCancel,
  onSave,
  isUpdating,
  isModelDirty,
  isModelAllowed,
  modelDetailsRows,
}: ModelDetailsPanelProps) {
  const {
    options: modelOptions,
    loading: aiModelsLoading,
    error: aiModelsError,
  } = useAIModelOptions({ currentModel: draftModel });

  return (
    <div
      id={id}
      className="rounded-lg border border-purple-200/70 bg-purple-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-purple-100/60 dark:border-purple-800/50 dark:bg-purple-950/30 dark:ring-purple-900/40 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-200">
          Model details
        </div>
        {renderEditButton("model")}
      </div>
      {editPanel === "model" ? (
        <div className="space-y-2">
          <Select
            value={draftModel}
            onChange={(nextValue) =>
              onDraftModelChange(nextValue as AIModel)
            }
            className="h-9"
            aria-label="Select model"
            disabled={aiModelsLoading}
          >
            {aiModelsLoading && <option value="">Loading models...</option>}
            {modelOptions.map((model) => {
              const isAllowed =
                !modelRestriction.allowedModels ||
                modelRestriction.allowedModels.has(model.value as AIModel);
              return (
                <option
                  key={model.value}
                  value={model.value}
                  disabled={!isAllowed}
                >
                  {model.label}
                </option>
              );
            })}
          </Select>
          {aiModelsError && !aiModelsLoading && (
            <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px] text-muted-foreground">
              Unable to load models. Showing current selection.
            </div>
          )}
          {modelRestriction.reason && (
            <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px] text-muted-foreground">
              {modelRestriction.reason}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
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
              disabled={!isModelDirty || !isModelAllowed || isUpdating}
              isLoading={isUpdating}
            >
              Update
            </Button>
          </div>
        </div>
      ) : (
        <DetailRows rows={modelDetailsRows} />
      )}
    </div>
  );
}

type SpeedDetailsPanelProps = {
  id: string;
  editPanel: EditablePanel | null;
  draftServiceTier: ServiceTier;
  onDraftServiceTierChange: (value: ServiceTier) => void;
  renderEditButton: (panel: EditablePanel) => JSX.Element | null;
  onCancel: () => void;
  onSave: () => void;
  isUpdating: boolean;
  isServiceTierDirty: boolean;
  speedDetailsRows: DetailRow[];
};

export function SpeedDetailsPanel({
  id,
  editPanel,
  draftServiceTier,
  onDraftServiceTierChange,
  renderEditButton,
  onCancel,
  onSave,
  isUpdating,
  isServiceTierDirty,
  speedDetailsRows,
}: SpeedDetailsPanelProps) {
  return (
    <div
      id={id}
      className="rounded-lg border border-amber-200/70 bg-amber-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-amber-100/60 dark:border-amber-800/50 dark:bg-amber-950/25 dark:ring-amber-900/40 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
          Service tier details
        </div>
        {renderEditButton("speed")}
      </div>
      {editPanel === "speed" ? (
        <div className="space-y-2">
          <Select
            value={draftServiceTier}
            onChange={(nextValue) =>
              onDraftServiceTierChange(nextValue as ServiceTier)
            }
            className="h-9"
            aria-label="Select service tier"
          >
            <option value="auto">Auto</option>
            {Object.entries(SERVICE_TIER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-end gap-2">
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
              disabled={!isServiceTierDirty || isUpdating}
              isLoading={isUpdating}
            >
              Update
            </Button>
          </div>
        </div>
      ) : (
        <DetailRows rows={speedDetailsRows} />
      )}
    </div>
  );
}

type ReasoningDetailsPanelProps = {
  id: string;
  editPanel: EditablePanel | null;
  draftReasoningEffort: ReasoningEffortOption;
  onDraftReasoningEffortChange: (value: ReasoningEffortOption) => void;
  renderEditButton: (panel: EditablePanel) => JSX.Element | null;
  onCancel: () => void;
  onSave: () => void;
  isUpdating: boolean;
  isReasoningDirty: boolean;
  reasoningDetailsRows: DetailRow[];
};

export function ReasoningDetailsPanel({
  id,
  editPanel,
  draftReasoningEffort,
  onDraftReasoningEffortChange,
  renderEditButton,
  onCancel,
  onSave,
  isUpdating,
  isReasoningDirty,
  reasoningDetailsRows,
}: ReasoningDetailsPanelProps) {
  return (
    <div
      id={id}
      className="rounded-lg border border-indigo-200/70 bg-indigo-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-indigo-100/60 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:ring-indigo-900/40 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
          Reasoning details
        </div>
        {renderEditButton("reasoning")}
      </div>
      {editPanel === "reasoning" ? (
        <div className="space-y-2">
          <Select
            value={draftReasoningEffort}
            onChange={(nextValue) =>
              onDraftReasoningEffortChange(
                nextValue as ReasoningEffortOption,
              )
            }
            className="h-9"
            aria-label="Select reasoning effort"
          >
            <option value="auto">Auto</option>
            {Object.entries(REASONING_EFFORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-end gap-2">
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
              disabled={!isReasoningDirty || isUpdating}
              isLoading={isUpdating}
            >
              Update
            </Button>
          </div>
        </div>
      ) : (
        <DetailRows rows={reasoningDetailsRows} />
      )}
    </div>
  );
}

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

const isMcpTool = (tool: Tool): tool is McpToolConfig =>
  Boolean(tool) &&
  typeof tool === "object" &&
  !Array.isArray(tool) &&
  tool.type === "mcp";

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

const getApprovalValue = (value?: McpRequireApproval): "" | McpRequireApproval => {
  if (value === "always" || value === "never") return value;
  return "";
};

const getMcpDisplayLabel = (tool: McpToolConfig): string => {
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

const getToolDisplayLabel = (tool: Tool): string => {
  if (typeof tool === "string") return tool;
  if (tool.type === "mcp") {
    return getMcpDisplayLabel(tool);
  }
  if ("name" in tool && typeof tool.name === "string" && tool.name.trim()) {
    return tool.name.trim();
  }
  return tool.type || "Unknown";
};

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

type ImageSettingsPanelProps = {
  id: string;
  imageSettingsSource: string;
  toolChoice: string | null;
  imageSettingsRows: ImageSettingRow[];
  editPanel: EditablePanel | null;
  draftImageSettings: ImageGenerationSettings;
  onDraftImageSettingsChange: (
    field: keyof ImageGenerationSettings,
    value: ImageGenerationSettings[keyof ImageGenerationSettings],
  ) => void;
  renderEditButton: (panel: EditablePanel) => JSX.Element | null;
  onCancel: () => void;
  onSave: () => void;
  isUpdating: boolean;
  isImageSettingsDirty: boolean;
};

export function ImageSettingsPanel({
  id,
  imageSettingsSource,
  toolChoice,
  imageSettingsRows,
  editPanel,
  draftImageSettings,
  onDraftImageSettingsChange,
  renderEditButton,
  onCancel,
  onSave,
  isUpdating,
  isImageSettingsDirty,
}: ImageSettingsPanelProps) {
  const showCompression =
    draftImageSettings.format === "jpeg" || draftImageSettings.format === "webp";

  return (
    <div
      id={id}
      className="rounded-lg border border-indigo-200/70 bg-indigo-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-indigo-100/60 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:ring-indigo-900/40 space-y-3"
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
            Image generation settings
          </div>
          {renderEditButton("image")}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full border border-indigo-200/70 bg-indigo-100/70 px-2 py-0.5 font-medium text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-900/40 dark:text-indigo-200">
            Source: {imageSettingsSource}
          </span>
          {toolChoice && toolChoice !== "auto" && (
            <span className="rounded-full border border-indigo-200/70 bg-indigo-100/70 px-2 py-0.5 font-medium text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-900/40 dark:text-indigo-200">
              Tool choice: {toolChoice}
            </span>
          )}
        </div>
      </div>
      {editPanel === "image" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Model
              </label>
              <Select
                value={draftImageSettings.model || "gpt-image-1.5"}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange("model", nextValue)
                }
                className="h-9"
                aria-label="Select image model"
              >
                <option value="gpt-image-1.5">gpt-image-1.5</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Size
              </label>
              <Select
                value={draftImageSettings.size || "auto"}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange(
                    "size",
                    nextValue as ImageGenerationSettings["size"],
                  )
                }
                className="h-9"
                aria-label="Select image size"
              >
                <option value="auto">Auto (default)</option>
                <option value="1024x1024">1024x1024 (Square)</option>
                <option value="1024x1536">1024x1536 (Portrait)</option>
                <option value="1536x1024">1536x1024 (Landscape)</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Quality
              </label>
              <Select
                value={draftImageSettings.quality || "auto"}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange(
                    "quality",
                    nextValue as ImageGenerationSettings["quality"],
                  )
                }
                className="h-9"
                aria-label="Select image quality"
              >
                <option value="auto">Auto (default)</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Format
              </label>
              <Select
                value={draftImageSettings.format || ""}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange(
                    "format",
                    (nextValue || undefined) as ImageGenerationSettings["format"],
                  )
                }
                className="h-9"
                aria-label="Select image format"
              >
                <option value="">Default (PNG)</option>
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Background
              </label>
              <Select
                value={draftImageSettings.background || "auto"}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange(
                    "background",
                    nextValue as ImageGenerationSettings["background"],
                  )
                }
                className="h-9"
                aria-label="Select background mode"
              >
                <option value="auto">Auto (default)</option>
                <option value="transparent">Transparent</option>
                <option value="opaque">Opaque</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Input fidelity
              </label>
              <Select
                value={draftImageSettings.input_fidelity || ""}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange(
                    "input_fidelity",
                    (nextValue || undefined) as ImageGenerationSettings["input_fidelity"],
                  )
                }
                className="h-9"
                aria-label="Select input fidelity"
              >
                <option value="">Default</option>
                <option value="low">Low</option>
                <option value="high">High</option>
              </Select>
            </div>

            {showCompression && (
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Compression
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={
                    draftImageSettings.compression !== undefined
                      ? String(draftImageSettings.compression)
                      : ""
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    onDraftImageSettingsChange(
                      "compression",
                      value === "" ? undefined : Number(value),
                    );
                  }}
                  placeholder="0-100"
                  className="h-9"
                  aria-label="Set compression"
                />
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
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
              disabled={!isImageSettingsDirty || isUpdating}
              isLoading={isUpdating}
            >
              Update
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {imageSettingsRows.map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between rounded-md border px-2 py-1 ${
                row.highlighted && !row.muted
                  ? "border-indigo-200/70 bg-indigo-100/60 dark:border-indigo-800/60 dark:bg-indigo-900/40"
                  : "border-border/60 bg-background/70"
              }`}
            >
              <span className="text-[11px] font-medium text-muted-foreground">
                {row.label}
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  row.muted
                    ? "text-muted-foreground"
                    : row.highlighted
                      ? "text-indigo-700 dark:text-indigo-200"
                      : "text-foreground"
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ContextPanelProps = {
  id: string;
  dependencyPreviews: DependencyPreview[];
  instructions?: string;
  editPanel?: EditablePanel | null;
  draftInstructions?: string;
  onDraftInstructionsChange?: (value: string) => void;
  renderEditButton?: (panel: EditablePanel) => JSX.Element | null;
  onCancel?: () => void;
  onSave?: () => void;
  isUpdating?: boolean;
  isInstructionsDirty?: boolean;
};

export function ContextPanel({
  id,
  dependencyPreviews,
  instructions,
  editPanel,
  draftInstructions,
  onDraftInstructionsChange,
  renderEditButton,
  onCancel,
  onSave,
  isUpdating,
  isInstructionsDirty,
}: ContextPanelProps) {
  const hasDependencies = dependencyPreviews.length > 0;

  return (
    <div
      id={id}
      className="w-full max-w-full overflow-hidden rounded-lg border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-teal-100/60 dark:border-teal-800/50 dark:bg-teal-950/25 dark:ring-teal-900/40 space-y-3"
    >
      {hasDependencies && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Input
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Steps
            </div>
            <div className="grid grid-flow-col auto-cols-[85vw] sm:auto-cols-[16rem] grid-rows-1 gap-2 sm:gap-3 overflow-x-auto pb-2 px-2 sm:-mx-1 sm:px-1 snap-x snap-mandatory scrollbar-hide">
              {dependencyPreviews.map(({ dependency, step: dependencyStep }) => (
                <div
                  key={`dependency-context-${dependencyStep.step_order ?? dependency.index}`}
                  title={dependency.label}
                  className="group flex w-full sm:w-64 flex-col text-left snap-start"
                >
                  <div className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm transition group-hover:shadow-md">
                    <div className="aspect-[3/4] w-full overflow-hidden">
                      <div className="h-full w-full overflow-y-auto scrollbar-hide-until-hover p-4 text-[11px] text-foreground/90">
                        {renderDependencyOutputPreview(dependencyStep.output)}
                      </div>
                    </div>
                    <div className="border-t border-border/60 bg-background/80 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground line-clamp-1">
                          {dependency.label}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Instructions
          </div>
          {renderEditButton && renderEditButton("context")}
        </div>
        {editPanel === "context" && onDraftInstructionsChange ? (
          <div className="space-y-2">
            <Textarea
              value={draftInstructions}
              onChange={(e) => onDraftInstructionsChange(e.target.value)}
              className="min-h-[100px] text-xs font-mono"
              placeholder="Enter instructions..."
            />
            <div className="flex items-center justify-end gap-2">
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
                disabled={!isInstructionsDirty || isUpdating}
                isLoading={isUpdating}
              >
                Update
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px] whitespace-pre-wrap text-foreground/90">
            {instructions || "No instructions available"}
          </div>
        )}
      </div>
    </div>
  );
}
