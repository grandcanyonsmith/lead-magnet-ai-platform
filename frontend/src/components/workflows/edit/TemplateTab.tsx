"use client";

import {
  Save,
  Eye,
  Code,
  Copy,
  Monitor,
  Tablet,
  Smartphone,
  Zap,
  MousePointer2,
  X,
} from "lucide-react";
import { TemplateData } from "@/hooks/useTemplateEdit";
import {
  extractPlaceholders,
  formatHTML,
  getPreviewHtml,
  getDevicePreviewWidth,
  getSelectionScript,
} from "@/utils/templateUtils";
import { useState, useEffect, useRef } from "react";

interface TemplateTabProps {
  templateData: TemplateData;
  templateLoading: boolean;
  detectedPlaceholders: string[];
  templateViewMode: "split" | "editor" | "preview";
  devicePreviewSize: "mobile" | "tablet" | "desktop";
  previewKey: number;
  refining: boolean;
  generationStatus: string | null;
  editPrompt: string;
  selectedSelectors?: string[];
  onSelectionChange?: (selectors: string[]) => void;
  onTemplateChange: (field: string, value: any) => void;
  onHtmlChange: (html: string) => void;
  onViewModeChange: (mode: "split" | "editor" | "preview") => void;
  onDeviceSizeChange: (size: "mobile" | "tablet" | "desktop") => void;
  onInsertPlaceholder: (placeholder: string) => void;
  onRefine: () => Promise<{ error?: string; success?: boolean }>;
  onEditPromptChange: (prompt: string) => void;
  onFormatHtml: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitting: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  history?: any[];
  historyIndex?: number;
  onJumpToHistory?: (index: number) => void;
  onCommitChange?: (html: string) => void;
}

export function TemplateTab({
  templateData,
  templateLoading,
  detectedPlaceholders,
  templateViewMode,
  devicePreviewSize,
  previewKey,
  refining,
  generationStatus,
  editPrompt,
  selectedSelectors = [],
  onSelectionChange,
  onTemplateChange,
  onHtmlChange,
  onViewModeChange,
  onDeviceSizeChange,
  onInsertPlaceholder,
  onRefine,
  onEditPromptChange,
  onFormatHtml,
  onSubmit,
  onCancel,
  submitting,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  history,
  historyIndex,
  onJumpToHistory,
  onCommitChange,
}: TemplateTabProps) {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data.type === "SELECTION_CHANGED") {
        onSelectionChange?.(event.data.selectors);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onSelectionChange]);

  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "TOGGLE_SELECT_MODE", enabled: isSelectMode },
        "*",
      );
    }
  }, [isSelectMode, previewKey]);

  const handleRefine = async () => {
    const result = await onRefine();
    if (result.error) {
      // Error handling would be done by parent
      return;
    }
  };

  return (
    <div className="space-y-6">
      {templateLoading && (
        <div className="bg-white dark:bg-card rounded-lg shadow p-12 text-center border border-gray-200 dark:border-border">
          <p className="text-gray-600 dark:text-muted-foreground">Loading template...</p>
        </div>
      )}

      {!templateLoading && (
        <>
          {/* Template Metadata */}
          <div className="bg-white dark:bg-card rounded-lg shadow p-6 space-y-4 border border-gray-200 dark:border-border">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                Template Name <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={templateData.template_name}
                onChange={(e) =>
                  onTemplateChange("template_name", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary"
                placeholder="Email Template"
                maxLength={200}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                Description
              </label>
              <textarea
                value={templateData.template_description}
                onChange={(e) =>
                  onTemplateChange("template_description", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary"
                placeholder="Describe what this template is used for..."
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>

          {/* View Mode Toggle */}
          {templateData.html_content.trim() && (
            <div className="bg-white dark:bg-card rounded-lg shadow p-4 flex items-center justify-between border border-gray-200 dark:border-border">
              <div className="flex items-center space-x-3">
                <Eye className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
                <span className="text-sm font-medium text-gray-700 dark:text-foreground">
                  View Mode
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => onViewModeChange("split")}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    templateViewMode === "split"
                      ? "bg-primary-600 dark:bg-primary text-white"
                      : "bg-gray-100 dark:bg-secondary text-gray-700 dark:text-foreground hover:bg-gray-200 dark:hover:bg-secondary/80"
                  }`}
                >
                  Split
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange("editor")}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    templateViewMode === "editor"
                      ? "bg-primary-600 dark:bg-primary text-white"
                      : "bg-gray-100 dark:bg-secondary text-gray-700 dark:text-foreground hover:bg-gray-200 dark:hover:bg-secondary/80"
                  }`}
                >
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange("preview")}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    templateViewMode === "preview"
                      ? "bg-primary-600 dark:bg-primary text-white"
                      : "bg-gray-100 dark:bg-secondary text-gray-700 dark:text-foreground hover:bg-gray-200 dark:hover:bg-secondary/80"
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>
          )}

          {/* Split View: Editor and Preview */}
          <div
            className={`grid gap-6 ${templateViewMode === "split" && templateData.html_content.trim() ? "lg:grid-cols-2" : "grid-cols-1"}`}
          >
            {/* HTML Editor */}
            {(templateViewMode === "split" ||
              templateViewMode === "editor") && (
              <div className="bg-white dark:bg-card rounded-lg shadow border border-gray-200 dark:border-border">
                <div className="border-b border-gray-200 dark:border-border px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-secondary/50">
                  <div className="flex items-center space-x-3">
                    <Code className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground">
                      HTML Editor
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={onFormatHtml}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-secondary hover:bg-gray-200 dark:hover:bg-secondary/80 rounded text-gray-700 dark:text-foreground transition-colors"
                      title="Format HTML"
                    >
                      Format
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gray-50 dark:bg-secondary/50 border-r border-gray-200 dark:border-border flex flex-col items-center py-2 text-xs text-gray-400 dark:text-muted-foreground font-mono">
                    {templateData.html_content.split("\n").map((_, i) => (
                      <div key={i} className="leading-6">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={templateData.html_content}
                    onChange={(e) => onHtmlChange(e.target.value)}
                    className="w-full px-3 py-2 pl-12 border-0 bg-white dark:bg-card text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary font-mono text-sm leading-6 resize-none"
                    placeholder={`<!DOCTYPE html>
<html>
<head>
  <title>Lead Magnet</title>
</head>
<body>
  <h1>{{TITLE}}</h1>
  <div>{{CONTENT}}</div>
</body>
</html>`}
                    rows={20}
                    required
                    style={{ minHeight: "500px" }}
                  />
                </div>
                <div className="border-t border-gray-200 dark:border-border px-4 py-3 bg-gray-50 dark:bg-secondary/50">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-600 dark:text-muted-foreground">
                        Placeholders:
                      </span>
                      {detectedPlaceholders.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {detectedPlaceholders.map((placeholder) => (
                            <button
                              key={placeholder}
                              type="button"
                              onClick={() => onInsertPlaceholder(placeholder)}
                              className="px-2 py-0.5 bg-primary-100 dark:bg-primary/20 text-primary-700 dark:text-primary rounded text-xs font-mono hover:bg-primary-200 dark:hover:bg-primary/30 transition-colors flex items-center"
                              title={`Insert {{${placeholder}}}`}
                            >
                              {`{{${placeholder}}}`}
                              <Copy className="w-3 h-3 ml-1" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-yellow-600 dark:text-yellow-500">
                          None detected
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-muted-foreground">
                      Use{" "}
                      <code className="px-1 py-0.5 bg-gray-200 dark:bg-secondary rounded text-gray-900 dark:text-foreground">
                        &#123;&#123;NAME&#125;&#125;
                      </code>{" "}
                      for placeholders
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Panel */}
            {(templateViewMode === "split" || templateViewMode === "preview") &&
              templateData.html_content.trim() && (
                <div className="bg-white dark:bg-card rounded-lg shadow border border-gray-200 dark:border-border">
                  <div className="border-b border-gray-200 dark:border-border px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-secondary/50">
                    <div className="flex items-center space-x-3">
                      <Eye className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground">
                        Preview
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsSelectMode(!isSelectMode)}
                        className={`p-2 rounded transition-colors touch-target flex items-center gap-2 ${
                          isSelectMode
                            ? "bg-blue-600 dark:bg-blue-500 text-white"
                            : "bg-gray-100 dark:bg-secondary text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-secondary/80"
                        }`}
                        title="Select Elements"
                      >
                        <MousePointer2 className="w-4 h-4" />
                        <span className="text-xs font-medium hidden sm:inline">
                          {isSelectMode ? "Selecting..." : "Select"}
                        </span>
                      </button>
                      <div className="w-px h-6 bg-gray-300 dark:bg-border mx-1"></div>
                      <button
                        type="button"
                        onClick={() => onDeviceSizeChange("mobile")}
                        className={`p-2 rounded transition-colors touch-target ${
                          devicePreviewSize === "mobile"
                            ? "bg-primary-600 dark:bg-primary text-white"
                            : "bg-gray-100 dark:bg-secondary text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-secondary/80"
                        }`}
                        title="Mobile (375px)"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeviceSizeChange("tablet")}
                        className={`p-2 rounded transition-colors touch-target ${
                          devicePreviewSize === "tablet"
                            ? "bg-primary-600 dark:bg-primary text-white"
                            : "bg-gray-100 dark:bg-secondary text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-secondary/80"
                        }`}
                        title="Tablet (768px)"
                      >
                        <Tablet className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeviceSizeChange("desktop")}
                        className={`p-2 rounded transition-colors touch-target ${
                          devicePreviewSize === "desktop"
                            ? "bg-primary-600 dark:bg-primary text-white"
                            : "bg-gray-100 dark:bg-secondary text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-secondary/80"
                        }`}
                        title="Desktop (Full Width)"
                      >
                        <Monitor className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div
                    className="bg-gray-100 dark:bg-secondary/30 p-4 flex justify-center"
                    style={{ minHeight: "500px" }}
                  >
                    <div
                      className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg overflow-auto"
                      style={{
                        width: getDevicePreviewWidth(devicePreviewSize),
                        maxWidth: "100%",
                        height:
                          devicePreviewSize === "desktop" ? "600px" : "800px",
                      }}
                    >
                      <iframe
                        ref={iframeRef}
                        key={`preview-${previewKey}-${templateData.html_content.length}-${devicePreviewSize}`}
                        srcDoc={
                          getPreviewHtml(templateData.html_content) +
                          getSelectionScript()
                        }
                        className="w-full h-full border-0"
                        title="HTML Preview"
                        sandbox="allow-scripts allow-popups"
                      />
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* AI Refine Section */}
          {templateData.html_content.trim() && (
            <div className="bg-white dark:bg-card rounded-lg shadow border border-green-200 dark:border-green-800">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-border bg-gradient-to-r from-green-50 dark:from-green-900/20 to-teal-50 dark:to-teal-900/20">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground">
                    AI Refine
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-muted-foreground">(Optional)</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {selectedSelectors && selectedSelectors.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2 flex items-center justify-between">
                    <div className="flex items-center text-sm text-blue-700 dark:text-blue-300">
                      <MousePointer2 className="w-4 h-4 mr-2" />
                      <span className="font-medium">
                        {selectedSelectors.length} elements selected
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectionChange?.([])}
                      className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-1"
                      title="Clear Selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => onEditPromptChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 disabled:bg-gray-100 dark:disabled:bg-secondary disabled:cursor-not-allowed text-sm"
                    placeholder="e.g., Make colors more vibrant, modernize layout, add spacing..."
                    rows={3}
                    disabled={refining}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Suggestions:</span>
                    {[
                      "Make colors more vibrant",
                      "Modernize the layout",
                      "Add more spacing",
                      "Improve typography",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => onEditPromptChange(suggestion)}
                        className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-secondary hover:bg-gray-200 dark:hover:bg-secondary/80 rounded text-gray-700 dark:text-foreground transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {generationStatus && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2 flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 dark:border-green-400 mr-2"></div>
                    <span className="text-xs text-green-800 dark:text-green-300 font-medium">
                      {generationStatus}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRefine}
                  disabled={refining || !editPrompt.trim()}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 dark:from-green-500 dark:to-teal-500 text-white rounded-lg hover:from-green-700 hover:to-teal-700 dark:hover:from-green-600 dark:hover:to-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {refining ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      <span>Refining...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      <span>Apply Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Publish Settings - Removed as part of simplification */
          /* Defaulted to true in backend/hook logic */
          }

          {/* Action Buttons removed - now in global header */}
        </>
      )}
    </div>
  );
}
