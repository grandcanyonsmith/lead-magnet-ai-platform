import React from "react";
import { Select } from "@/components/ui/Select";
import type { AIModel, ReasoningEffort } from "@/types/workflow";

interface AiSettingsPopoverProps {
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

export function AiSettingsPopover({
  aiModel,
  setAiModel,
  aiModelOptions,
  aiModelsLoading,
  aiModelsError,
  aiSpeed,
  setAiSpeed,
  aiReasoningEffort,
  setAiReasoningEffort,
}: AiSettingsPopoverProps) {
  return (
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
                      : effort.charAt(0).toUpperCase() + effort.slice(1)}
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
  );
}
