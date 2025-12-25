/**
 * Webhook testing component
 */

"use client";

import { useState } from "react";
import { FiSend, FiCheckCircle, FiXCircle, FiLoader } from "react-icons/fi";
import { toast } from "react-hot-toast";

interface WebhookTesterProps {
  webhookUrl: string;
}

interface TestResult {
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: unknown;
  error?: string;
  duration?: number;
}

export function WebhookTester({ webhookUrl }: WebhookTesterProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [testPayload, setTestPayload] = useState(
    JSON.stringify(
      {
        workflow_id: "wf_test123",
        form_data: {
          name: "Test User",
          email: "test@example.com",
          phone: "+14155551234",
        },
      },
      null,
      2,
    ),
  );

  const handleTest = async () => {
    if (!webhookUrl) {
      toast.error("Webhook URL is required");
      return;
    }

    setTesting(true);
    setResult(null);

    const startTime = Date.now();

    try {
      let payload;
      try {
        payload = JSON.parse(testPayload);
      } catch (e) {
        toast.error("Invalid JSON payload");
        setTesting(false);
        return;
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const duration = Date.now() - startTime;

      let responseBody: unknown;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const testResult: TestResult = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers,
        body: responseBody,
        duration,
      };

      setResult(testResult);

      if (response.ok) {
        toast.success(`Webhook test successful (${response.status})`);
      } else {
        toast.error(`Webhook test failed (${response.status})`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      setResult({
        success: false,
        error: errorMessage,
        duration,
      });
      toast.error(`Webhook test failed: ${errorMessage}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">Test Webhook</h4>
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || !webhookUrl}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? (
            <>
              <FiLoader className="w-4 h-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <FiSend className="w-4 h-4 mr-2" />
              Test Webhook
            </>
          )}
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Test Payload (JSON)
        </label>
        <textarea
          value={testPayload}
          onChange={(e) => setTestPayload(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
          rows={8}
          placeholder='{"workflow_id": "wf_xxxxx", "form_data": {...}}'
        />
      </div>

      {result && (
        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            {result.success ? (
              <>
                <FiCheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-semibold text-green-600">
                  Test Successful
                </span>
              </>
            ) : (
              <>
                <FiXCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm font-semibold text-red-600">
                  Test Failed
                </span>
              </>
            )}
            {result.duration && (
              <span className="text-xs text-gray-500 ml-auto">
                ({result.duration}ms)
              </span>
            )}
          </div>

          {result.status !== undefined && (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-700">
                Status:{" "}
              </span>
              <span className="text-xs font-mono">
                {result.status} {result.statusText}
              </span>
            </div>
          )}

          {result.error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {result.error}
            </div>
          )}

          {result.headers && Object.keys(result.headers).length > 0 && (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-700">
                Response Headers:
              </span>
              <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                {JSON.stringify(result.headers, null, 2)}
              </pre>
            </div>
          )}

          {result.body !== undefined && (
            <div>
              <span className="text-xs font-medium text-gray-700">
                Response Body:
              </span>
              <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                {typeof result.body === "string"
                  ? result.body
                  : JSON.stringify(result.body, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
