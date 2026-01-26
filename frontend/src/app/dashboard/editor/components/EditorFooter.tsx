import React from "react";
import {
  FiRotateCw,
  FiMousePointer,
  FiZap,
  FiArrowLeft,
  FiSave,
} from "react-icons/fi";
import { Tooltip } from "@/components/ui/Tooltip";
import { AiSettingsPopover } from "./AiSettingsPopover";
import type { AIModel, ReasoningEffort } from "@/types/workflow";

interface EditorFooterProps {
  selectedElement: string | null;
  setSelectedElement: (element: string | null) => void;
  setSelectedOuterHtml: (html: string | null) => void;
  setIsSelectionMode: (mode: boolean | ((v: boolean) => boolean)) => void;
  mode: "preview" | "code";
  htmlState: { html: string | null };
  isSelectionMode: boolean;
  prompt: string;
  setPrompt: (prompt: string) => void;
  handleSendMessage: () => void;
  jobId: string | null;
  isProcessing: boolean;
  showAiSettings: boolean;
  setShowAiSettings: (show: boolean | ((v: boolean) => boolean)) => void;
  activeModelLabel: string;
  handleSave: () => void;
  canSave: boolean;
  isSaving: boolean;
  aiModel: AIModel;
  setAiModel: (model: AIModel) => void;
  aiModelOptions: { value: string; label: string }[];
  aiModelsLoading: boolean;
  aiModelsError: string | null;
  aiSpeed: "normal" | "fast" | "turbo";
  setAiSpeed: (speed: "normal" | "fast" | "turbo") => void;
  aiReasoningEffort: ReasoningEffort;
  setAiReasoningEffort: (effort: ReasoningEffort) => void;
}

export function EditorFooter({
  selectedElement,
  setSelectedElement,
  setSelectedOuterHtml,
  setIsSelectionMode,
  mode,
  htmlState,
  isSelectionMode,
  prompt,
  setPrompt,
  handleSendMessage,
  jobId,
  isProcessing,
  showAiSettings,
  setShowAiSettings,
  activeModelLabel,
  handleSave,
  canSave,
  isSaving,
  aiModel,
  setAiModel,
  aiModelOptions,
  aiModelsLoading,
  aiModelsError,
  aiSpeed,
  setAiSpeed,
  aiReasoningEffort,
  setAiReasoningEffort,
}: EditorFooterProps) {
  return (
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
                content={
                  mode === "preview"
                    ? "Select element to edit"
                    : "Selection requires Preview mode"
                }
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

                <Tooltip
                  content={
                    jobId ? "Apply Changes (Enter)" : "Applying requires a jobId"
                  }
                  position="top"
                >
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
          <AiSettingsPopover
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
  );
}
