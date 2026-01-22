"use client";

import React, { useState, useEffect } from "react";
import { WorkflowStep, HTTPMethod } from "@/types/workflow";
import { useWebhookTester } from "./hooks/useWebhookTester";
import { useRunSelection } from "./hooks/useRunSelection";
import { KeyValueEditor } from "./parts/KeyValueEditor";
import { WebhookBodyConfig } from "./parts/WebhookBodyConfig";
import { WebhookTestPanel } from "./parts/WebhookTestPanel";
import { Select } from "@/components/ui/Select";

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
    step.webhook_headers || {},
  );
  const [webhookQueryParams, setWebhookQueryParams] = useState<
    Record<string, string>
  >(step.webhook_query_params || {});

  // Sync state when step changes
  useEffect(() => {
    setWebhookHeaders(step.webhook_headers || {});
    setWebhookQueryParams(step.webhook_query_params || {});
  }, [step.webhook_headers, step.webhook_query_params]);

  const {
    availableRuns,
    selectedRunId,
    setSelectedRunId,
    selectedRunLoading,
    selectedRunError,
    selectedRunVars,
  } = useRunSelection(workflowId);

  const {
    httpTestLoading,
    httpTestResult,
    httpTestError,
    httpTestValues,
    setHttpTestValues,
    handleTestHttpRequest,
  } = useWebhookTester(
    step,
    selectedRunVars,
    selectedRunId,
    selectedRunLoading,
  );

  const handleHeadersChange = (newHeaders: Record<string, string>) => {
    setWebhookHeaders(newHeaders);
    onChange("webhook_headers", newHeaders);
  };

  const handleParamsChange = (newParams: Record<string, string>) => {
    setWebhookQueryParams(newParams);
    onChange("webhook_query_params", newParams);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Method
          </label>
          <Select
            value={step.webhook_method || "POST"}
            onChange={(nextValue) =>
              onChange("webhook_method", nextValue as HTTPMethod)
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content-Type
          </label>
          <input
            type="text"
            value={step.webhook_content_type || "application/json"}
            onChange={(e) => onChange("webhook_content_type", e.target.value)}
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
        <KeyValueEditor
          items={webhookQueryParams}
          onChange={handleParamsChange}
          keyPlaceholder="Param name"
          valuePlaceholder="Param value"
          addButtonLabel="Add Query Parameter"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          HTTP Headers (optional)
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Add custom headers to include in the HTTP request (e.g.,
          Authorization).
        </p>
        <KeyValueEditor
          items={webhookHeaders}
          onChange={handleHeadersChange}
          keyPlaceholder="Header name"
          valuePlaceholder="Header value"
          addButtonLabel="Add Header"
        />
      </div>

      <WebhookBodyConfig
        step={step}
        index={index}
        allSteps={allSteps}
        onChange={onChange}
      />

      <WebhookTestPanel
        httpTestLoading={httpTestLoading}
        httpTestResult={httpTestResult}
        httpTestError={httpTestError}
        handleTestHttpRequest={handleTestHttpRequest}
        selectedRunId={selectedRunId}
        setSelectedRunId={setSelectedRunId}
        selectedRunLoading={selectedRunLoading}
        selectedRunError={selectedRunError}
        availableRuns={availableRuns}
        workflowId={workflowId}
        selectedRunVars={selectedRunVars}
        httpTestValues={httpTestValues}
        setHttpTestValues={setHttpTestValues}
      />
    </>
  );
}
