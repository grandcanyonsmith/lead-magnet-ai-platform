"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  FiMonitor,
  FiCode,
  FiArrowLeft,
  FiSave,
  FiLayers,
  FiSmartphone,
  FiMousePointer,
  FiRotateCcw,
  FiRotateCw,
  FiZap,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import type { Job } from "@/types/job";
import type { Workflow, AIModel } from "@/types/workflow";
import { Tooltip } from "@/components/ui/Tooltip";
import { Select } from "@/components/ui/Select";
import { useAIModelOptions } from "@/hooks/useAIModelOptions";

import { useEditorHistory } from "./hooks/useEditorHistory";
import { useHtmlPatcher } from "./hooks/useHtmlPatcher";
import { SELECTION_SCRIPT } from "./constants";
import { isTextInputTarget, stripInjectedBlocksForTemplate } from "./utils";

// Types
type EditorMode = "preview" | "code";
type DeviceMode = "desktop" | "mobile";

export default function EditorClient() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const initialUrl = searchParams.get("url");
  const artifactId = searchParams.get("artifactId");

  // State
  const [mode, setMode] = useState<EditorMode>("preview");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // History & HTML State
  const {
    htmlState,
    undo,
    redo,
    reset,
    setHtml,
    commit,
    canUndo,
    canRedo,
  } = useEditorHistory();

  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectedOuterHtml, setSelectedOuterHtml] = useState<string | null>(
    null,
  );
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [lastSavedHtml, setLastSavedHtml] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showAiSettings, setShowAiSettings] = useState(false);

  // Template / workflow context
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // AI Patcher Hook
  const handlePatchApplied = useCallback((newHtml: string) => {
    commit(newHtml);
    setSelectedElement(null);
    setSelectedOuterHtml(null);
  }, [commit]);

  const {
    prompt,
    setPrompt,
    isProcessing,
    submitPatch,
    aiModel,
    setAiModel,
    aiSpeed,
    setAiSpeed,
    aiReasoningEffort,
    setAiReasoningEffort,
  } = useHtmlPatcher({
    jobId,
    onApply: handlePatchApplied,
    initialUrl,
  });
  const {
    options: aiModelOptions,
    loading: aiModelsLoading,
    error: aiModelsError,
  } = useAIModelOptions({ currentModel: aiModel });

  const activeModelLabel = useMemo(() => {
    const match = aiModelOptions.find((model) => model.value === aiModel);
    return match?.label ?? aiModel;
  }, [aiModelOptions, aiModel]);

  const isDirty = lastSavedHtml !== null && htmlState.html !== lastSavedHtml;

  // Load HTML
  useEffect(() => {
    let isMounted = true;

    const loadContent = async () => {
      if (isMounted) {
        setHasError(false);
      }

      // 1. Try fetching via Artifact ID (best for auth/CORS)
      if (artifactId) {
        try {
          const content = await api.artifacts.getArtifactContent(artifactId);
          if (content && isMounted) {
            reset(content);
            setLastSavedHtml(content);
            setLastSavedAt(Date.now());
            setSelectedElement(null);
            setSelectedOuterHtml(null);
            setIsSelectionMode(false);
            return;
          }
        } catch (err) {
          console.error("Failed to load artifact content:", err);
        }
      }

      // 2. Prefer server-proxied job document (avoids CloudFront/S3 404/CORS issues)
      if (jobId) {
        try {
          const content = await api.jobs.getJobDocument(jobId);
          if (content && isMounted) {
            reset(content);
            setLastSavedHtml(content);
            setLastSavedAt(Date.now());
            setSelectedElement(null);
            setSelectedOuterHtml(null);
            setIsSelectionMode(false);
            return;
          }
        } catch (err) {
          console.error("Failed to load job document:", err);
        }
      }

      // 3. Last resort: fetch the URL directly (may 404 if CloudFront key is stale)
      if (initialUrl) {
        try {
          const res = await fetch(initialUrl);
          if (!res.ok) {
            console.warn(
              `Failed to fetch URL ${initialUrl}: ${res.status} ${res.statusText}`,
            );
            // continue to failure handling below
          } else {
            const content = await res.text();
            if (isMounted) {
              reset(content);
              setLastSavedHtml(content);
              setLastSavedAt(Date.now());
              setSelectedElement(null);
              setSelectedOuterHtml(null);
              setIsSelectionMode(false);
            }
            return;
          }
        } catch (err) {
          console.error("Failed to load initial URL", err);
        }
      }

      // If we got here, all methods failed
      if (isMounted) {
        setHasError(true);
        toast.error("Failed to load content");
      }
    };

    loadContent();

    return () => {
      isMounted = false;
    };
  }, [jobId, initialUrl, artifactId, reset]);

  // Load job metadata for header context
  useEffect(() => {
    let isMounted = true;

    const loadJob = async () => {
      if (!jobId) {
        setJob(null);
        return;
      }
      try {
        const data = await api.getJob(jobId);
        if (isMounted) setJob(data);
      } catch {
        // Non-blocking: editor still works without metadata
      }
    };

    loadJob();
    return () => {
      isMounted = false;
    };
  }, [jobId]);

  // Load workflow (lead magnet) metadata for template actions
  useEffect(() => {
    let isMounted = true;

    const loadWorkflow = async () => {
      const workflowId = job?.workflow_id;
      if (!workflowId) {
        setWorkflow(null);
        return;
      }
      try {
        const wf = await api.getWorkflow(workflowId);
        if (isMounted) setWorkflow(wf as Workflow);
      } catch {
        if (isMounted) setWorkflow(null);
      }
    };

    loadWorkflow();
    return () => {
      isMounted = false;
    };
  }, [job?.workflow_id]);

  // Inject script when HTML changes or iframe loads
  const getPreviewContent = useCallback(() => {
    if (!htmlState.html) return "";

    // Remove injected scripts (overlay + tracking) to prevent conflicts and sandbox errors.
    let cleanContent = String(htmlState.html || "")
      .replace(
        /<!--\s*Lead Magnet Editor Overlay\s*-->[\s\S]*?<\/script>\s*/gi,
        "",
      )
      .replace(
        /<!--\s*Lead Magnet Tracking Script\s*-->[\s\S]*?<\/script>\s*/gi,
        "",
      );

    // Inject our script before closing body
    if (cleanContent.includes("</body>")) {
      return cleanContent.replace(
        "</body>",
        `<script>${SELECTION_SCRIPT}</script></body>`,
      );
    }
    return cleanContent + `<script>${SELECTION_SCRIPT}</script>`;
  }, [htmlState.html]);

  // Handle Selection Mode Toggle
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "TOGGLE_SELECTION_MODE",
          enabled: isSelectionMode,
        },
        "*",
      );
    }
  }, [isSelectionMode]);

  // Handle iframe messages
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Only accept messages from our preview iframe.
      // The HTML inside the iframe is untrusted and can postMessage arbitrarily.
      if (e.source !== iframeRef.current?.contentWindow) return;

      const data: any = e.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "ELEMENT_SELECTED") {
        const selector =
          typeof data.selector === "string" ? (data.selector as string) : null;
        if (!selector) return;

        setSelectedElement(selector);
        setSelectedOuterHtml(
          typeof data.outerHtml === "string" ? (data.outerHtml as string) : null,
        );
        setIsSelectionMode(false); // Turn off after selection
        toast.success(`Selected: ${selector}`, { icon: "🎯" });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    undo();
    toast("Undone", { icon: "↩️", duration: 1000 });
  }, [canUndo, undo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    redo();
    toast("Redone", { icon: "↪️", duration: 1000 });
  }, [canRedo, redo]);

  const handleSendMessage = useCallback(async () => {
    await submitPatch({
      currentHtml: htmlState.html,
      selectedElement,
      selectedOuterHtml,
    });
  }, [submitPatch, htmlState.html, selectedElement, selectedOuterHtml]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!workflow?.template_id) {
      toast.error("This lead magnet does not have a template attached.");
      return;
    }
    if (!htmlState.html) return;
    if (savingTemplate) return;

    const name = workflow.workflow_name || "this lead magnet";
    const confirmed = confirm(
      `Save your current HTML as the new template for "${name}"?\n\nThis will create a new template version. Future runs will use the updated template.`,
    );
    if (!confirmed) return;

    setSavingTemplate(true);
    try {
      const cleanedHtml = stripInjectedBlocksForTemplate(htmlState.html);
      const updatedTemplate = await api.updateTemplate(workflow.template_id, {
        html_content: cleanedHtml,
      });

      const currentVersion =
        typeof workflow.template_version === "number" &&
        Number.isFinite(workflow.template_version)
          ? workflow.template_version
          : 0;

      // If this workflow is pinned to a specific version (non-zero), bump it to the new version.
      if (
        currentVersion !== 0 &&
        updatedTemplate?.version &&
        updatedTemplate.version !== currentVersion
      ) {
        await api.updateWorkflow(workflow.workflow_id, {
          template_version: updatedTemplate.version,
        });
        setWorkflow((prev) =>
          prev ? { ...prev, template_version: updatedTemplate.version } : prev,
        );
      }

      toast.success(`Template updated (v${updatedTemplate?.version || "new"})`);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      toast.error(apiErr?.message || "Failed to update template");
    } finally {
      setSavingTemplate(false);
    }
  }, [
    htmlState.html,
    savingTemplate,
    workflow,
  ]);

  const handleSave = useCallback(async () => {
    if (!jobId || !htmlState.html) return;
    setIsSaving(true);
    try {
      await api.post(`/v1/jobs/${jobId}/html/save`, {
        patched_html: htmlState.html,
      });
      setLastSavedHtml(htmlState.html);
      setLastSavedAt(Date.now());
      toast.success("Changes saved successfully");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }, [htmlState.html, jobId]);

  // Keyboard shortcuts: Cmd/Ctrl+S save, Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSelectionMode(false);
        setShowAiSettings(false);
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;

      const key = e.key.toLowerCase();

      if (key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      // Don't override native undo/redo inside text inputs
      if (isTextInputTarget(e.target)) return;

      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRedo, handleSave, handleUndo]);

  const headerTitle = useMemo(() => {
    const workflowName = (job as any)?.workflow_name;
    if (typeof workflowName === "string" && workflowName.trim())
      return workflowName.trim();
    if (job?.workflow_id) return job.workflow_id;
    return "Lead Magnet Editor";
  }, [job]);

  const headerMeta = useMemo(() => {
    if (jobId) return `Job ${jobId.slice(0, 8)}`;
    if (artifactId) return `Artifact ${artifactId.slice(0, 8)}`;
    return null;
  }, [artifactId, jobId]);

  const saveStateLabel = useMemo(() => {
    if (isSaving) return "Saving…";
    if (!lastSavedHtml) return "Not saved";
    if (isDirty) return "Unsaved";
    return "Saved";
  }, [isDirty, isSaving, lastSavedHtml]);

  const backHref = jobId ? `/dashboard/jobs/${jobId}` : "/dashboard/jobs";
  const canSave = Boolean(jobId && htmlState.html && isDirty && !isSaving);
  const canSaveAsTemplate = Boolean(
    workflow?.template_id && htmlState.html && !savingTemplate,
  );
  const reasoningLabel =
    aiReasoningEffort === "medium" ? "MED" : aiReasoningEffort.toUpperCase();

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-gray-200 font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-16 flex items-center justify-between px-3 sm:px-4 md:px-6 border-b border-white/5 bg-zinc-950/80 backdrop-blur-sm z-50">
        <div className="flex items-center gap-6 min-w-0">
          <div className="flex items-center gap-4 min-w-0">
            <Tooltip content="Back to Job Details" position="bottom">
              <Link
                href={backHref}
                className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                aria-label="Back"
              >
                <FiArrowLeft className="w-5 h-5" />
              </Link>
            </Tooltip>
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-semibold text-sm text-gray-200 truncate">
                  {headerTitle}
                </span>
                {headerMeta && (
                  <span className="text-[11px] font-mono text-gray-500 truncate bg-white/5 px-1.5 py-0.5 rounded">
                    {headerMeta}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isDirty ? "bg-amber-400" : "bg-emerald-400"}`}
                />
                <span>{saveStateLabel}</span>
                {lastSavedAt && !isDirty && (
                  <span className="hidden sm:inline opacity-60">
                    · {new Date(Number(lastSavedAt)).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex bg-zinc-900 rounded-lg p-1 border border-white/5">
            <button
              onClick={() => setMode("preview")}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === "preview"
                  ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/5"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              <FiMonitor className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              onClick={() => setMode("code")}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === "code"
                  ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/5"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              <FiCode className="w-3.5 h-3.5" />
              Code
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Tooltip content="Undo (Cmd/Ctrl+Z)" position="bottom">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white"
            >
              <FiRotateCcw className="w-4 h-4" />
            </button>
          </Tooltip>
          
          <Tooltip content="Redo (Cmd/Ctrl+Shift+Z)" position="bottom">
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white"
            >
              <FiRotateCw className="w-4 h-4" />
            </button>
          </Tooltip>

          <div className="w-px h-4 bg-white/10 mx-0.5 sm:mx-1" />

          <Tooltip content={jobId ? "Save (Cmd/Ctrl+S)" : "Saving requires a jobId"} position="bottom">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`hidden sm:inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                canSave
                  ? "bg-white text-black hover:bg-zinc-200 border-white/10 shadow-sm"
                  : "bg-white/5 text-gray-500 border-white/5 cursor-not-allowed"
              }`}
            >
              <FiSave className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{isSaving ? "Saving…" : "Save"}</span>
            </button>
          </Tooltip>

          <Tooltip 
            content={
              workflow?.template_id
                ? "Update the lead magnet template HTML from your current editor HTML"
                : "No template attached to this lead magnet"
            }
            position="bottom"
          >
            <button
              onClick={handleSaveAsTemplate}
              disabled={!canSaveAsTemplate}
              className={`hidden lg:inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                canSaveAsTemplate
                  ? "bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border-indigo-500/20"
                  : "bg-white/5 text-gray-500 border-white/5 cursor-not-allowed"
              }`}
            >
              <FiLayers className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{savingTemplate ? "Updating template…" : "Save as Template"}</span>
            </button>
          </Tooltip>

          <div className="hidden sm:block w-px h-4 bg-white/10 mx-0.5 sm:mx-1" />

          <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-white/5">
            <Tooltip content="Desktop Preview" position="bottom">
              <button
                onClick={() => setDevice("desktop")}
                className={`p-1.5 rounded-md transition-colors ${
                  device === "desktop" ? "text-white bg-zinc-800 shadow-sm" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <FiMonitor className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Mobile Preview" position="bottom">
              <button
                onClick={() => setDevice("mobile")}
                className={`p-1.5 rounded-md transition-colors ${
                  device === "mobile" ? "text-white bg-zinc-800 shadow-sm" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <FiSmartphone className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>

          {initialUrl ? (
            <Tooltip content="View original URL" position="bottom">
              <a
                href={initialUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 text-xs font-semibold bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors border border-white/10"
              >
                <span className="hidden lg:inline">Visit</span> <FiArrowLeft className="w-3 h-3 rotate-[135deg]" />
              </a>
            </Tooltip>
          ) : null}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 relative overflow-hidden bg-zinc-950/50 flex flex-col items-center justify-center p-3 sm:p-4 md:p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/50 via-zinc-950/50 to-zinc-950/50">
        {mode === "preview" ? (
          <div
            className={`relative transition-all duration-500 ease-spring shadow-2xl ${
              device === "mobile"
                ? "w-[375px] h-[667px] rounded-[3rem] border-8 border-zinc-900 bg-white overflow-hidden shadow-zinc-900/50"
                : "w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] h-full rounded-xl border border-white/5 bg-white overflow-hidden shadow-zinc-900/20"
            }`}
          >
            {htmlState.html ? (
              <iframe
                ref={iframeRef}
                srcDoc={getPreviewContent()}
                className="w-full h-full bg-white"
                title="Preview"
                sandbox="allow-scripts allow-popups"
              />
            ) : hasError ? (
              <div className="flex flex-col w-full h-full items-center justify-center text-gray-500 bg-zinc-950 p-4 text-center">
                <p className="text-red-400 font-medium mb-2">
                  Failed to load content
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md text-xs text-white transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            ) : (
              <div className="flex w-full h-full items-center justify-center text-gray-500 bg-zinc-950">
                <FiRotateCw className="h-5 w-5 animate-spin mr-2" />
                Loading...
              </div>
            )}

            {/* Selection Mode Indicator Overlay */}
            {isSelectionMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 pointer-events-none ring-1 ring-white/10 backdrop-blur-md">
                <FiMousePointer className="w-3.5 h-3.5" />
                Select an element to edit
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] rounded-xl border border-white/5 bg-zinc-900 overflow-hidden shadow-2xl">
            <textarea
              value={htmlState.html}
              onChange={(e) => {
                setHtml(e.target.value);
              }}
              onBlur={() =>
                commit(htmlState.html)
              }
              className="w-full h-full bg-zinc-900 text-gray-300 font-mono text-sm p-4 resize-none focus:outline-none selection:bg-indigo-500/30"
              spellCheck={false}
            />
          </div>
        )}
      </main>

      <footer className="relative border-t border-white/5 bg-zinc-950 px-3 sm:px-4 md:px-6 py-3 sm:py-4 z-40">
        <div className="mx-auto w-full max-w-3xl xl:max-w-4xl">
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 transition-all focus-within:ring-1 focus-within:ring-indigo-500/50 ring-offset-2 ring-offset-zinc-950">
            <div className="flex flex-col">
              {/* Context & Selection (if any) */}
              {selectedElement && (
                <div className="px-3 py-2 flex items-center justify-between border-b border-white/5 mb-1 bg-white/5 rounded-t-lg mx-1 mt-1">
                  <div className="flex items-center gap-2 text-xs text-indigo-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="font-mono truncate max-w-[300px]">
                      {selectedElement}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedElement(null);
                      setSelectedOuterHtml(null);
                      setIsSelectionMode(false);
                    }}
                    className="text-gray-500 hover:text-white transition-colors"
                    title="Clear selection"
                  >
                    <FiRotateCw className="w-3 h-3 rotate-45" />
                  </button>
                </div>
              )}

              {/* Main Input Area */}
              <div className="flex items-end gap-2 px-2">
                <Tooltip 
                  content={mode === "preview" ? "Select element to edit" : "Selection requires Preview mode"}
                  position="top"
                >
                  <button
                    onClick={() => setIsSelectionMode((v) => !v)}
                    disabled={mode !== "preview" || !htmlState.html}
                    className={`p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      isSelectionMode
                        ? "text-indigo-300 bg-indigo-500/20 ring-1 ring-indigo-500/30"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <FiMousePointer className="w-5 h-5" />
                  </button>
                </Tooltip>

                <div className="h-8 w-px bg-white/10 my-auto" />

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    jobId
                      ? "Describe changes with AI... (e.g. 'Make the headline bigger')"
                      : "Open this editor from a job to apply AI edits…"
                  }
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder-gray-500 min-h-[48px] max-h-36 py-3 resize-none leading-relaxed"
                  disabled={isProcessing || !jobId}
                  rows={1}
                />

                <div className="flex items-center gap-2 pb-2">
                  <Tooltip content="AI Settings" position="top">
                    <button
                      onClick={() => setShowAiSettings((v) => !v)}
                      className="px-2.5 py-1.5 text-[10px] font-semibold bg-zinc-800 text-amber-300/90 rounded-lg flex items-center gap-1.5 border border-white/5 hover:bg-zinc-700 transition-colors shadow-sm"
                      title={activeModelLabel}
                    >
                      <FiZap className="w-3 h-3" />
                      <span className="hidden sm:inline truncate max-w-[140px]">
                        {activeModelLabel}
                      </span>
                    </button>
                  </Tooltip>

                  <Tooltip content={jobId ? "Apply Changes (Enter)" : "Applying requires a jobId"} position="top">
                    <button
                      onClick={handleSendMessage}
                      disabled={!jobId || !prompt.trim() || isProcessing}
                      className={`p-2.5 rounded-xl transition-all shadow-sm ${
                        jobId && prompt.trim() && !isProcessing
                          ? "bg-white text-black hover:bg-zinc-200 hover:scale-105 active:scale-95"
                          : "bg-white/5 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {isProcessing ? (
                        <FiRotateCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <FiArrowLeft className="w-4 h-4 rotate-90 stroke-[3px]" />
                      )}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Popover */}
          {showAiSettings && (
            <div className="absolute bottom-full right-4 mb-4 w-72 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-2 fade-in ring-1 ring-black/50">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-3 block">
                    Generation Settings
                  </label>

                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-gray-400 mb-2 font-medium">
                        AI Model
                      </div>
                      <Select
                        value={aiModel}
                        onChange={(value) => setAiModel(value as AIModel)}
                        options={aiModelOptions}
                        searchable={true}
                        searchPlaceholder="Search models..."
                        className="w-full bg-black/20 border-white/5 text-xs"
                        disabled={aiModelsLoading || !!aiModelsError}
                        placeholder={
                          aiModelsLoading
                            ? "Loading models..."
                            : aiModelsError
                              ? "Error loading models"
                              : "Select model"
                        }
                      />
                    </div>

                    <div>
                      <div className="text-xs text-gray-400 mb-2 font-medium">Speed</div>
                      <div className="flex gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                        {(["normal", "fast", "turbo"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setAiSpeed(s)}
                            className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${
                              aiSpeed === s
                                ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
                                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                            }`}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-400 mb-2 font-medium">
                        Reasoning effort
                      </div>
                      <div className="flex gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                        {(["low", "medium", "high"] as const).map((effort) => (
                          <button
                            key={effort}
                            onClick={() => setAiReasoningEffort(effort)}
                            className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${
                              aiReasoningEffort === effort
                                ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
                                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                            }`}
                          >
                            {effort === "medium"
                              ? "Medium"
                              : effort.charAt(0).toUpperCase() +
                                effort.slice(1)}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[10px] text-gray-500 leading-tight">
                        Higher reasoning improves complex layout changes but takes longer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500 px-1">
            <div className="flex items-center gap-2 opacity-60">
              <span>Enter to apply</span>
              <span className="text-gray-700">·</span>
              <span>Shift+Enter for newline</span>
            </div>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`sm:hidden inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                canSave
                  ? "bg-white text-black hover:bg-gray-200 border-white/10"
                  : "bg-white/5 text-gray-500 border-white/5 cursor-not-allowed"
              }`}
            >
              <FiSave className="w-3.5 h-3.5" />
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
