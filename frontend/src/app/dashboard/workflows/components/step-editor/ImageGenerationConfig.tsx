"use client";

import React from "react";
import { Select } from "@/components/ui/Select";

type ImageGenerationConfigState = {
  model: string;
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality: "low" | "medium" | "high" | "auto";
  format?: "png" | "jpeg" | "webp";
  compression?: number;
  background: "transparent" | "opaque" | "auto";
  input_fidelity?: "low" | "high";
};

interface ImageGenerationConfigProps {
  config: ImageGenerationConfigState;
  onChange: <K extends keyof ImageGenerationConfigState>(
    field: K,
    value: ImageGenerationConfigState[K],
  ) => void;
  variant?: "panel" | "inline";
}

export default function ImageGenerationConfig({
  config,
  onChange,
  variant = "panel",
}: ImageGenerationConfigProps) {
  const containerClass =
    variant === "inline"
      ? "mt-3 rounded-lg border border-border/60 bg-muted/30 p-3"
      : "mt-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg";

  return (
    <div className={containerClass}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Image Generation Configuration
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Model
          </label>
          <Select
            value={config.model}
            onChange={(nextValue) => onChange("model", nextValue)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="gpt-image-1.5">gpt-image-1.5</option>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Size
          </label>
          <Select
            value={config.size}
            onChange={(nextValue) => onChange("size", nextValue as any)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="auto">Auto (default)</option>
            <option value="1024x1024">1024x1024 (Square)</option>
            <option value="1024x1536">1024x1536 (Portrait)</option>
            <option value="1536x1024">1536x1024 (Landscape)</option>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Quality
          </label>
          <Select
            value={config.quality}
            onChange={(nextValue) => onChange("quality", nextValue as any)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="auto">Auto (default)</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Format
          </label>
          <Select
            value={config.format || ""}
            onChange={(nextValue) =>
              onChange("format", (nextValue || undefined) as any)
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="">Default (PNG)</option>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Background
          </label>
          <Select
            value={config.background}
            onChange={(nextValue) => onChange("background", nextValue as any)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="auto">Auto (default)</option>
            <option value="transparent">Transparent</option>
            <option value="opaque">Opaque</option>
          </Select>
        </div>

        {(config.format === "jpeg" || config.format === "webp") && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Compression ({config.compression ?? 85}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={config.compression ?? 85}
              onChange={(e) =>
                onChange("compression", parseInt(e.target.value, 10) as any)
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Input Fidelity
          </label>
          <Select
            value={config.input_fidelity || ""}
            onChange={(nextValue) =>
              onChange("input_fidelity", (nextValue || undefined) as any)
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="">Default</option>
            <option value="low">Low</option>
            <option value="high">High</option>
          </Select>
        </div>
      </div>
    </div>
  );
}


