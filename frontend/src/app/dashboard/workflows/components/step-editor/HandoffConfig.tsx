"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Workflow, WorkflowStep } from "@/types/workflow";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";

interface HandoffConfigProps {
  step: WorkflowStep;
  workflowId?: string; // current workflow (for filtering)
  onChange: (field: keyof WorkflowStep, value: any) => void;
}

export default function HandoffConfig({
  step,
  workflowId,
  onChange,
}: HandoffConfigProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handoffEnabled = Boolean(step.handoff_workflow_id?.trim());

  const bypassRequiredInputs =
    step.handoff_bypass_required_inputs !== undefined
      ? Boolean(step.handoff_bypass_required_inputs)
      : true;
  const includeSubmissionData =
    step.handoff_include_submission_data !== undefined
      ? Boolean(step.handoff_include_submission_data)
      : true;
  const includeContext =
    step.handoff_include_context !== undefined
      ? Boolean(step.handoff_include_context)
      : false;

  const filteredWorkflows = useMemo(() => {
    const items = workflows || [];
    if (!workflowId) return items;
    return items.filter((w) => w.workflow_id !== workflowId);
  }, [workflows, workflowId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await api.getWorkflows({ limit: 200 });
        const list = (resp?.workflows || []) as Workflow[];
        if (!mounted) return;
        setWorkflows(list);
      } catch (err: any) {
        if (!mounted) return;
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load lead magnets",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200/60 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-900/10 p-3">
        <div className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Send this step’s data to another lead magnet
        </div>
        <div className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
          This will trigger another workflow and pass data as its submission input
          (without requiring that lead magnet’s form-required fields).
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Target Lead Magnet <span className="text-red-500">*</span>
          </label>
          <Select
            value={step.handoff_workflow_id || ""}
            onChange={(nextValue) => {
              const nextId = nextValue;
              onChange("handoff_workflow_id", nextId);
              // Set reasonable defaults the first time this is enabled
              if (nextId && step.handoff_payload_mode === undefined) {
                onChange("handoff_payload_mode", "previous_step_output");
              }
              if (nextId && step.handoff_input_field === undefined) {
                onChange("handoff_input_field", "input");
              }
              if (nextId && step.handoff_bypass_required_inputs === undefined) {
                onChange("handoff_bypass_required_inputs", true);
              }
              if (
                nextId &&
                step.handoff_include_submission_data === undefined
              ) {
                onChange("handoff_include_submission_data", true);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            disabled={loading}
            placeholder={
              loading
                ? "Loading lead magnets…"
                : "Select a lead magnet to send data to"
            }
          >
            <option value="">
              {loading
                ? "Loading lead magnets…"
                : "Select a lead magnet to send data to"}
            </option>
            {filteredWorkflows.map((w) => (
              <option key={w.workflow_id} value={w.workflow_id}>
                {w.workflow_name || w.workflow_id}
              </option>
            ))}
          </Select>
          {error && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payload Mode
          </label>
          <Select
            value={step.handoff_payload_mode || "previous_step_output"}
            onChange={(nextValue) =>
              onChange(
                "handoff_payload_mode",
                nextValue as WorkflowStep["handoff_payload_mode"],
              )
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            disabled={!handoffEnabled}
          >
            <option value="previous_step_output">Previous step output</option>
            <option value="full_context">Full context</option>
            <option value="submission_only">Submission data only</option>
            <option value="deliverable_output">Deliverable output</option>
          </Select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Deliverable output uses the step marked as the final deliverable.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Input Field Name
          </label>
          <input
            type="text"
            value={step.handoff_input_field || ""}
            onChange={(e) => onChange("handoff_input_field", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            placeholder="input"
            disabled={!handoffEnabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Checkbox
            checked={bypassRequiredInputs}
            onChange={(checked) =>
              onChange("handoff_bypass_required_inputs", checked)
            }
            disabled={!handoffEnabled}
          />
          Bypass required inputs
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Checkbox
            checked={includeSubmissionData}
            onChange={(checked) =>
              onChange("handoff_include_submission_data", checked)
            }
            disabled={!handoffEnabled}
          />
          Include original submission data
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Checkbox
            checked={includeContext}
            onChange={(checked) => onChange("handoff_include_context", checked)}
            disabled={!handoffEnabled}
          />
          Include formatted context (can be large)
        </label>
      </div>
    </div>
  );
}

