"use client";

import { WorkflowStep } from "@/types/workflow";
import { 
  FiCheck, 
  FiX, 
  FiActivity, 
  FiCpu, 
  FiType, 
  FiSettings, 
  FiLayers,
  FiFileText
} from "react-icons/fi";
import { useState } from "react";

interface StepDiffPreviewProps {
  original?: WorkflowStep;
  proposed: WorkflowStep;
  action: "update" | "add";
  onAccept: () => void;
  onReject: () => void;
  isLoading?: boolean;
  allSteps?: WorkflowStep[];
}

const DiffValue = ({ value, type, label }: { value: string; type: "old" | "new"; label?: string }) => {
  const isLong = value.length > 150;
  const [expanded, setExpanded] = useState(false);

  const displayValue = expanded ? value : (isLong ? value.substring(0, 150) + "..." : value);

  return (
    <div className={`group relative rounded-md p-3 text-sm font-mono whitespace-pre-wrap transition-colors ${
      type === "old" 
        ? "bg-red-50/50 text-red-900 border border-red-100 hover:bg-red-50 hover:border-red-200" 
        : "bg-green-50/50 text-green-900 border border-green-100 hover:bg-green-50 hover:border-green-200"
    }`}>
      {label && (
        <div className={`absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider select-none opacity-50 group-hover:opacity-100 transition-opacity ${
          type === "old" ? "text-red-500" : "text-green-500"
        }`}>
          {label}
        </div>
      )}
      <div className="break-words">{displayValue}</div>
      {isLong && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className={`mt-2 text-xs font-medium hover:underline focus:outline-none ${
            type === "old" ? "text-red-600" : "text-green-600"
          }`}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};

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

  const getFieldIcon = (field: string) => {
    switch (field) {
      case "step_name": return <FiType className="w-4 h-4" />;
      case "step_description": return <FiFileText className="w-4 h-4" />;
      case "model": return <FiCpu className="w-4 h-4" />;
      case "service_tier": return <FiActivity className="w-4 h-4" />;
      case "instructions": return <FiFileText className="w-4 h-4" />;
      case "tools": return <FiSettings className="w-4 h-4" />;
      case "tool_choice": return <FiSettings className="w-4 h-4" />;
      case "depends_on": return <FiLayers className="w-4 h-4" />;
      default: return <FiSettings className="w-4 h-4" />;
    }
  };

  const getFieldDiffs = (): Array<{
    field: string;
    label: string;
    from: any;
    to: any;
  }> => {
    const fields = [
      { key: "step_name", label: "Step Name" },
      { key: "step_description", label: "Description" },
      { key: "model", label: "Model" },
      { key: "service_tier", label: "Service Tier" },
      { key: "instructions", label: "Instructions" },
      { key: "tools", label: "Tools" },
      { key: "tool_choice", label: "Tool Choice" },
      { key: "depends_on", label: "Dependencies" },
    ];

    if (action === "add") {
      return fields
        .map(f => ({
          field: f.key,
          label: f.label,
          from: null,
          to: proposed[f.key as keyof WorkflowStep]
        }))
        .filter(diff => diff.to !== undefined && diff.to !== null && diff.to !== "");
    }

    const diffs: Array<{ field: string; label: string; from: any; to: any }> = [];

    fields.forEach(f => {
      const key = f.key as keyof WorkflowStep;
      const fromVal = original?.[key];
      const toVal = proposed[key];
      
      // Simple equality check (JSON stringify for objects/arrays)
      const fromStr = typeof fromVal === 'object' ? JSON.stringify(fromVal) : String(fromVal);
      const toStr = typeof toVal === 'object' ? JSON.stringify(toVal) : String(toVal);

      if (fromStr !== toStr) {
        diffs.push({
          field: f.key,
          label: f.label,
          from: fromVal,
          to: toVal
        });
      }
    });

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
      return value;
    }
    return String(value);
  };

  const diffs = getFieldDiffs();

  return (
    <div className="rounded-xl border border-primary-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-primary-50/50 border-b border-primary-100 px-4 py-3 flex items-start justify-between">
        <div>
          <h4 className="text-sm font-bold text-primary-900 flex items-center gap-2">
            <span className="text-lg">✨</span>
            {action === "add" ? "New Step Proposed" : "Changes Proposed by AI"}
          </h4>
          <p className="text-xs text-primary-600 mt-0.5 ml-7">
            {action === "add"
              ? "Review the proposed step configuration below"
              : `${diffs.length} field${diffs.length === 1 ? "" : "s"} will be updated`}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {diffs.length === 0 && action === "update" && (
          <div className="text-sm text-gray-500 italic text-center py-4">No changes detected</div>
        )}

        {diffs.map((diff, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
              <span className="p-1.5 rounded-md bg-gray-100 text-gray-500">
                {getFieldIcon(diff.field)}
              </span>
              {diff.label}
            </div>

            <div className="ml-8 space-y-2">
              {action === "update" && diff.from !== null && (
                <DiffValue 
                  value={renderValue(diff.from, diff.field)} 
                  type="old" 
                  label="Before"
                />
              )}
              <DiffValue 
                value={renderValue(diff.to, diff.field)} 
                type="new" 
                label={action === "add" ? "Value" : "After"}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
        <button
          onClick={onAccept}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-all shadow-sm hover:shadow active:scale-[0.98]"
        >
          <FiCheck className="w-4 h-4" />
          {action === "add" ? "Add This Step" : "Apply Changes"}
        </button>
        <button
          onClick={onReject}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-all shadow-sm hover:shadow active:scale-[0.98]"
        >
          <FiX className="w-4 h-4" />
          Reject
        </button>
      </div>
    </div>
  );
}
