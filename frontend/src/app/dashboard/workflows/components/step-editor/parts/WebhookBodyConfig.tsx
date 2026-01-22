import React from "react";
import { WorkflowStep } from "@/types/workflow";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";

interface WebhookBodyConfigProps {
  step: WorkflowStep;
  index: number;
  allSteps: WorkflowStep[];
  onChange: (field: keyof WorkflowStep, value: any) => void;
}

export function WebhookBodyConfig({
  step,
  index,
  allSteps,
  onChange,
}: WebhookBodyConfigProps) {
  const webhookBodyMode = (step.webhook_body_mode ||
    (step.webhook_body ? "custom" : "auto")) as "auto" | "custom";

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Body
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Choose whether to send an auto-generated payload (submission + step
        outputs) or write a custom body.
      </p>

      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
        <button
          type="button"
          onClick={() => onChange("webhook_body_mode", "auto")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            webhookBodyMode === "auto"
              ? "bg-gray-900 dark:bg-gray-700 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          Auto payload
        </button>
        <button
          type="button"
          onClick={() => onChange("webhook_body_mode", "custom")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            webhookBodyMode === "custom"
              ? "bg-gray-900 dark:bg-gray-700 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          Custom body
        </button>
      </div>

      {webhookBodyMode === "custom" ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
              Raw body
            </span>
            <Select
              value=""
              onChange={(token) => {
                if (!token) return;
                const current = String(step.webhook_body || "");
                onChange("webhook_body", current + token);
              }}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all hover:border-gray-400 dark:hover:border-gray-500"
              aria-label="Insert variable"
              title="Insert a variable token"
            >
              <option value="">Insert variable…</option>
              <optgroup label="Job">
                <option value="{{job.job_id}}">{"{{job.job_id}}"}</option>
                <option value="{{job.workflow_id}}">
                  {"{{job.workflow_id}}"}
                </option>
                <option value="{{job.output_url}}">
                  {"{{job.output_url}}"}
                </option>
              </optgroup>
              <optgroup label="Submission">
                <option value="{{submission}}">{"{{submission}}"}</option>
                <option value="{{submission.email}}">
                  {"{{submission.email}}"}
                </option>
              </optgroup>
              {(allSteps || []).slice(0, index).map((s, i) => {
                const label = s?.step_name
                  ? `Step ${i + 1}: ${s.step_name}`
                  : `Step ${i + 1}`;
                return (
                  <optgroup key={i} label={label}>
                    <option value={`{{steps.${i}.output}}`}>
                      {`{{steps.${i}.output}}`} (text output)
                    </option>
                    <option value={`{{steps.${i}.artifact_url}}`}>
                      {`{{steps.${i}.artifact_url}}`} (artifact URL)
                    </option>
                    <option value={`{{steps.${i}.artifact_urls}}`}>
                      {`{{steps.${i}.artifact_urls}}`} (all URLs)
                    </option>
                  </optgroup>
                );
              })}
            </Select>
          </div>
          <textarea
            value={String(step.webhook_body || "")}
            onChange={(e) => onChange("webhook_body", e.target.value)}
            className="w-full min-h-[180px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm transition-all"
            placeholder={`{\n  \"example\": \"{{some_value}}\"\n}`}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You can reference variables like{" "}
            <span className="font-mono">{"{{job.job_id}}"}</span>,{" "}
            <span className="font-mono">{"{{submission.email}}"}</span>, or{" "}
            <span className="font-mono">{"{{steps.0.output}}"}</span> /{" "}
            <span className="font-mono">{"{{steps.0.artifact_url}}"}</span>.
            During testing, values in “Test values” will replace{" "}
            <span className="font-mono">{"{{your_key}}"}</span>.
          </p>
        </div>
      ) : (
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Data Selection
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Choose which data to include in the HTTP request payload. All step
            outputs are included by default.
          </p>

          <div className="space-y-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={
                  step.webhook_data_selection?.include_submission !== false
                }
                onChange={(checked) => {
                  const dataSelection = step.webhook_data_selection || {
                    include_submission: true,
                    exclude_step_indices: [],
                    include_job_info: true,
                  };
                  onChange("webhook_data_selection", {
                    ...dataSelection,
                    include_submission: checked,
                  });
                }}
              />
              <span className="text-sm text-gray-900 dark:text-gray-100">
                Include submission data
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={
                  step.webhook_data_selection?.include_job_info !== false
                }
                onChange={(checked) => {
                  const dataSelection = step.webhook_data_selection || {
                    include_submission: true,
                    exclude_step_indices: [],
                    include_job_info: true,
                  };
                  onChange("webhook_data_selection", {
                    ...dataSelection,
                    include_job_info: checked,
                  });
                }}
              />
              <span className="text-sm text-gray-900 dark:text-gray-100">
                Include job information
              </span>
            </label>

            {allSteps.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Exclude Step Outputs (optional)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  All step outputs are included by default. Check steps to
                  exclude from the payload.
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
                  {allSteps.map((otherStep, otherIndex) => {
                    if (otherIndex >= index) return null; // Can't exclude future steps
                    const isExcluded = (
                      step.webhook_data_selection?.exclude_step_indices || []
                    ).includes(otherIndex);
                    return (
                      <label
                        key={otherIndex}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={isExcluded}
                          onChange={(checked) => {
                            const dataSelection =
                              step.webhook_data_selection || {
                                include_submission: true,
                                exclude_step_indices: [],
                                include_job_info: true,
                              };
                            const currentExcluded =
                              dataSelection.exclude_step_indices || [];
                            const newExcluded = checked
                              ? [...currentExcluded, otherIndex]
                              : currentExcluded.filter(
                                  (idx: number) => idx !== otherIndex,
                                );
                            onChange("webhook_data_selection", {
                              ...dataSelection,
                              exclude_step_indices: newExcluded,
                            });
                          }}
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          Exclude:{" "}
                          {otherStep.step_name || `Step ${otherIndex + 1}`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
