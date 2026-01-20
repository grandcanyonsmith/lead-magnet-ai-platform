import { MergedStep, StepStatus } from "@/types/job";
import { formatDurationMs } from "@/utils/jobFormatting";

interface StepTimingRowProps {
  step: MergedStep;
  status: StepStatus;
}

export function StepTimingRow({ step, status }: StepTimingRowProps) {
  const isCompleted = status === "completed";
  const hasTiming = step.duration_ms !== undefined || step.usage_info;

  if (!isCompleted || !hasTiming) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 dark:bg-gray-800 px-2 py-0.5 border border-gray-200 dark:border-gray-700">
        {step.duration_ms !== undefined && formatDurationMs(step.duration_ms)}
        {step.usage_info?.cost_usd !== undefined && (
          <>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span>
              $
              {typeof step.usage_info.cost_usd === "number"
                ? step.usage_info.cost_usd.toFixed(4)
                : parseFloat(String(step.usage_info.cost_usd) || "0").toFixed(4)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
