import { useState } from "react";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";
import { WorkflowStep, HTTPMethod } from "@/types/workflow";

export function useWebhookTester(
  step: WorkflowStep,
  selectedRunVars: any,
  selectedRunId: string,
  selectedRunLoading: boolean
) {
  const [httpTestLoading, setHttpTestLoading] = useState(false);
  const [httpTestResult, setHttpTestResult] = useState<any>(null);
  const [httpTestError, setHttpTestError] = useState<string | null>(null);
  const [httpTestValues, setHttpTestValues] = useState<Record<string, string>>(
    {},
  );

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

    const bodyMode = (step.webhook_body_mode || "auto") as "auto" | "custom";
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
        method: ((step.webhook_method || "POST") as HTTPMethod) || "POST",
        headers: step.webhook_headers || {},
        query_params: step.webhook_query_params || {},
        content_type: step.webhook_content_type || "application/json",
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

  return {
    httpTestLoading,
    httpTestResult,
    setHttpTestResult,
    httpTestError,
    setHttpTestError,
    httpTestValues,
    setHttpTestValues,
    handleTestHttpRequest,
  };
}
