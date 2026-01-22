"use client";

import React from "react";
import { Select } from "@/components/ui/Select";

interface ComputerUseConfigProps {
  config: {
    display_width: number;
    display_height: number;
    environment: "browser" | "mac" | "windows" | "ubuntu";
  };
  onChange: (
    field: "display_width" | "display_height" | "environment",
    value: number | string
  ) => void;
  index: number;
  variant?: "panel" | "inline";
}

export default function ComputerUseConfig({
  config,
  onChange,
  index,
  variant = "panel",
}: ComputerUseConfigProps) {
  const containerClass =
    variant === "inline"
      ? "mt-3 rounded-lg border border-border/60 bg-muted/30 p-3"
      : "mt-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg";

  return (
    <div className={containerClass}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Computer Use Preview Configuration
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <div>
          <label
            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            htmlFor={`display-width-${index}`}
          >
            Display Width
          </label>
          <input
            id={`display-width-${index}`}
            type="number"
            value={config.display_width}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 1024;
              const clampedValue = Math.max(100, Math.min(4096, value));
              onChange("display_width", clampedValue);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            min="100"
            max="4096"
            aria-label="Display width in pixels"
            aria-invalid={
              config.display_width < 100 || config.display_width > 4096
            }
          />
          {(config.display_width < 100 || config.display_width > 4096) && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              Width must be between 100 and 4096 pixels
            </p>
          )}
        </div>
        <div>
          <label
            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            htmlFor={`display-height-${index}`}
          >
            Display Height
          </label>
          <input
            id={`display-height-${index}`}
            type="number"
            value={config.display_height}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 768;
              const clampedValue = Math.max(100, Math.min(4096, value));
              onChange("display_height", clampedValue);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            min="100"
            max="4096"
            aria-label="Display height in pixels"
            aria-invalid={
              config.display_height < 100 || config.display_height > 4096
            }
          />
          {(config.display_height < 100 || config.display_height > 4096) && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              Height must be between 100 and 4096 pixels
            </p>
          )}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Environment
        </label>
        <Select
          value={config.environment}
          onChange={(nextValue) => onChange("environment", nextValue)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        >
          <option value="browser">Browser</option>
          <option value="mac">macOS</option>
          <option value="windows">Windows</option>
          <option value="ubuntu">Ubuntu</option>
        </Select>
      </div>
    </div>
  );
}

