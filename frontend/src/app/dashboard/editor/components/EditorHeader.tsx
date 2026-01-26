import React from "react";
import Link from "next/link";
import {
  FiMonitor,
  FiCode,
  FiArrowLeft,
  FiSave,
  FiLayers,
  FiSmartphone,
  FiRotateCcw,
  FiRotateCw,
} from "react-icons/fi";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Workflow } from "@/types/workflow";

interface EditorHeaderProps {
  backHref: string;
  headerTitle: string;
  headerMeta: string | null;
  isDirty: boolean;
  saveStateLabel: string;
  lastSavedAt: number | null;
  mode: "preview" | "code";
  setMode: (mode: "preview" | "code") => void;
  handleUndo: () => void;
  canUndo: boolean;
  handleRedo: () => void;
  canRedo: boolean;
  handleSave: () => void;
  canSave: boolean;
  isSaving: boolean;
  handleSaveAsTemplate: () => void;
  canSaveAsTemplate: boolean;
  savingTemplate: boolean;
  workflow: Workflow | null;
  jobId: string | null;
  device: "desktop" | "mobile";
  setDevice: (device: "desktop" | "mobile") => void;
  initialUrl: string | null;
}

export function EditorHeader({
  backHref,
  headerTitle,
  headerMeta,
  isDirty,
  saveStateLabel,
  lastSavedAt,
  mode,
  setMode,
  handleUndo,
  canUndo,
  handleRedo,
  canRedo,
  handleSave,
  canSave,
  isSaving,
  handleSaveAsTemplate,
  canSaveAsTemplate,
  savingTemplate,
  workflow,
  jobId,
  device,
  setDevice,
  initialUrl,
}: EditorHeaderProps) {
  return (
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

        <Tooltip
          content={jobId ? "Save (Cmd/Ctrl+S)" : "Saving requires a jobId"}
          position="bottom"
        >
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
            <span className="hidden md:inline">
              {isSaving ? "Saving…" : "Save"}
            </span>
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
            <span className="hidden xl:inline">
              {savingTemplate ? "Updating template…" : "Save as Template"}
            </span>
          </button>
        </Tooltip>

        <div className="hidden sm:block w-px h-4 bg-white/10 mx-0.5 sm:mx-1" />

        <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-white/5">
          <Tooltip content="Desktop Preview" position="bottom">
            <button
              onClick={() => setDevice("desktop")}
              className={`p-1.5 rounded-md transition-colors ${
                device === "desktop"
                  ? "text-white bg-zinc-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <FiMonitor className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Mobile Preview" position="bottom">
            <button
              onClick={() => setDevice("mobile")}
              className={`p-1.5 rounded-md transition-colors ${
                device === "mobile"
                  ? "text-white bg-zinc-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
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
              <span className="hidden lg:inline">Visit</span>{" "}
              <FiArrowLeft className="w-3 h-3 rotate-[135deg]" />
            </a>
          </Tooltip>
        ) : null}
      </div>
    </header>
  );
}
