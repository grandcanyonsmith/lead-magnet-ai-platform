"use client";

import React, { useState, useEffect } from "react";
import {
  FiPlay,
  FiStopCircle,
  FiChevronDown,
  FiChevronUp,
  FiCheckCircle,
  FiXCircle,
  FiTrash2,
  FiCopy,
} from "react-icons/fi";
import { WorkflowStep } from "@/types/workflow";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { JsonViewer } from "@/components/ui/JsonViewer";
import StreamViewer from "./StreamViewer";

interface StepTesterProps {
  step: WorkflowStep;
  index: number;
}

export default function StepTester({ step, index }: StepTesterProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [testInput, setTestInput] = useState("{}");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [showStream, setShowStream] = useState(false);
  const [testOverrides, setTestOverrides] = useState<Record<string, any>>({});
  const [pollInterval, setPollInterval] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  // Helper to determine API URL (duplicated from base.client.ts)
  const getApiUrl = () => {
    const envUrl = (process.env.NEXT_PUBLIC_API_URL || "").trim();
    if (envUrl) return envUrl;
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        const origin = window.location.origin || "http://localhost:3000";
        return origin.replace(/:\d+$/, ":3001");
      }
    }
    return "https://czp5b77azd.execute-api.us-east-1.amazonaws.com";
  };

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const handleStopTest = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    setPollInterval(null);
    setIsTesting(false);
    setShowStream(false);
    toast("Test cancelled");
  };

  const getPrimaryOutput = (result: any): string | null => {
    if (!result) return null;
    if (typeof result.primary_output === "string" && result.primary_output) {
      return result.primary_output;
    }
    const steps = result?.execution_steps;
    if (Array.isArray(steps) && steps.length > 0) {
      // Prefer S3 publish step output (object_url) if present
      for (let i = steps.length - 1; i >= 0; i--) {
        const s = steps[i];
        if (!s || typeof s !== "object") continue;
        if (s.step_type !== "s3_upload") continue;
        const out = (s as any).output;
        const objectUrl =
          out && typeof out === "object" && "object_url" in out
            ? String((out as any).object_url || "")
            : "";
        if (objectUrl) return objectUrl;
      }

      // Fall back to first non-empty string output (e.g., AI generation HTML)
      for (const s of steps) {
        const out = s?.output;
        if (typeof out === "string" && out) return out;
      }
    }
    return null;
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Unable to copy");
    }
  };

  const handleTestStep = async () => {
    try {
      let inputData = {};
      try {
        inputData = JSON.parse(testInput);
      } catch {
        toast.error("Invalid JSON input");
        return;
      }

      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }

      setIsTesting(true);
      setTestResult(null);
      setShowStream(false);

      // Check if this is a CUA step (computer use) or Shell step
      const tools = step.tools || [];
      const hasComputerUse = Array.isArray(tools) && tools.some((t: any) => 
        (typeof t === 'string' && t === 'computer_use_preview') || 
        (typeof t === 'object' && t.type === 'computer_use_preview')
      );
      const hasShell = Array.isArray(tools) && tools.some((t: any) => 
        (typeof t === 'string' && t === 'shell') || 
        (typeof t === 'object' && t.type === 'shell')
      );
      const hasWebSearch = Array.isArray(tools) && tools.some((t: any) => 
        (typeof t === 'string' && t === 'web_search') || 
        (typeof t === 'object' && t.type === 'web_search')
      );
      
      const isWebhookStep = Boolean(
        (step.webhook_url && step.webhook_url.trim()) ||
          step.step_type === "webhook",
      );
      const isHandoffStep = Boolean(
        step.handoff_workflow_id && step.handoff_workflow_id.trim(),
      );

      // Also enable for general AI generation (text output)
      const isAiGeneration =
        (!step.step_type || step.step_type === "ai_generation") &&
        !isWebhookStep &&
        !isHandoffStep;

      if (hasComputerUse || hasShell || hasWebSearch || isAiGeneration) {
        setShowStream(true);
        // We don't start polling here; StreamViewer will handle the request
        return;
      }

      const testStartResp = await api.testStep({
        step,
        input: inputData,
      });
      const job_id = (testStartResp as any)?.job_id;

      if (!job_id || typeof job_id !== "string") {
        setIsTesting(false);
        setTestResult({ error: "No job_id returned from test-step endpoint" });
        toast.error("Failed to start test (missing job_id)");
        return;
      }

      toast.success("Test started");

      // Start polling
      let pollCount = 0;
      const interval = setInterval(async () => {
        try {
          pollCount += 1;
          if (pollCount > 90) {
            clearInterval(interval);
            setPollInterval(null);
            setIsTesting(false);
            setTestResult({ error: "Timed out waiting for a result" });
            toast.error("Test timed out");
            return;
          }
          // 1) Check job status/errors
          const job = await api.getJob(job_id);

          if (job.status === "failed" || job.error_message) {
            clearInterval(interval);
            setPollInterval(null);
            setIsTesting(false);
            setTestResult({ error: job.error_message || "Unknown error" });
            toast.error("Test failed");
            return;
          }

          // 2) Fetch execution steps (source of truth for step output)
          const steps = await api.getExecutionSteps(job_id);
          if (Array.isArray(steps) && steps.length > 0) {
            clearInterval(interval);
            setPollInterval(null);
            setIsTesting(false);

            setTestResult({
              execution_steps: steps,
              primary_output: steps[0]?.output,
            });
            toast.success("Test completed");
            return;
          }
        } catch (err) {
          console.error("Polling error", err);
          // Don't stop polling immediately on transient errors
        }
      }, 2000);

      setPollInterval(interval);
    } catch (err: any) {
      setIsTesting(false);
      toast.error(err.message || "Failed to start test");
    }
  };

  return (
    <div className="mt-8 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${
          isOpen
            ? "bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700"
            : "bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-gray-800/50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              isOpen
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            <FiPlay className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="block font-semibold text-gray-900 dark:text-gray-100 text-sm">
              Test Step
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5">
              Run this step individually with custom input
            </span>
          </div>
        </div>
        {isOpen ? (
          <FiChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <FiChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="p-5 bg-white dark:bg-card space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Test Input (JSON)
              </label>
              <button
                type="button"
                onClick={() => setTestInput("{}")}
                className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                title="Reset to empty object"
              >
                <FiTrash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
            <div className="relative">
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-y min-h-[120px]"
                rows={5}
                placeholder="{}"
              />
              <div className="absolute bottom-3 right-3 pointer-events-none">
                <span className="text-[10px] text-gray-400 px-2 py-1 bg-white/50 dark:bg-black/50 rounded-md backdrop-blur-sm border border-gray-200 dark:border-gray-700">
                  JSON
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              Provide input variables that this step expects (e.g., from
              previous steps).
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={isTesting ? handleStopTest : handleTestStep}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all transform active:scale-[0.98] ${
                isTesting
                  ? "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-md hover:shadow-lg shadow-green-900/20"
              }`}
            >
              {isTesting ? (
                <>
                  <FiStopCircle className="w-4 h-4" />
                  Stop Test
                </>
              ) : (
                <>
                  <FiPlay className="w-4 h-4" />
                  Run Test
                </>
              )}
            </button>
          </div>

          {showStream && (
             <div className="mt-6">
               <StreamViewer 
                 endpoint={(() => {
                    // Use CUA endpoint for everything as it supports the full agent loop streaming
                    // It handles computer use, shell, and generic text/tool interactions
                    return `${getApiUrl()}/admin/cua/execute`;
                 })()}
                 requestBody={(() => {
                    let inputData: any = {};
                    try { inputData = JSON.parse(testInput); } catch {}
                    
                    const instructions = step.instructions || "";

                    const codeInterpreterContainer = (() => {
                      if (!inputData || typeof inputData !== "object") return null;
                      const containerOverride = inputData.code_interpreter_container;
                      const containerId =
                        typeof inputData.code_interpreter_container_id === "string"
                          ? inputData.code_interpreter_container_id.trim()
                          : "";
                      const memoryLimit =
                        typeof inputData.code_interpreter_memory_limit === "string"
                          ? inputData.code_interpreter_memory_limit.trim()
                          : "";

                      let container: Record<string, any> | null = null;
                      if (
                        containerOverride &&
                        typeof containerOverride === "object" &&
                        !Array.isArray(containerOverride)
                      ) {
                        container = { ...(containerOverride as Record<string, any>) };
                      } else if (containerId) {
                        container = { type: "explicit", id: containerId };
                      }

                      if (container && memoryLimit && !("memory_limit" in container)) {
                        container.memory_limit = memoryLimit;
                      }

                      return container;
                    })();

                    const tools = (() => {
                      const baseTools = Array.isArray(step.tools) ? [...step.tools] : [];
                      if (!codeInterpreterContainer) return baseTools;

                      let hasCodeInterpreter = false;
                      const patched = baseTools.map((tool: any) => {
                        if (tool === "code_interpreter") {
                          hasCodeInterpreter = true;
                          return {
                            type: "code_interpreter",
                            container: codeInterpreterContainer,
                          };
                        }
                        if (tool && typeof tool === "object" && tool.type === "code_interpreter") {
                          hasCodeInterpreter = true;
                          return {
                            ...tool,
                            container: {
                              ...(tool.container || {}),
                              ...codeInterpreterContainer,
                            },
                          };
                        }
                        return tool;
                      });

                      if (!hasCodeInterpreter) {
                        patched.push({
                          type: "code_interpreter",
                          container: codeInterpreterContainer,
                        });
                      }

                      return patched;
                    })();
                    const toolChoice = step.tool_choice || "required";
                    
                    // Enforce computer-use-preview model when computer_use_preview tool is present
                    let model = step.model || "computer-use-preview";
                    const hasComputerUse = Array.isArray(tools) && tools.some((t: any) => 
                        (typeof t === 'string' && t === 'computer_use_preview') || 
                        (typeof t === 'object' && t.type === 'computer_use_preview')
                    );
                    if (hasComputerUse && model !== "computer-use-preview") {
                        console.warn(`[StepTester] Overriding model from ${model} to computer-use-preview (required for computer_use_preview tool)`);
                        model = "computer-use-preview";
                    } else if (!hasComputerUse && !step.model) {
                        // Default to gpt-5.2 for shell if no model specified
                        model = "gpt-5.2";
                    }
                    
                    // Determine input_text from testInput or default
                    const rawPrompt =
                      (typeof inputData.input_text === "string" &&
                      inputData.input_text.trim().length > 0
                        ? inputData.input_text
                        : undefined) ||
                      (typeof inputData.user_prompt === "string" &&
                      inputData.user_prompt.trim().length > 0
                        ? inputData.user_prompt
                        : undefined) ||
                      "Start the task.";

                    // Inject the full test input JSON into the model context so shell/CUA steps can
                    // reference variables (e.g., {"coursetopic": "..."}), even when no explicit
                    // user prompt is provided.
                    const {
                      input_text: _ignoredInputText,
                      user_prompt: _ignoredUserPrompt,
                      code_interpreter_container: _ignoredContainer,
                      code_interpreter_container_id: _ignoredContainerId,
                      code_interpreter_memory_limit: _ignoredMemoryLimit,
                      ...vars
                    } = inputData || {};
                    const varsJson =
                      vars && Object.keys(vars).length > 0
                        ? JSON.stringify(vars, null, 2)
                        : "";
                    const inputText = varsJson
                      ? `Input variables (JSON):\n${varsJson}\n\nTask:\n${rawPrompt}`
                      : rawPrompt;
                    
                    return {
                        job_id: `test-step-${Date.now()}`,
                        model,
                        instructions,
                        input_text: inputText,
                        tools,
                        tool_choice: toolChoice,
                        params: vars,
                        reasoning_effort: step.reasoning_effort,
                        service_tier: step.service_tier,
                        text_verbosity: step.text_verbosity,
                        ...testOverrides
                    };
                 })()}
                 onUpdateSettings={(updates) => {
                   setTestOverrides(prev => ({ ...prev, ...updates }));
                 }}
                 onClose={() => {
                    setShowStream(false);
                    setIsTesting(false);
                 }}
               />
             </div>
          )}

          {!showStream && testResult && (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <span>Result</span>
                  {testResult.error ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium">
                      <FiXCircle className="w-3 h-3" />
                      Failed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                      <FiCheckCircle className="w-3 h-3" />
                      Success
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {(() => {
                    const primaryOutput = getPrimaryOutput(testResult);
                    if (!primaryOutput) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => copyText(primaryOutput, "Output")}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                        title="Copy primary output"
                      >
                        <FiCopy className="w-4 h-4" />
                        Copy output
                      </button>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() =>
                      copyText(JSON.stringify(testResult, null, 2), "JSON")
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    title="Copy full result JSON"
                  >
                    <FiCopy className="w-4 h-4" />
                    Copy JSON
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-inner">
                <div className="p-1">
                  <JsonViewer
                    value={testResult}
                    raw={JSON.stringify(testResult, null, 2)}
                    defaultMode="tree"
                    defaultExpandedDepth={2}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
