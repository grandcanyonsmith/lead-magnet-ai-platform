import React from "react";
import type { MergedStep } from "@/types/job";
import type { Artifact } from "@/types/artifact";

// Type for tool - can be a string or an object with a type property
export type Tool = string | { type: string; [key: string]: unknown };

// Helper to get tool name from tool object or string
export function getToolName(tool: Tool): string {
  return typeof tool === "string" ? tool : tool.type || "unknown";
}

// Helper to truncate long URLs for display
export function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) {
    return url;
  }
  return url.substring(0, maxLength) + "...";
}

// Helper to detect if image generation was used in this step
export function hasImageGeneration(
  step: MergedStep,
  imageArtifacts: Artifact[],
): boolean {
  // Check if step has image URLs
  const hasImageUrls =
    step.image_urls &&
    Array.isArray(step.image_urls) &&
    step.image_urls.length > 0;

  // Check if step has image artifacts
  const hasImageArtifacts = imageArtifacts.length > 0;

  // Check if step tools include image generation
  const tools = step.input?.tools || step.tools || [];
  const hasImageGenerationTool =
    Array.isArray(tools) &&
    tools.some((tool) => {
      const toolName = getToolName(tool as Tool);
      return toolName === "image_generation";
    });

  return hasImageUrls || hasImageArtifacts || hasImageGenerationTool;
}

// Render tool badges inline
export function renderToolBadges(
  tools?: string[] | unknown[],
  showLabel: boolean = true,
) {
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return showLabel ? (
      <span className="px-2 py-0.5 text-xs bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-700">
        None
      </span>
    ) : null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tools.map((tool, toolIdx) => {
        const toolName = getToolName(tool as Tool);
        return (
          <span
            key={toolIdx}
            className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800/30 whitespace-nowrap"
          >
            {toolName}
          </span>
        );
      })}
    </div>
  );
}
