"use client";

import {
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  FiRotateCw,
  FiMousePointer,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import { useAIModelOptions } from "@/hooks/useAIModelOptions";

import { useEditorHistory } from "./hooks/useEditorHistory";
import { useHtmlPatcher } from "./hooks/useHtmlPatcher";
import { SELECTION_SCRIPT } from "./constants";
import { stripInjectedBlocksForTemplate } from "./utils";

import { EditorHeader } from "./components/EditorHeader";
import { EditorFooter } from "./components/EditorFooter";
import { useEditorShortcuts } from "./hooks/useEditorShortcuts";
import { useEditorIframe } from "./hooks/useEditorIframe";
import { useEditorData } from "./hooks/useEditorData";

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
  const [lastSavedHtml, setLastSavedHtml] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Custom Hooks
  const { job, workflow, setWorkflow } = useEditorData({
    jobId,
    initialUrl,
    artifactId,
    reset,
    setLastSavedHtml,
    setLastSavedAt,
    setSelectedElement,
    setSelectedOuterHtml,
    setIsSelectionMode,
    setHasError,
  });

  useEditorIframe({
    iframeRef,
    isSelectionMode,
    setSelectedElement,
    setSelectedOuterHtml,
    setIsSelectionMode,
  });

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
    setWorkflow
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

  useEditorShortcuts({
    setIsSelectionMode,
    setShowAiSettings,
    handleSave,
    handleUndo,
    handleRedo,
  });

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

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-gray-200 font-sans selection:bg-indigo-500/30 overflow-hidden">
      <EditorHeader
        backHref={backHref}
        headerTitle={headerTitle}
        headerMeta={headerMeta}
        isDirty={isDirty}
        saveStateLabel={saveStateLabel}
        lastSavedAt={lastSavedAt}
        mode={mode}
        setMode={setMode}
        handleUndo={handleUndo}
        canUndo={canUndo}
        handleRedo={handleRedo}
        canRedo={canRedo}
        handleSave={handleSave}
        canSave={canSave}
        isSaving={isSaving}
        handleSaveAsTemplate={handleSaveAsTemplate}
        canSaveAsTemplate={canSaveAsTemplate}
        savingTemplate={savingTemplate}
        workflow={workflow}
        jobId={jobId}
        device={device}
        setDevice={setDevice}
        initialUrl={initialUrl}
      />

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
              value={htmlState.html || ""}
              onChange={(e) => {
                setHtml(e.target.value);
              }}
              onBlur={() =>
                commit(htmlState.html || "")
              }
              className="w-full h-full bg-zinc-900 text-gray-300 font-mono text-sm p-4 resize-none focus:outline-none selection:bg-indigo-500/30"
              spellCheck={false}
            />
          </div>
        )}
      </main>

      <EditorFooter
        selectedElement={selectedElement}
        setSelectedElement={setSelectedElement}
        setSelectedOuterHtml={setSelectedOuterHtml}
        setIsSelectionMode={setIsSelectionMode}
        mode={mode}
        htmlState={htmlState}
        isSelectionMode={isSelectionMode}
        prompt={prompt}
        setPrompt={setPrompt}
        handleSendMessage={handleSendMessage}
        jobId={jobId}
        isProcessing={isProcessing}
        showAiSettings={showAiSettings}
        setShowAiSettings={setShowAiSettings}
        activeModelLabel={activeModelLabel}
        handleSave={handleSave}
        canSave={canSave}
        isSaving={isSaving}
        aiModel={aiModel}
        setAiModel={setAiModel}
        aiModelOptions={aiModelOptions}
        aiModelsLoading={aiModelsLoading}
        aiModelsError={aiModelsError}
        aiSpeed={aiSpeed}
        setAiSpeed={setAiSpeed}
        aiReasoningEffort={aiReasoningEffort}
        setAiReasoningEffort={setAiReasoningEffort}
      />
    </div>
  );
}
