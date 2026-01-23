"use client";

import { WorkflowStep } from "@/types/workflow";
import { FiCheck, FiX, FiArrowRight } from "react-icons/fi";

interface StepDiffPreviewProps {
  original?: WorkflowStep;
  proposed: WorkflowStep;
  action: "update" | "add";
  onAccept: () => void;
  onReject: () => void;
  isLoading?: boolean;
  allSteps?: WorkflowStep[];
}

export default function StepDiffPreview({
  original,
  proposed,
  action,
  onAccept,
  onReject,
  isLoading = false,
  allSteps,
}: StepDiffPreviewProps) {
  const formatDependsOn = (dependsOn: number[] | undefined) => {
    if (!Array.isArray(dependsOn) || dependsOn.length === 0) return "(none)";
    return dependsOn
      .map((dep) => {
        const step = allSteps?.[dep];
        const name = step?.step_name ? `: ${step.step_name}` : "";
        return `Step ${dep + 1}${name}`;
      })
      .join(", ");
  };

  const getFieldDiffs = (): Array<{
    field: string;
    label: string;
    from: any;
    to: any;
  }> => {
    if (action === "add") {
      return [
        {
          field: "step_name",
          label: "Step Name",
          from: null,
          to: proposed.step_name,
        },
        {
          field: "step_description",
          label: "Description",
          from: null,
          to: proposed.step_description,
        },
        { field: "model", label: "Model", from: null, to: proposed.model },
        {
          field: "service_tier",
          label: "Service Tier",
          from: null,
          to: proposed.service_tier,
        },
        {
          field: "instructions",
          label: "Instructions",
          from: null,
          to: proposed.instructions,
        },
        { field: "tools", label: "Tools", from: null, to: proposed.tools },
        {
          field: "tool_choice",
          label: "Tool Choice",
          from: null,
          to: proposed.tool_choice,
        },
        {
          field: "depends_on",
          label: "Dependencies",
          from: null,
          to: proposed.depends_on,
        },
      ].filter((diff) => diff.to);
    }

    const diffs: Array<{ field: string; label: string; from: any; to: any }> =
      [];

    if (original?.step_name !== proposed.step_name) {
      diffs.push({
        field: "step_name",
        label: "Step Name",
        from: original?.step_name,
        to: proposed.step_name,
      });
    }
    if (original?.step_description !== proposed.step_description) {
      diffs.push({
        field: "step_description",
        label: "Description",
        from: original?.step_description,
        to: proposed.step_description,
      });
    }
    if (original?.model !== proposed.model) {
      diffs.push({
        field: "model",
        label: "Model",
        from: original?.model,
        to: proposed.model,
      });
    }
    if (original?.service_tier !== proposed.service_tier) {
      diffs.push({
        field: "service_tier",
        label: "Service Tier",
        from: original?.service_tier,
        to: proposed.service_tier,
      });
    }
    if (original?.instructions !== proposed.instructions) {
      diffs.push({
        field: "instructions",
        label: "Instructions",
        from: original?.instructions,
        to: proposed.instructions,
      });
    }
    if (JSON.stringify(original?.tools) !== JSON.stringify(proposed.tools)) {
      diffs.push({
        field: "tools",
        label: "Tools",
        from: original?.tools,
        to: proposed.tools,
      });
    }
    if (original?.tool_choice !== proposed.tool_choice) {
      diffs.push({
        field: "tool_choice",
        label: "Tool Choice",
        from: original?.tool_choice,
        to: proposed.tool_choice,
      });
    }
    if (
      JSON.stringify(original?.depends_on) !==
      JSON.stringify(proposed.depends_on)
    ) {
      diffs.push({
        field: "depends_on",
        label: "Dependencies",
        from: original?.depends_on,
        to: proposed.depends_on,
      });
    }

    return diffs;
  };

  const renderValue = (value: any, field?: string): string => {
    if (value === null || value === undefined) return "(not set)";
    if (field === "depends_on") {
      return formatDependsOn(Array.isArray(value) ? value : undefined);
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return "(none)";
      return value
        .map((v) => {
          if (typeof v === "object") return v.type || JSON.stringify(v);
          return v;
        })
        .join(", ");
    }
    if (typeof value === "string") {
      if (value.trim() === "") return "(empty)";
      if (value.length > 100) return value.substring(0, 100) + "...";
      return value;
    }
    return String(value);
  };

  const diffs = getFieldDiffs();

  return (
    <div className="border-2 border-primary-200 rounded-lg bg-primary-50 p-3 sm:p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-primary-900 mb-1">
            {action === "add"
              ? "✨ New Step Proposed"
              : "✨ Changes Proposed by AI"}
          </h4>
          <p className="text-xs text-primary-700">
            {action === "add"
              ? "Review the proposed step configuration below"
              : `${diffs.length} field${diffs.length === 1 ? "" : "s"} will be updated`}
          </p>
        </div>
      </div>

      {diffs.length === 0 && action === "update" && (
        <div className="text-sm text-primary-700 mb-4">No changes detected</div>
      )}

      {diffs.length > 0 && (
        <div className="space-y-3 mb-4">
          {diffs.map((diff, index) => (
            <div
              key={index}
              className="bg-white rounded border border-primary-200 p-3"
            >
              <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
                {diff.label}
              </div>

              {action === "update" && diff.from !== null && (
                <div className="flex flex-col gap-1 text-sm mb-1 sm:flex-row sm:items-start sm:gap-2">
                  <span className="text-red-600 font-medium sm:min-w-[60px]">
                    Before:
                  </span>
                  <span className="text-red-700 bg-red-50 px-2 py-1 rounded break-words sm:flex-1">
                    {renderValue(diff.from, diff.field)}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:gap-2">
                <span className="text-green-600 font-medium sm:min-w-[60px]">
                  {action === "add" ? "Value:" : "After:"}
                </span>
                <span className="text-green-700 bg-green-50 px-2 py-1 rounded break-words sm:flex-1">
                  {renderValue(diff.to, diff.field)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          onClick={onAccept}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
        >
          <FiCheck className="w-4 h-4" />
          {action === "add" ? "Add This Step" : "Apply Changes"}
        </button>
        <button
          onClick={onReject}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
        >
          <FiX className="w-4 h-4" />
          Reject
        </button>
      </div>
    </div>
  );
}
