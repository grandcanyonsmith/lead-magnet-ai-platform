import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/hooks/api/useSettings";
import { useWorkflowSteps } from "@/hooks/useWorkflowSteps";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import type { AccumulatedContext, SidebarTab, StepResult } from "../types";

export function usePlaygroundState() {
  const router = useRouter();
  const { settings } = useSettings();

  // Workflow Steps Hook
  const {
    steps = [],
    addStep,
    updateStep,
    deleteStep,
    moveStepUp,
    moveStepDown,
    setStepsFromAIGeneration,
    reorderSteps,
    isLoaded: stepsLoaded,
  } = useWorkflowSteps({
    persistKey: "playground-steps",
    defaultToolChoice: settings?.default_tool_choice,
    defaultServiceTier: settings?.default_service_tier,
    defaultTextVerbosity: settings?.default_text_verbosity || undefined,
  });

  // State
  const [currentInput, setCurrentInput] = useState<string>("{}");
  const [accumulatedContext, setAccumulatedContext] = useState<AccumulatedContext>({});
  const [executionResults, setExecutionResults] = useState<StepResult[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Layout State
  const [activeTab, setActiveTab] = useState<SidebarTab>("input");
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState<any[]>([]);
  const [inputLoaded, setInputLoaded] = useState(false);

  // Context Editing
  const [isEditingContext, setIsEditingContext] = useState(false);
  const [contextEditValue, setContextEditValue] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Computed
  const contextSummary = useMemo(() => {
    const jsonString = JSON.stringify(accumulatedContext || {}, null, 2);
    const sizeKb = Math.max(1, Math.round(jsonString.length / 1024));
    const topKeys = Object.keys(accumulatedContext || {});
    return { sizeKb, keys: topKeys.length };
  }, [accumulatedContext]);

  const stepsCount = steps.length;
  const activeStepNumber = typeof activeStepIndex === "number" ? activeStepIndex + 1 : null;
  const selectedStepNumber = typeof selectedStepIndex === "number" ? selectedStepIndex + 1 : null;
  const selectedStep = typeof selectedStepIndex === "number" ? steps[selectedStepIndex] : null;
  const selectedStepLabel = selectedStep && selectedStepNumber
    ? selectedStep.step_name || `Step ${selectedStepNumber}`
    : null;

  // Effects
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedInput = localStorage.getItem("playground-input");
      if (savedInput) {
        setCurrentInput(savedInput);
      }
      setInputLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && inputLoaded) {
      localStorage.setItem("playground-input", currentInput);
    }
  }, [currentInput, inputLoaded]);

  useEffect(() => {
    if (isExecuting) {
      setActiveTab("logs");
    }
  }, [isExecuting]);

  useEffect(() => {
    if (activeTab === "logs" && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  // Actions
  const handleStepClick = (index: number) => {
    setSelectedStepIndex(index);
    setActiveTab("step-config");
  };

  const handleStepSuccess = useCallback((index: number, output: any, startTime: number) => {
    const duration = Date.now() - startTime;
    setExecutionResults((prev) => {
      const next = [...prev];
      const existingIdx = next.findIndex((r) => r.stepIndex === index);
      if (existingIdx >= 0) next.splice(existingIdx, 1);

      next.push({
        stepIndex: index,
        output,
        status: "success",
        duration,
      });
      return next.sort((a, b) => a.stepIndex - b.stepIndex);
    });
  }, []);

  const handleStepError = useCallback((index: number, error: string, startTime: number) => {
    const duration = Date.now() - startTime;
    setExecutionResults((prev) => {
      const next = [...prev];
      const existingIdx = next.findIndex((r) => r.stepIndex === index);
      if (existingIdx >= 0) next.splice(existingIdx, 1);

      next.push({
        stepIndex: index,
        output: null,
        status: "error",
        error,
        duration,
      });
      return next.sort((a, b) => a.stepIndex - b.stepIndex);
    });
  }, []);

  const handleRunNextStep = async () => {
    const nextIndex = activeStepIndex === null ? 0 : activeStepIndex + 1;

    if (nextIndex >= steps.length) {
      toast("All steps completed");
      setActiveStepIndex(null);
      setIsExecuting(false);
      return;
    }

    setIsExecuting(true);
    setActiveStepIndex(nextIndex);
    setSelectedStepIndex(nextIndex);
    setLogs([]);
    setActiveTab("logs");

    const step = steps[nextIndex];
    const startTime = Date.now();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      let initialInputData = {};
      try {
        initialInputData = JSON.parse(currentInput);
      } catch {
        // ignore
      }

      const stepInput = {
        ...initialInputData,
        ...accumulatedContext,
      };

      await api.streamTestStep(
        {
          step,
          input: stepInput,
        },
        {
          onLog: (log) => setLogs((prev) => [...prev, log]),
          onComplete: async (data) => {
            if (signal.aborted) return;
            if (data?.job_id) {
              const jobSteps = await api.getExecutionSteps(data.job_id);
              if (jobSteps && jobSteps.length > 0) {
                const output = jobSteps[0].output;
                handleStepSuccess(nextIndex, output, startTime);
                setAccumulatedContext((prev) => ({ ...prev, ...output }));
              }
            } else {
              handleStepSuccess(nextIndex, {}, startTime);
            }
            setIsExecuting(false);
          },
          onError: (err) => {
            if (signal.aborted) return;
            handleStepError(nextIndex, err, startTime);
            setLogs((prev) => [...prev, `Error: ${err}`]);
            setIsExecuting(false);
          },
        },
        signal
      );
    } catch (error: any) {
      if (!signal.aborted) {
        handleStepError(nextIndex, error.message || "Failed to start step", startTime);
        setIsExecuting(false);
      }
    }
  };

  const handleRunAll = useCallback(async () => {
    setIsExecuting(true);
    setActiveStepIndex(0);
    setSelectedStepIndex(0);
    setExecutionResults([]);
    setAccumulatedContext({});
    setLogs([]);
    setActiveTab("logs");

    let initialInputData = {};
    try {
      initialInputData = JSON.parse(currentInput);
    } catch {
      toast.error("Invalid Initial Input JSON");
      setIsExecuting(false);
      return;
    }

    const startTime = Date.now(); // Not used for total duration currently but good to have

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      await api.streamTestWorkflow(
        {
          steps,
          input: initialInputData,
        },
        {
          onLog: (log) => {
            if (signal.aborted) return;
            setLogs((prev) => [...prev, log]);
          },
          onComplete: async (data) => {
            if (signal.aborted) return;
            if (data?.job_id) {
              const jobSteps = await api.getExecutionSteps(data.job_id);
              if (Array.isArray(jobSteps)) {
                let newContext = { ...initialInputData };
                const results: StepResult[] = jobSteps.map((s, i) => {
                  newContext = { ...newContext, ...s.output };
                  return {
                    stepIndex: i,
                    output: s.output,
                    status: s.status === "completed" ? "success" : "error",
                    error: s.error,
                    duration: 0,
                  };
                });

                setExecutionResults(results);
                setAccumulatedContext(newContext);
                setActiveStepIndex(steps.length - 1);
              }
            }
            setIsExecuting(false);
            toast.success("Workflow completed");
          },
          onError: (err) => {
            if (signal.aborted) return;
            toast.error("Workflow failed: " + err);
            setLogs((prev) => [...prev, `[Error] ${err}`]);
            setIsExecuting(false);
          },
        },
        signal
      );
    } catch (error: any) {
      if (!signal.aborted) {
        toast.error("Failed to start workflow: " + error.message);
        setIsExecuting(false);
      }
    }
  }, [currentInput, steps]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsExecuting(false);
      toast("Execution stopped");
      setLogs((prev) => [...prev, "[System] Execution stopped by user."]);
    }
  };

  const handleImport = async () => {
    setImportModalOpen(true);
    setLoadingWorkflows(true);
    try {
      const res = await api.getWorkflows();
      setAvailableWorkflows(res.workflows || []);
    } catch (e) {
      toast.error("Failed to load workflows");
    } finally {
      setLoadingWorkflows(false);
    }
  };

  const selectWorkflowToImport = async (id: string) => {
    try {
      const wf = await api.getWorkflow(id);
      if (wf.steps) {
        setStepsFromAIGeneration(wf.steps);
        toast.success("Workflow imported");
        setImportModalOpen(false);
      }
    } catch (e) {
      toast.error("Failed to import details");
    }
  };

  const handleExport = async () => {
    if (steps.length === 0) {
      toast.error("No steps to export");
      return;
    }
    try {
      const name = `Playground Export ${new Date().toLocaleTimeString()}`;
      await api.createWorkflow({
        workflow_name: name,
        workflow_description: "Exported from Playground",
        steps: steps,
      });
      toast.success("Saved as new workflow!");
      router.push("/dashboard/workflows");
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  };

  const handleReset = () => {
    if (confirm("Clear all steps and state?")) {
      setStepsFromAIGeneration([]);
      setAccumulatedContext({});
      setExecutionResults([]);
      setActiveStepIndex(null);
      setSelectedStepIndex(null);
      setCurrentInput("{}");
      localStorage.removeItem("playground-input");
      localStorage.removeItem("playground-steps");
      toast.success("Reset");
    }
  };

  const handleEditContext = () => {
    setContextEditValue(JSON.stringify(accumulatedContext, null, 2));
    setIsEditingContext(true);
  };

  const handleCopyContext = async () => {
    try {
      const payload = JSON.stringify(accumulatedContext || {}, null, 2);
      await navigator.clipboard.writeText(payload);
      toast.success("Context copied to clipboard");
    } catch (err) {
      console.error(err);
      toast.error("Unable to copy context");
    }
  };

  const handleSaveContext = () => {
    try {
      const parsed = JSON.parse(contextEditValue);
      setAccumulatedContext(parsed);
      setIsEditingContext(false);
      toast.success("Context updated manually");
    } catch (e) {
      toast.error("Invalid JSON");
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (!isExecuting && steps.length > 0) {
          e.preventDefault();
          handleRunAll();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRunAll, isExecuting, steps]);

  return {
    steps,
    addStep,
    updateStep,
    deleteStep,
    moveStepUp,
    moveStepDown,
    reorderSteps,
    stepsLoaded,
    currentInput,
    setCurrentInput,
    accumulatedContext,
    setAccumulatedContext,
    executionResults,
    setExecutionResults,
    activeStepIndex,
    isExecuting,
    activeTab,
    setActiveTab,
    selectedStepIndex,
    setSelectedStepIndex,
    importModalOpen,
    setImportModalOpen,
    loadingWorkflows,
    availableWorkflows,
    isEditingContext,
    setIsEditingContext,
    contextEditValue,
    setContextEditValue,
    logs,
    setLogs,
    logsEndRef,
    contextSummary,
    stepsCount,
    activeStepNumber,
    selectedStepNumber,
    selectedStep,
    selectedStepLabel,
    handleStepClick,
    handleRunNextStep,
    handleRunAll,
    handleStop,
    handleImport,
    selectWorkflowToImport,
    handleExport,
    handleReset,
    handleEditContext,
    handleCopyContext,
    handleSaveContext,
  };
}
