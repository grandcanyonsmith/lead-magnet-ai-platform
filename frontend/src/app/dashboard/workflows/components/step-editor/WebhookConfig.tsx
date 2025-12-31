"use client";

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { WorkflowStep, HTTPMethod } from "@/types/workflow";
import { api } from "@/lib/api";
import { FiCopy, FiTrash2, FiPlus } from "react-icons/fi";
import { JsonViewer } from "@/components/ui/JsonViewer";

interface WebhookConfigProps {
  step: WorkflowStep;
  index: number;
  allSteps: WorkflowStep[];
  workflowId?: string;
  onChange: (field: keyof WorkflowStep, value: any) => void;
}

export default function WebhookConfig({
  step,
  index,
  allSteps,
  workflowId,
  onChange,
}: WebhookConfigProps) {
  const [webhookHeaders, setWebhookHeaders] = useState<Record<string, string>>(
    step.webhook_headers || {}
  );
  const [webhookQueryParams, setWebhookQueryParams] = useState<
    Record<string, string>
  >(step.webhook_query_params || {});
  
  // Test state
  const [httpTestLoading, setHttpTestLoading] = useState(false);
  const [httpTestResult, setHttpTestResult] = useState<any>(null);
  const [httpTestError, setHttpTestError] = useState<string | null>(null);
  const [httpTestValues, setHttpTestValues] = useState<Record<string, string>>(
    {}
  );
  
  // Run data state
  const [availableRuns, setAvailableRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [selectedRunLoading, setSelectedRunLoading] = useState(false);
  const [selectedRunError, setSelectedRunError] = useState<string | null>(null);
  const [selectedRunVars, setSelectedRunVars] = useState<any>(null);

  // Sync state when step changes
  useEffect(() => {
    if (step.webhook_headers) {
      setWebhookHeaders(step.webhook_headers);
    } else {
      setWebhookHeaders({});
    }
    if (step.webhook_query_params) {
      setWebhookQueryParams(step.webhook_query_params || {});
    } else {
      setWebhookQueryParams({});
    }
  }, [step]);

  // Load recent completed runs for this workflow
  useEffect(() => {
    if (!workflowId) return;
    
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getJobs({
          workflow_id: workflowId,
          status: "completed",
          limit: 20,
        });
        if (cancelled) return;
        setAvailableRuns(res?.jobs || []);
      } catch (_err) {
        if (cancelled) return;
        setAvailableRuns([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  // When a run is selected, fetch its execution steps
  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRunVars(null);
      setSelectedRunError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setSelectedRunLoading(true);
      setSelectedRunError(null);
      try {
        const executionSteps = await api.getExecutionSteps(selectedRunId);
        const runMeta = (availableRuns || []).find(
          (j: any) => j.job_id === selectedRunId,
        );

        const workflowSteps = (
          Array.isArray(executionSteps) ? executionSteps : []
        )
          .filter((s: any) => {
            const orderOk =
              typeof s?.step_order === "number" && s.step_order > 0;
            const typeOk =
              s?.step_type === "ai_generation" ||
              s?.step_type === "webhook" ||
              s?.step_type === "html_generation" ||
              s?.step_type === "workflow_step";
            return orderOk && typeOk;
          })
          .sort((a: any, b: any) => (a.step_order || 0) - (b.step_order || 0));

        const artifactIds = workflowSteps
          .map((s: any) => s?.artifact_id)
          .filter((id: any) => typeof id === "string" && id.trim().length > 0);

        const artifactRecords = await Promise.all(
          artifactIds.map(async (artifactId: string) => {
            try {
              return await api.getArtifact(artifactId);
            } catch {
              return null;
            }
          }),
        );

        const artifactUrlById = new Map<string, string>();
        artifactRecords.forEach((a: any) => {
          if (!a?.artifact_id) return;
          const url = a.public_url || a.object_url || a.url;
          if (url) artifactUrlById.set(a.artifact_id, String(url));
        });

        const runSteps = workflowSteps.map((s: any) => {
          const outputText =
            typeof s?.output === "string"
              ? s.output
              : s?.output !== undefined && s?.output !== null
                ? JSON.stringify(s.output)
                : "";
          const imageUrls = Array.isArray(s?.image_urls)
            ? s.image_urls.filter(Boolean).map(String)
            : [];
          const artifactId =
            typeof s?.artifact_id === "string" ? s.artifact_id : null;
          const artifactUrl = artifactId
            ? artifactUrlById.get(artifactId) || null
            : null;
          const artifactUrls = Array.from(
            new Set([...(artifactUrl ? [artifactUrl] : []), ...imageUrls]),
          );
          return {
            step_order: s?.step_order,
            step_name: s?.step_name,
            step_type: s?.step_type,
            output: outputText,
            artifact_id: artifactId,
            artifact_url: artifactUrl,
            artifact_urls: artifactUrls,
            image_urls: imageUrls,
          };
        });

        const vars = {
          job: {
            job_id: selectedRunId,
            workflow_id: runMeta?.workflow_id,
            status: runMeta?.status,
            created_at: runMeta?.created_at,
            output_url: runMeta?.output_url,
          },
          steps: runSteps,
        };

        if (cancelled) return;
        setSelectedRunVars(vars);
      } catch (err: any) {
        if (cancelled) return;
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load run data";
        setSelectedRunError(msg);
        setSelectedRunVars(null);
      } finally {
        if (cancelled) return;
        setSelectedRunLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRunId, availableRuns]);

  const handleTestHttpRequest = async () => {
    const url = (step.webhook_url || "").trim();
    if (!url) {
      toast.error("HTTP URL is required to test");
      return;
    }

    if (selectedRunId && selectedRunLoading) {
      toast("Loading run data…");
      return;
    }
    if (selectedRunId && !selectedRunVars) {
      toast.error("Selected run data could not be loaded");
      return;
    }

    const bodyMode = (step.webhook_body_mode || "auto") as
      | "auto"
      | "custom";
    const body = String(step.webhook_body || "");

    // Testing is only supported for custom bodies (auto payload requires a real run context)
    if (bodyMode !== "custom" || !body.trim()) {
      toast.error("Add a Custom Body to test this request");
      return;
    }

    setHttpTestLoading(true);
    setHttpTestError(null);
    setHttpTestResult(null);
    try {
      const mergedTestValues = {
        ...(selectedRunVars || {}),
        ...(httpTestValues || {}),
      };
      const result = await api.post<any>("/admin/http-request/test", {
        url,
        method:
          ((step.webhook_method || "POST") as HTTPMethod) ||
          "POST",
        headers: step.webhook_headers || {},
        query_params: step.webhook_query_params || {},
        content_type:
          step.webhook_content_type || "application/json",
        body,
        test_values: mergedTestValues,
      });
      setHttpTestResult(result);
      if (result?.response?.status) {
        toast.success(`Request completed (${result.response.status})`);
      } else {
        toast.success("Request completed");
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to test request";
      setHttpTestError(msg);
      toast.error(msg);
    } finally {
      setHttpTestLoading(false);
    }
  };

  const webhookBodyMode = (step.webhook_body_mode ||
    (step.webhook_body ? "custom" : "auto")) as "auto" | "custom";
  const webhookMethod =
    (step.webhook_method as HTTPMethod) || "POST";
  const webhookContentType = String(
    step.webhook_content_type || "application/json",
  );

  const copyJson = async (value: unknown, label: string) => {
    try {
      const text =
        typeof value === "string" ? value : JSON.stringify(value, null, 2);
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Unable to copy");
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Method
          </label>
          <select
            value={webhookMethod}
            onChange={(e) =>
              onChange(
                "webhook_method",
                e.target.value as HTTPMethod,
              )
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content-Type
          </label>
          <input
            type="text"
            value={webhookContentType}
            onChange={(e) =>
              onChange("webhook_content_type", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            placeholder="application/json"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          HTTP URL *
        </label>
        <input
          type="url"
          value={step.webhook_url || ""}
          onChange={(e) => onChange("webhook_url", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          placeholder="https://api.example.com/endpoint"
          required
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          The URL where the HTTP request will be sent.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Query Parameters (optional)
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Add query parameters to append to the URL.
        </p>
        <div className="space-y-3">
          {Object.entries(webhookQueryParams).map(
            ([key, value], idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={key}
                  onChange={(e) => {
                    const newParams = { ...webhookQueryParams };
                    delete newParams[key];
                    newParams[e.target.value] = value;
                    setWebhookQueryParams(newParams);
                    onChange("webhook_query_params", newParams);
                  }}
                  placeholder="Param name"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    const newParams = {
                      ...webhookQueryParams,
                      [key]: e.target.value,
                    };
                    setWebhookQueryParams(newParams);
                    onChange("webhook_query_params", newParams);
                  }}
                  placeholder="Param value"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newParams = { ...webhookQueryParams };
                    delete newParams[key];
                    setWebhookQueryParams(newParams);
                    onChange("webhook_query_params", newParams);
                  }}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Remove parameter"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            ),
          )}
          <button
            type="button"
            onClick={() => {
              const newParams = { ...webhookQueryParams, "": "" };
              setWebhookQueryParams(newParams);
            }}
            className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium px-1 py-0.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors w-fit"
          >
            <FiPlus className="w-3.5 h-3.5" />
            Add Query Parameter
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          HTTP Headers (optional)
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Add custom headers to include in the HTTP request (e.g.,
          Authorization).
        </p>
        <div className="space-y-3">
          {Object.entries(webhookHeaders).map(([key, value], idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const newHeaders = { ...webhookHeaders };
                  delete newHeaders[key];
                  newHeaders[e.target.value] = value;
                  setWebhookHeaders(newHeaders);
                  onChange("webhook_headers", newHeaders);
                }}
                placeholder="Header name"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  const newHeaders = {
                    ...webhookHeaders,
                    [key]: e.target.value,
                  };
                  setWebhookHeaders(newHeaders);
                  onChange("webhook_headers", newHeaders);
                }}
                placeholder="Header value"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => {
                  const newHeaders = { ...webhookHeaders };
                  delete newHeaders[key];
                  setWebhookHeaders(newHeaders);
                  onChange("webhook_headers", newHeaders);
                }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Remove header"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newHeaders = { ...webhookHeaders, "": "" };
              setWebhookHeaders(newHeaders);
            }}
            className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium px-1 py-0.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors w-fit"
          >
            <FiPlus className="w-3.5 h-3.5" />
            Add Header
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Body
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Choose whether to send an auto-generated payload (submission +
          step outputs) or write a custom body.
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
              <select
                value=""
                onChange={(e) => {
                  const token = e.target.value;
                  if (!token) return;
                  const current = String(
                    step.webhook_body || "",
                  );
                  onChange("webhook_body", current + token);
                  e.currentTarget.value = "";
                }}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all hover:border-gray-400 dark:hover:border-gray-500"
                aria-label="Insert variable"
                title="Insert a variable token"
              >
                <option value="">Insert variable…</option>
                <optgroup label="Job">
                  <option value="{{job.job_id}}">
                    {"{{job.job_id}}"}
                  </option>
                  <option value="{{job.workflow_id}}">
                    {"{{job.workflow_id}}"}
                  </option>
                  <option value="{{job.output_url}}">
                    {"{{job.output_url}}"}
                  </option>
                </optgroup>
                <optgroup label="Submission">
                  <option value="{{submission}}">
                    {"{{submission}}"}
                  </option>
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
              </select>
            </div>
            <textarea
              value={String(step.webhook_body || "")}
              onChange={(e) =>
                onChange("webhook_body", e.target.value)
              }
              className="w-full min-h-[180px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm transition-all"
              placeholder={`{\n  \"example\": \"{{some_value}}\"\n}`}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              You can reference variables like{" "}
              <span className="font-mono">{"{{job.job_id}}"}</span>,{" "}
              <span className="font-mono">
                {"{{submission.email}}"}
              </span>
              , or{" "}
              <span className="font-mono">{"{{steps.0.output}}"}</span>{" "}
              /{" "}
              <span className="font-mono">
                {"{{steps.0.artifact_url}}"}
              </span>
              . During testing, values in “Test values” will replace{" "}
              <span className="font-mono">{"{{your_key}}"}</span>.
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Selection
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Choose which data to include in the HTTP request payload.
              All step outputs are included by default.
            </p>

            <div className="space-y-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    step.webhook_data_selection
                      ?.include_submission !== false
                  }
                  onChange={(e) => {
                    const dataSelection =
                      step.webhook_data_selection || {
                        include_submission: true,
                        exclude_step_indices: [],
                        include_job_info: true,
                      };
                    onChange("webhook_data_selection", {
                      ...dataSelection,
                      include_submission: e.target.checked,
                    });
                  }}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  Include submission data
                </span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    step.webhook_data_selection
                      ?.include_job_info !== false
                  }
                  onChange={(e) => {
                    const dataSelection =
                      step.webhook_data_selection || {
                        include_submission: true,
                        exclude_step_indices: [],
                        include_job_info: true,
                      };
                    onChange("webhook_data_selection", {
                      ...dataSelection,
                      include_job_info: e.target.checked,
                    });
                  }}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
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
                    All step outputs are included by default. Check
                    steps to exclude from the payload.
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
                    {allSteps.map((otherStep, otherIndex) => {
                      if (otherIndex >= index) return null; // Can't exclude future steps
                      const isExcluded = (
                        step.webhook_data_selection
                          ?.exclude_step_indices || []
                      ).includes(otherIndex);
                      return (
                        <label
                          key={otherIndex}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isExcluded}
                            onChange={(e) => {
                              const dataSelection =
                                step.webhook_data_selection || {
                                  include_submission: true,
                                  exclude_step_indices: [],
                                  include_job_info: true,
                                };
                              const currentExcluded =
                                dataSelection.exclude_step_indices ||
                                [];
                              const newExcluded = e.target.checked
                                ? [...currentExcluded, otherIndex]
                                : currentExcluded.filter(
                                    (idx: number) => idx !== otherIndex,
                                  );
                              onChange("webhook_data_selection", {
                                ...dataSelection,
                                exclude_step_indices: newExcluded,
                              });
                            }}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-100">
                            Exclude:{" "}
                            {otherStep.step_name ||
                              `Step ${otherIndex + 1}`}
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

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card shadow-sm overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              Test request
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Sends the request server-side and shows what was sent and what came back.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTestHttpRequest}
            disabled={httpTestLoading || (selectedRunId ? selectedRunLoading : false)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all active:scale-[0.98] ${
              httpTestLoading
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700"
                : "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 shadow-sm"
            }`}
          >
            {httpTestLoading ? "Testing…" : httpTestResult ? "Test Again" : "Test Request"}
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Use data from a previous run (optional)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Select a completed run so placeholders like{" "}
              <span className="font-mono">{"{{steps.0.output}}"}</span> and{" "}
              <span className="font-mono">{"{{steps.0.artifact_url}}"}</span>{" "}
              resolve during testing.
            </p>

            {!workflowId ? (
              <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                Save this workflow to enable run selection.
              </div>
            ) : (
              <>
                <select
                  value={selectedRunId}
                  onChange={(e) => {
                    setSelectedRunId(e.target.value);
                    setHttpTestResult(null);
                    setHttpTestError(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                >
                  <option value="">No run selected</option>
                  {(availableRuns || []).map((job: any) => {
                    const createdAt = job?.created_at
                      ? new Date(job.created_at).toLocaleString()
                      : "";
                    const label = `${job?.job_id || "job"}${
                      createdAt ? ` • ${createdAt}` : ""
                    }`;
                    return (
                      <option key={job.job_id} value={job.job_id}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                {selectedRunId && (
                  <div className="mt-2">
                    {selectedRunLoading && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Loading run data…
                      </p>
                    )}
                    {selectedRunError && (
                      <p className="text-xs text-red-700 dark:text-red-400">
                        {selectedRunError}
                      </p>
                    )}
                    {selectedRunVars?.steps &&
                      Array.isArray(selectedRunVars.steps) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Loaded{" "}
                          <span className="font-medium">
                            {selectedRunVars.steps.length}
                          </span>{" "}
                          step outputs from this run.
                        </p>
                      )}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Test values (optional)
              </label>
              <button
                type="button"
                onClick={() => setHttpTestValues({ ...httpTestValues, "": "" })}
                className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold px-2 py-1 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-lg transition-colors"
              >
                <FiPlus className="w-3.5 h-3.5" />
                Add value
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              These replace <span className="font-mono">{"{{key}}"}</span>{" "}
              placeholders during testing.
            </p>

            <div className="space-y-3">
              {Object.entries(httpTestValues).map(([key, value], idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => {
                      const newVals = { ...httpTestValues };
                      delete newVals[key];
                      newVals[e.target.value] = value;
                      setHttpTestValues(newVals);
                    }}
                    placeholder="key"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const newVals = {
                        ...httpTestValues,
                        [key]: e.target.value,
                      };
                      setHttpTestValues(newVals);
                    }}
                    placeholder="value"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newVals = { ...httpTestValues };
                      delete newVals[key];
                      setHttpTestValues(newVals);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remove value"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {httpTestError && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {httpTestError}
            </div>
          )}

          {httpTestResult && (() => {
            const sentPayload = {
              method: httpTestResult.request?.method,
              url: httpTestResult.request?.url,
              headers: httpTestResult.request?.headers,
              body:
                httpTestResult.request?.body_json !== null &&
                httpTestResult.request?.body_json !== undefined
                  ? httpTestResult.request?.body_json
                  : httpTestResult.request?.body,
            };
            const responsePayload = {
              status: httpTestResult.response?.status,
              headers: httpTestResult.response?.headers,
              body:
                httpTestResult.response?.body_json !== null &&
                httpTestResult.response?.body_json !== undefined
                  ? httpTestResult.response?.body_json
                  : httpTestResult.response?.body,
            };

            return (
              <div className="space-y-3">
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    httpTestResult.ok
                      ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200"
                      : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200"
                  }`}
                >
                  {httpTestResult.ok ? "Request success" : "Request completed"} with status:{" "}
                  <span className="font-mono">
                    {httpTestResult.response?.status ?? "N/A"}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <span>Sent</span>
                      <button
                        type="button"
                        onClick={() => copyJson(sentPayload, "Request")}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <FiCopy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                    </div>
                    <div className="p-3">
                      <JsonViewer
                        value={sentPayload}
                        raw={JSON.stringify(sentPayload, null, 2)}
                        defaultMode="tree"
                        defaultExpandedDepth={2}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <span>Response</span>
                      <button
                        type="button"
                        onClick={() => copyJson(responsePayload, "Response")}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <FiCopy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                    </div>
                    <div className="p-3">
                      <JsonViewer
                        value={responsePayload}
                        raw={JSON.stringify(responsePayload, null, 2)}
                        defaultMode="tree"
                        defaultExpandedDepth={2}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}

