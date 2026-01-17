"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiCode,
  FiDatabase,
  FiEdit2,
  FiFileText,
  FiLoader,
  FiPlay,
  FiRotateCcw,
  FiSave,
  FiSettings,
  FiSkipForward,
  FiTerminal,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { useWorkflowSteps } from "@/hooks/useWorkflowSteps";
import WorkflowFlowchart from "../workflows/components/WorkflowFlowchart";
import WorkflowStepEditor from "../workflows/components/WorkflowStepEditor";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { useSettings } from "@/hooks/api/useSettings";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { LogViewer } from "./components/LogViewer";
import type { AccumulatedContext, SidebarTab, StepResult } from "./types";

export default function PlaygroundPage() {
  const router = useRouter();
  const { settings } = useSettings();
  
  // State
  const {
    steps = [],
    addStep,
    updateStep,
    deleteStep,
    moveStepUp,
    moveStepDown,
    setStepsFromAIGeneration,
    reorderSteps,
    isLoaded: stepsLoaded
  } = useWorkflowSteps({
    persistKey: "playground-steps",
    defaultToolChoice: settings?.default_tool_choice,
    defaultServiceTier: settings?.default_service_tier,
    defaultTextVerbosity: settings?.default_text_verbosity || undefined,
  });
  
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

  // Load persisted input
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedInput = localStorage.getItem("playground-input");
      if (savedInput) {
        setCurrentInput(savedInput);
      }
      setInputLoaded(true);
    }
  }, []);

  // Save input on change
  useEffect(() => {
    if (typeof window !== "undefined" && inputLoaded) {
      localStorage.setItem("playground-input", currentInput);
    }
  }, [currentInput, inputLoaded]);

  // Scroll to logs when executing
  useEffect(() => {
      if (isExecuting) {
          setActiveTab("logs");
      }
  }, [isExecuting]);

  // Scroll to bottom of logs
  useEffect(() => {
    if (activeTab === "logs" && logsEndRef.current) {
        logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  // Select step when added or clicked
  useEffect(() => {
      if (steps.length > 0 && selectedStepIndex === null) {
          // Don't auto select, maybe? Or select first?
          // setSelectedStepIndex(0);
      }
  }, [steps.length, selectedStepIndex]);

  // When a step is selected, switch to config tab
  const handleStepClick = (index: number) => {
      setSelectedStepIndex(index);
      setActiveTab("step-config");
  };

  // Execution Logic: Run Next Step
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
    setSelectedStepIndex(nextIndex); // Highlight current running step
    
    // Clear logs for single step run? Or append? Let's clear for clarity or maybe add a separator.
    setLogs([]); 
    setActiveTab("logs");

    const step = steps[nextIndex];
    const startTime = Date.now();

    // Setup abort controller
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
        ...accumulatedContext
      };

      await api.streamTestStep({
        step,
        input: stepInput
      }, {
        onLog: (log) => setLogs(prev => [...prev, log]),
        onComplete: async (data) => {
            if (signal.aborted) return;
            if (data?.job_id) {
                // Fetch structured result
                const jobSteps = await api.getExecutionSteps(data.job_id);
                if (jobSteps && jobSteps.length > 0) {
                    const output = jobSteps[0].output;
                    handleStepSuccess(nextIndex, output, startTime);
                    setAccumulatedContext(prev => ({ ...prev, ...output }));
                }
            } else {
                // Fallback if no job_id (shouldn't happen with correct backend)
                handleStepSuccess(nextIndex, {}, startTime);
            }
            setIsExecuting(false);
        },
        onError: (err) => {
            if (signal.aborted) return;
            handleStepError(nextIndex, err, startTime);
            setLogs(prev => [...prev, `Error: ${err}`]);
            setIsExecuting(false);
        }
      }, signal);

    } catch (error: any) {
      if (!signal.aborted) {
        handleStepError(nextIndex, error.message || "Failed to start step", startTime);
        setIsExecuting(false);
      }
    }
  };

  // Execution Logic: Run All
  const handleRunAll = async () => {
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

    const startTime = Date.now();

    // Setup abort controller
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
       await api.streamTestWorkflow({
          steps,
          input: initialInputData
       }, {
          onLog: (log) => {
              if (signal.aborted) return;
              setLogs(prev => [...prev, log]);
              // Try to detect step progress from logs (optional/hacky but nice for UX)
              // Log format: "[Worker] Processing step 1/5..." or similar?
              // The worker logs: "Processing step X..." (it might not be structured perfectly).
          },
          onComplete: async (data) => {
              if (signal.aborted) return;
              if (data?.job_id) {
                  // Fetch all results
                  const jobSteps = await api.getExecutionSteps(data.job_id);
                  if (Array.isArray(jobSteps)) {
                      // Update all steps results
                      let newContext = { ...initialInputData };
                      const results: StepResult[] = jobSteps.map((s, i) => {
                          newContext = { ...newContext, ...s.output };
                          return {
                              stepIndex: i,
                              output: s.output,
                              status: s.status === 'completed' ? 'success' : 'error',
                              error: s.error,
                              duration: 0 // We don't have exact duration per step from this bulk fetch easily without more parsing
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
              setLogs(prev => [...prev, `[Error] ${err}`]);
              setIsExecuting(false);
          }
       }, signal);

    } catch (error: any) {
       if (!signal.aborted) {
         toast.error("Failed to start workflow: " + error.message);
         setIsExecuting(false);
       }
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command/Ctrl + Enter to Run All
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

  const handleStop = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsExecuting(false);
        toast("Execution stopped");
        setLogs(prev => [...prev, "[System] Execution stopped by user."]);
    }
  };

  const handleStepSuccess = (index: number, output: any, startTime: number) => {
      const duration = Date.now() - startTime;
      setExecutionResults(prev => {
          const next = [...prev];
          // Remove existing result for this index if any
          const existingIdx = next.findIndex(r => r.stepIndex === index);
          if (existingIdx >= 0) next.splice(existingIdx, 1);
          
          next.push({
              stepIndex: index,
              output,
              status: "success",
              duration
          });
          return next.sort((a, b) => a.stepIndex - b.stepIndex);
      });
  };

  const handleStepError = (index: number, error: string, startTime: number) => {
      const duration = Date.now() - startTime;
      setExecutionResults(prev => {
          const next = [...prev];
          const existingIdx = next.findIndex(r => r.stepIndex === index);
          if (existingIdx >= 0) next.splice(existingIdx, 1);
          
          next.push({
              stepIndex: index,
              output: null,
              status: "error",
              error,
              duration
          });
          return next.sort((a, b) => a.stepIndex - b.stepIndex);
      });
  };

  // Import Workflow
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

  // Export Workflow
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

  // Context Edit Handling
  const handleEditContext = () => {
      setContextEditValue(JSON.stringify(accumulatedContext, null, 2));
      setIsEditingContext(true);
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

  if (!stepsLoaded) {
    return <div className="h-full flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex h-[calc(100vh-65px)] flex-col overflow-hidden bg-muted/30">
      
      {/* Top Bar */}
      <div className="flex flex-col gap-3 px-4 py-3 bg-background border-b border-border shadow-sm z-10 shrink-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
           <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <h1 className="text-lg font-bold flex items-center gap-2">
                 <FiCode className="text-primary" />
                 Playground
              </h1>
              <div className="hidden h-6 w-px bg-border/60 sm:block" />
              <div className="flex flex-wrap items-center gap-2">
                 {!isExecuting ? (
                     <>
                        <button 
                            onClick={handleRunAll}
                            disabled={steps.length === 0}
                            className="flex items-center gap-2 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors sm:px-3 sm:text-sm"
                            title="Command+Enter"
                        >
                            <FiPlay className="w-4 h-4" />
                            Run All
                        </button>
                        <button 
                            onClick={handleRunNextStep}
                            disabled={steps.length === 0}
                            className="flex items-center gap-2 px-2.5 py-1.5 bg-background border border-border hover:bg-muted text-foreground rounded-md text-xs font-medium transition-colors disabled:opacity-50 sm:px-3 sm:text-sm"
                        >
                            <FiSkipForward className="w-4 h-4" />
                            Run Step
                        </button>
                     </>
                 ) : (
                     <button 
                        onClick={handleStop}
                        className="flex items-center gap-2 px-2.5 py-1.5 bg-destructive text-destructive-foreground rounded-md text-xs font-medium hover:bg-destructive/90 transition-colors animate-pulse sm:px-3 sm:text-sm"
                     >
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Stop
                     </button>
                 )}

                 <button 
                    onClick={handleReset}
                    disabled={isExecuting}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-background border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-muted-foreground rounded-md text-xs font-medium transition-colors sm:px-3 sm:text-sm"
                 >
                    <FiRotateCcw className="w-4 h-4" />
                    Reset
                 </button>
              </div>
           </div>
           
           <div className="flex items-center gap-2">
              <button 
                onClick={handleImport}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                title="Import Workflow"
              >
                 <FiUpload className="w-4 h-4" />
              </button>
              <button 
                onClick={handleExport}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                title="Save as Workflow"
              >
                 <FiSave className="w-4 h-4" />
              </button>
           </div>
        </div>

      <div className="flex-1 flex flex-col overflow-hidden lg:flex-row">
        {/* Left Panel: Flowchart Visualizer */}
        <div className="flex-1 min-w-0 min-h-[240px] bg-slate-50 dark:bg-black/20 relative flex flex-col lg:min-h-0">
            <div className="flex-1 relative">
                <WorkflowFlowchart
                    steps={steps}
                    onStepClick={handleStepClick}
                    onAddStep={addStep}
                    onStepsReorder={(newSteps) => reorderSteps(newSteps)}
                    activeStepIndex={activeStepIndex}
                    onTriggerClick={() => setActiveTab("input")}
                />
            </div>
        </div>

        {/* Right Panel: Tabs */}
        <div className="flex-1 w-full min-h-[260px] bg-background border-t border-border flex flex-col shadow-xl z-20 lg:min-h-0 lg:flex-none lg:w-[520px] xl:w-[600px] lg:border-l lg:border-t-0">
            {/* Tab Header */}
            <div className="flex border-b border-border bg-muted/5">
                <button 
                    onClick={() => setActiveTab("input")}
                    className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                        activeTab === "input" ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                >
                    <FiFileText /> Input
                </button>
                <button 
                    onClick={() => setActiveTab("step-config")}
                    className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                        activeTab === "step-config" ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                >
                    <FiSettings /> Step
                </button>
                <button 
                    onClick={() => setActiveTab("context")}
                    className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                        activeTab === "context" ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                >
                    <FiDatabase /> Context
                </button>
                <button 
                    onClick={() => setActiveTab("logs")}
                    className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                        activeTab === "logs" ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                >
                    <FiTerminal /> Logs
                    {executionResults.length > 0 && (
                        <span className="bg-muted-foreground/20 text-muted-foreground px-1.5 rounded-full text-[10px]">{executionResults.length}</span>
                    )}
                </button>
            </div>
            
            <div className="flex-1 overflow-hidden relative">
                {/* INPUT TAB */}
                {activeTab === "input" && (
                    <div className="absolute inset-0 flex flex-col">
                        <div className="p-4 border-b border-border bg-muted/10">
                            <h3 className="text-sm font-semibold">Initial Input</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                JSON data passed to the first step.
                            </p>
                        </div>
                        <div className="flex-1 p-0">
                            <textarea 
                                value={currentInput}
                                onChange={(e) => setCurrentInput(e.target.value)}
                                className="w-full h-full bg-background p-4 text-xs font-mono resize-none focus:outline-none"
                                placeholder="{}"
                                spellCheck={false}
                            />
                        </div>
                    </div>
                )}

                {/* STEP CONFIG TAB */}
                {activeTab === "step-config" && (
                     <div className="absolute inset-0 flex flex-col overflow-hidden">
                        {selectedStepIndex !== null && steps[selectedStepIndex] ? (
                            <div className="h-full overflow-y-auto">
                                <div className="p-4 border-b border-border bg-muted/10 sticky top-0 z-10 flex justify-between items-center backdrop-blur-md">
                                    <div>
                                        <h3 className="text-sm font-semibold">Step {selectedStepIndex + 1}: {steps[selectedStepIndex].step_name || "Untitled"}</h3>
                                        <div className="flex gap-2 mt-1">
                                            {executionResults.find(r => r.stepIndex === selectedStepIndex)?.status === 'success' && (
                                                <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <FiCheckCircle className="w-3 h-3" /> Completed
                                                </span>
                                            )}
                                             {executionResults.find(r => r.stepIndex === selectedStepIndex)?.status === 'error' && (
                                                <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <FiAlertCircle className="w-3 h-3" /> Error
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => deleteStep(selectedStepIndex)}
                                        className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded"
                                    >
                                        Delete
                                    </button>
                                </div>
                                <div className="p-4 pb-20">
                                    <WorkflowStepEditor
                                        step={steps[selectedStepIndex]}
                                        index={selectedStepIndex}
                                        totalSteps={steps.length}
                                        allSteps={steps}
                                        onChange={updateStep}
                                        onDelete={() => { deleteStep(selectedStepIndex); setSelectedStepIndex(null); }}
                                        onMoveUp={moveStepUp}
                                        onMoveDown={moveStepDown}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                    <FiSettings className="w-6 h-6 text-muted-foreground/50" />
                                </div>
                                <p className="text-sm font-medium">No Step Selected</p>
                                <p className="text-xs mt-1 max-w-[200px]">Click a step in the flowchart to edit its configuration.</p>
                                <button 
                                    onClick={addStep}
                                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                                >
                                    Add New Step
                                </button>
                            </div>
                        )}
                     </div>
                )}

                {/* CONTEXT TAB */}
                {activeTab === "context" && (
                    <div className="absolute inset-0 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-border bg-muted/10 flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-semibold">Accumulated Context</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Merged output from all executed steps.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {!isEditingContext ? (
                                    <button 
                                        onClick={handleEditContext}
                                        className="text-[10px] border border-border bg-background hover:bg-muted px-2 py-1 rounded font-medium flex items-center gap-1"
                                    >
                                        <FiEdit2 className="w-3 h-3" /> Edit
                                    </button>
                                ) : (
                                    <>
                                        <button 
                                            onClick={handleSaveContext}
                                            className="text-[10px] bg-primary text-primary-foreground px-2 py-1 rounded font-medium flex items-center gap-1"
                                        >
                                            <FiCheck className="w-3 h-3" /> Save
                                        </button>
                                        <button 
                                            onClick={() => setIsEditingContext(false)}
                                            className="text-[10px] border border-border bg-background hover:bg-muted px-2 py-1 rounded font-medium"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            {isEditingContext ? (
                                <textarea 
                                    value={contextEditValue}
                                    onChange={(e) => setContextEditValue(e.target.value)}
                                    className="w-full h-full font-mono text-xs bg-muted/30 p-2 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                                    spellCheck={false}
                                />
                            ) : (
                                <JsonViewer 
                                    value={accumulatedContext}
                                    defaultExpandedDepth={2}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* LOGS TAB */}
                {activeTab === "logs" && (
                    <div className="absolute inset-0 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-border bg-muted/10 flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-semibold">Live Logs</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Real-time output from the worker.
                                </p>
                            </div>
                            {(logs.length > 0 || executionResults.length > 0) && (
                                <button onClick={() => { setLogs([]); setExecutionResults([]); }} className="text-xs text-muted-foreground hover:text-destructive">Clear</button>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto p-4 bg-black/5 dark:bg-black/30 font-mono text-xs">
                            {logs.length === 0 && executionResults.length === 0 && (
                                <div className="text-center py-10 text-muted-foreground italic">
                                    Ready to run.
                                </div>
                            )}
                            
                            <LogViewer logs={logs} />
                            <div ref={logsEndRef} />

                            {/* Structured Results Summary */}
                            {!isExecuting && executionResults.length > 0 && (
                                <div className="mt-8 pt-4 border-t border-border">
                                    <div className="mb-2 font-semibold text-foreground">Step Results</div>
                                    <div className="space-y-2">
                                        {executionResults.map((res, i) => (
                                            <div key={i} className={`rounded border overflow-hidden ${
                                                res.status === 'success' ? 'bg-green-50/10 border-green-200/30' : 'bg-red-50/10 border-red-200/30'
                                            }`}>
                                                <div className="px-2 py-1.5 flex justify-between items-center bg-muted/20">
                                                    <span className="font-bold">Step {res.stepIndex + 1}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-muted-foreground">{res.duration}ms</span>
                                                        {res.status === 'success' ? <FiCheckCircle className="text-green-500" /> : <FiAlertCircle className="text-red-500" />}
                                                    </div>
                                                </div>
                                                <div className="p-2">
                                                    {res.error ? (
                                                        <div className="text-red-500">{res.error}</div>
                                                    ) : (
                                                            <div className="max-h-32 overflow-auto">
                                                                <JsonViewer value={res.output} defaultExpandedDepth={1} />
                                                            </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Import Modal */}
      {importModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-background rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col border border-border">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                      <h3 className="font-semibold">Import Workflow</h3>
                      <button onClick={() => setImportModalOpen(false)}><FiX className="w-5 h-5 text-muted-foreground hover:text-foreground" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                      {loadingWorkflows ? (
                          <div className="flex justify-center p-8"><FiLoader className="w-6 h-6 animate-spin text-primary" /></div>
                      ) : (
                          <div className="space-y-1">
                              {availableWorkflows.map(wf => (
                                  <button 
                                      key={wf.workflow_id}
                                      onClick={() => selectWorkflowToImport(wf.workflow_id)}
                                      className="w-full text-left p-3 hover:bg-muted rounded-lg transition-colors flex flex-col gap-1"
                                  >
                                      <span className="font-medium text-sm">{wf.workflow_name}</span>
                                      <span className="text-xs text-muted-foreground line-clamp-1">{wf.workflow_description || "No description"}</span>
                                  </button>
                              ))}
                              {availableWorkflows.length === 0 && (
                                  <div className="p-8 text-center text-muted-foreground text-sm">No workflows found.</div>
                              )}
                          </div>
                      )}
                  </div>
                  <div className="p-4 border-t border-border bg-muted/10 rounded-b-xl flex justify-end">
                      <button onClick={() => setImportModalOpen(false)} className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors">Cancel</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
