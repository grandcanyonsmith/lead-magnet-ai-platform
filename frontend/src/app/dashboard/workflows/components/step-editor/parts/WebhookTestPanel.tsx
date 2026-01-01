import React from "react";
import { FiCopy, FiPlus, FiTrash2 } from "react-icons/fi";
import { JsonViewer } from "@/components/ui/JsonViewer";
import toast from "react-hot-toast";

interface WebhookTestPanelProps {
  httpTestLoading: boolean;
  httpTestResult: any;
  httpTestError: string | null;
  handleTestHttpRequest: () => void;

  selectedRunId: string;
  setSelectedRunId: (id: string) => void;
  selectedRunLoading: boolean;
  selectedRunError: string | null;
  availableRuns: any[];
  workflowId?: string;
  selectedRunVars: any;

  httpTestValues: Record<string, string>;
  setHttpTestValues: (values: Record<string, string>) => void;
}

export function WebhookTestPanel({
  httpTestLoading,
  httpTestResult,
  httpTestError,
  handleTestHttpRequest,

  selectedRunId,
  setSelectedRunId,
  selectedRunLoading,
  selectedRunError,
  availableRuns,
  workflowId,
  selectedRunVars,

  httpTestValues,
  setHttpTestValues,
}: WebhookTestPanelProps) {
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card shadow-sm overflow-hidden mt-6">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            Test request
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Sends the request server-side and shows what was sent and what came
            back.
          </p>
        </div>
        <button
          type="button"
          onClick={handleTestHttpRequest}
          disabled={
            httpTestLoading || (selectedRunId ? selectedRunLoading : false)
          }
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all active:scale-[0.98] ${
            httpTestLoading
              ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700"
              : "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 shadow-sm"
          }`}
        >
          {httpTestLoading
            ? "Testing…"
            : httpTestResult
              ? "Test Again"
              : "Test Request"}
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

        {httpTestResult &&
          (() => {
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
                  {httpTestResult.ok
                    ? "Request success"
                    : "Request completed"}{" "}
                  with status:{" "}
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
  );
}
