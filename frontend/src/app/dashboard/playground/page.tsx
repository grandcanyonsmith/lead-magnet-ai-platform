"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FiPlay,
  FiSkipForward,
  FiRotateCcw,
  FiSave,
  FiDownload,
  FiUpload,
  FiPlus,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
  FiCode,
  FiSidebar,
} from "react-icons/fi";
import { useWorkflowSteps } from "@/hooks/useWorkflowSteps";
import WorkflowStepEditor from "../workflows/components/WorkflowStepEditor";
import { api } from "@/lib/api";
import { JsonViewer } from "@/components/ui/JsonViewer";
import toast from "react-hot-toast";
import { WorkflowStep } from "@/types/workflow";

// Types
interface AccumulatedContext {
  [key: string]: any;
}

interface StepResult {
  stepIndex: number;
  output: any;
  status: "success" | "error" | "pending";
  error?: string;
  duration?: number;
}

export default function PlaygroundPage() {
  const router = useRouter();
  
  // State
  const {
    steps = [],
    addStep,
    updateStep,
    deleteStep,
    moveStepUp,
    moveStepDown,
    setStepsFromAIGeneration,
  } = useWorkflowSteps();
  
  const [currentInput, setCurrentInput] = useState<string>("{}");
  const [accumulatedContext, setAccumulatedContext] = useState<AccumulatedContext>({});
  const [executionResults, setExecutionResults] = useState<StepResult[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showContextPanel, setShowContextPanel] = useState(true);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState<any[]>([]);

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

    const step = steps[nextIndex];
    const startTime = Date.now();

    try {
      // Prepare context: Merge initial input with accumulated output
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

      const result = await api.testStep({
        step,
        input: stepInput
      });

      // Poll for completion (reusing simplified logic from StepTester, but tailored for Playground)
      await pollJobCompletion(result.job_id, nextIndex, startTime);

    } catch (error: any) {
      handleStepError(nextIndex, error.message || "Failed to start step", startTime);
    }
  };

  // Execution Logic: Run All
  const handleRunAll = async () => {
    setIsExecuting(true);
    setActiveStepIndex(0);
    setExecutionResults([]);
    setAccumulatedContext({});

    let initialInputData = {};
    try {
      initialInputData = JSON.parse(currentInput);
    } catch {
       toast.error("Invalid Initial Input JSON");
       setIsExecuting(false);
       return;
    }

    try {
       const result = await api.testWorkflow({
          steps,
          input: initialInputData
       });
       
       toast.success("Workflow started (Run All)");
       // For "Run All", we might want to poll the full workflow status or just let the backend handle it.
       // Given the "Interactive" nature of the playground, the backend `testWorkflow` actually runs it as a real background job.
       // For better interactivity, we might want to switch this to "Fast Forward" client-side execution in the future,
       // but for now, let's just show it started and maybe poll the final status.
       //
       // A better UX for "Run All" in a Playground is actually: "Auto-advance through steps".
       // Let's implement that client-side recursion instead of a single backend call, so users can see progress.
       
       // Trigger the recursion starting at 0
       await runStepRecursively(0, initialInputData);

    } catch (error: any) {
       toast.error("Failed to start workflow: " + error.message);
       setIsExecuting(false);
    }
  };

  const runStepRecursively = async (index: number, currentContext: any) => {
      if (index >= steps.length) {
          setIsExecuting(false);
          setActiveStepIndex(null);
          toast.success("All steps completed!");
          return;
      }

      setActiveStepIndex(index);
      const step = steps[index];
      const startTime = Date.now();

      try {
          const result = await api.testStep({ step, input: currentContext });
          const success = await pollJobCompletion(result.job_id, index, startTime, true); // true = return result for recursion
          
          if (success) {
               // Update context with this step's output
               // NOTE: We need the actual OUTPUT here, but `pollJobCompletion` updates state.
               // We need to fetch the output from state or return it.
               // Let's modify pollJobCompletion to return the output.
               const output = success; 
               const nextContext = { ...currentContext, ...output };
               // Wait a bit for visual effect
               setTimeout(() => runStepRecursively(index + 1, nextContext), 500);
          } else {
              setIsExecuting(false); // Stop on error
          }
      } catch (e: any) {
          handleStepError(index, e.message, startTime);
          setIsExecuting(false);
      }
  };

  const pollJobCompletion = async (jobId: string, stepIndex: number, startTime: number, returnOutput = false): Promise<any> => {
      return new Promise((resolve) => {
          const interval = setInterval(async () => {
              try {
                  const job = await api.getJob(jobId);
                  if (job.status === "failed" || job.error_message) {
                      clearInterval(interval);
                      handleStepError(stepIndex, job.error_message || "Unknown error", startTime);
                      resolve(false);
                      return;
                  }

                  const steps = await api.getExecutionSteps(jobId);
                  if (Array.isArray(steps) && steps.length > 0) {
                      clearInterval(interval);
                      const output = steps[0]?.output || {};
                      
                      handleStepSuccess(stepIndex, output, startTime);
                      
                      // Update Context
                      setAccumulatedContext(prev => ({
                          ...prev,
                          ...output
                      }));

                      if (returnOutput) resolve(output);
                      else {
                          setIsExecuting(false);
                          resolve(true);
                      }
                  }
              } catch (e) {
                  // ignore transient errors
              }
          }, 1000);

          // Safety timeout
          setTimeout(() => {
              clearInterval(interval);
              if (isExecuting) { // Only if still thought to be running
                  handleStepError(stepIndex, "Timeout", startTime);
                  resolve(false);
              }
          }, 60000);
      });
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
      setIsExecuting(false);
      toast.error(`Step ${index + 1} failed: ${error}`);
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
              research_enabled: false, // Default
              html_enabled: false // Default
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
          toast.success("Reset");
      }
  };

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden">
      {/* Main Content (Steps) */}
      <div className="flex-1 flex flex-col min-w-0 bg-muted/30">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-background border-b border-border shadow-sm z-10">
           <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold flex items-center gap-2">
                 <FiCode className="text-primary" />
                 Playground
              </h1>
              <div className="h-6 w-px bg-border/60" />
              <div className="flex items-center gap-2">
                 <button 
                    onClick={handleRunAll}
                    disabled={isExecuting || steps.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                 >
                    <FiPlay className="w-4 h-4" />
                    Run All
                 </button>
                 <button 
                    onClick={handleRunNextStep}
                    disabled={isExecuting || steps.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border hover:bg-muted text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                 >
                    <FiSkipForward className="w-4 h-4" />
                    Run Step
                 </button>
                 <button 
                    onClick={handleReset}
                    disabled={isExecuting}
                    className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-muted-foreground rounded-md text-sm font-medium transition-colors"
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
              <div className="h-6 w-px bg-border/60 mx-1" />
              <button
                onClick={() => setShowContextPanel(!showContextPanel)}
                className={`p-2 rounded-md transition-colors ${showContextPanel ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                title="Toggle Context Inspector"
              >
                <FiSidebar className="w-4 h-4" />
              </button>
           </div>
        </div>

        {/* Step List Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
           <div className="max-w-3xl mx-auto space-y-6 pb-20">
              {(!steps || steps.length === 0) ? (
                  <div className="text-center py-20 border-2 border-dashed border-border rounded-xl bg-background/50">
                      <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                          <FiPlus className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">No steps yet</h3>
                      <p className="text-sm text-muted-foreground mb-6">Add a step or import an existing workflow to get started.</p>
                      <div className="flex justify-center gap-3">
                          <button onClick={addStep} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium transition-colors">
                              Add First Step
                          </button>
                          <button onClick={handleImport} className="px-4 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-muted text-sm font-medium transition-colors">
                              Import Workflow
                          </button>
                      </div>
                  </div>
              ) : (
                  <>
                    {(steps || []).map((step, index) => {
                        const result = executionResults.find(r => r.stepIndex === index);
                        const isActive = activeStepIndex === index;
                        
                        return (
                           <div key={index} className={`relative group transition-all duration-300 ${isActive ? 'ring-2 ring-primary ring-offset-4 ring-offset-background rounded-xl' : ''}`}>
                               {/* Status Indicator Line */}
                               <div className="absolute -left-12 top-0 bottom-0 w-px bg-border/60 hidden md:block" />
                               <div className={`absolute -left-[54px] top-6 w-4 h-4 rounded-full border-2 hidden md:flex items-center justify-center bg-background z-10 transition-colors ${
                                   isActive ? 'border-primary text-primary' :
                                   result?.status === 'success' ? 'border-green-500 bg-green-50 text-green-600' :
                                   result?.status === 'error' ? 'border-red-500 bg-red-50 text-red-600' :
                                   'border-muted-foreground/30 text-muted-foreground/30'
                               }`}>
                                   {isActive && <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />}
                                   {!isActive && result?.status === 'success' && <FiCheckCircle className="w-full h-full" />}
                                   {!isActive && result?.status === 'error' && <FiAlertCircle className="w-full h-full" />}
                                   {!isActive && !result && <div className="text-[10px] font-mono">{index + 1}</div>}
                               </div>

                               <WorkflowStepEditor
                                  step={step}
                                  index={index}
                                  totalSteps={steps.length}
                                  allSteps={steps}
                                  onChange={updateStep}
                                  onDelete={deleteStep}
                                  onMoveUp={moveStepUp}
                                  onMoveDown={moveStepDown}
                               />
                           </div>
                        );
                    })}
                    
                    <button
                      onClick={addStep}
                      className="w-full py-4 border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 rounded-xl text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <FiPlus className="w-5 h-5" />
                      Add Another Step
                    </button>
                  </>
              )}
           </div>
        </div>
      </div>

      {/* Context Inspector Panel */}
      {showContextPanel && (
          <div className="w-[400px] bg-background border-l border-border flex flex-col shadow-xl z-20">
              <div className="p-4 border-b border-border bg-muted/10">
                  <h2 className="font-semibold flex items-center gap-2">
                      <FiSidebar className="text-primary" />
                      State Inspector
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                      View and edit the data passed between steps.
                  </p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Initial Input */}
                  <div className="space-y-2">
                      <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Initial Input</label>
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Read/Write</span>
                      </div>
                      <div className="rounded-lg border border-border overflow-hidden">
                          <textarea 
                              value={currentInput}
                              onChange={(e) => setCurrentInput(e.target.value)}
                              className="w-full h-32 bg-background p-3 text-xs font-mono resize-y focus:outline-none"
                              placeholder="{}"
                          />
                      </div>
                  </div>

                  {/* Accumulated Context */}
                  <div className="space-y-2">
                      <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Context</label>
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Live State</span>
                      </div>
                      <div className="bg-muted/30 rounded-lg border border-border overflow-hidden p-1">
                          <JsonViewer 
                              value={accumulatedContext}
                              defaultExpandedDepth={2}
                          />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                          This is the merged result of all executed steps so far.
                      </p>
                  </div>

                  {/* Step Results Log */}
                  <div className="space-y-2">
                       <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Execution Log</label>
                       <div className="space-y-2">
                           {executionResults.length === 0 && (
                               <div className="text-xs text-muted-foreground italic p-2">No steps executed yet.</div>
                           )}
                           {executionResults.map((res, i) => (
                               <div key={i} className={`p-3 rounded-lg border text-xs ${
                                   res.status === 'success' ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30' : 
                                   'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30'
                               }`}>
                                   <div className="flex justify-between mb-1.5 font-medium">
                                       <span>Step {res.stepIndex + 1}</span>
                                       <span>{res.duration}ms</span>
                                   </div>
                                   {res.error ? (
                                       <div className="text-red-600 break-words">{res.error}</div>
                                   ) : (
                                       <div className="text-muted-foreground truncate font-mono">
                                           {JSON.stringify(res.output).substring(0, 100)}...
                                       </div>
                                   )}
                               </div>
                           ))}
                       </div>
                  </div>
              </div>
          </div>
      )}

      {/* Import Modal */}
      {importModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-background rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col border border-border">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                      <h3 className="font-semibold">Import Workflow</h3>
                      <button onClick={() => setImportModalOpen(false)}><FiAlertCircle className="w-5 h-5 opacity-0" /><span className="sr-only">Close</span>✕</button>
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
