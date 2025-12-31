"use client";

import React, { useState, useEffect } from "react";
import { FiPlay, FiChevronDown, FiChevronUp, FiRefreshCw } from "react-icons/fi";
import { WorkflowStep } from "@/types/workflow";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

interface StepTesterProps {
  step: WorkflowStep;
  index: number;
}

export default function StepTester({ step, index }: StepTesterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [testInput, setTestInput] = useState("{}");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const handleTestStep = async () => {
    try {
      let inputData = {};
      try {
        inputData = JSON.parse(testInput);
      } catch (e) {
        toast.error("Invalid JSON input");
        return;
      }

      setIsTesting(true);
      setTestResult(null);

      const { job_id } = await api.testStep({
        step,
        input: inputData,
      });

      toast.success("Test started");

      // Start polling
      const interval = setInterval(async () => {
        try {
          // Use getJob for status check as we use a temporary job
          const job = await api.getJob(job_id);
          
          if (job.status === "completed" || job.status === "failed") {
            clearInterval(interval);
            setPollInterval(null);
            setIsTesting(false);
            
            if (job.status === "failed") {
                setTestResult({ error: job.error_message || "Unknown error" });
                toast.error("Test failed");
            } else {
                // Get execution step output
                const output = job.execution_steps?.[0]?.output || "No output";
                const details = job.execution_steps?.[0] || {};
                setTestResult({ output, ...details });
                toast.success("Test completed");
            }
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
    <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FiPlay className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">Test Step</span>
        </div>
        {isOpen ? (
          <FiChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <FiChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="mt-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Test Input (JSON)
              </label>
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={4}
                placeholder="{}"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional input data to simulate context.
              </p>
            </div>

            <button
              type="button"
              onClick={handleTestStep}
              disabled={isTesting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
            >
              {isTesting ? (
                <>
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <FiPlay className="w-4 h-4" />
                  Run Test
                </>
              )}
            </button>

            {testResult && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Result
                </label>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto text-xs font-mono max-h-96">
                  <pre>{JSON.stringify(testResult, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

