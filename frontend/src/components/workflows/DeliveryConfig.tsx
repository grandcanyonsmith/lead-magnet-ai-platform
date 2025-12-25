"use client";

import { WorkflowFormData } from "@/hooks/useWorkflowForm";

interface DeliveryConfigProps {
  formData: WorkflowFormData;
  onChange: (field: keyof WorkflowFormData, value: any) => void;
}

export function DeliveryConfig({ formData, onChange }: DeliveryConfigProps) {
  return (
    <div className="space-y-6 pt-6 border-t">
      <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">
        Delivery Configuration
      </h2>
      <p className="text-sm text-gray-600">
        Configure how completed lead magnets are delivered to leads. Choose
        webhook or SMS delivery.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Delivery Method
        </label>
        <select
          value={formData.delivery_method}
          onChange={(e) => onChange("delivery_method", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="none">No Delivery (Manual)</option>
          <option value="webhook">Webhook</option>
          <option value="sms">SMS (Twilio)</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Select how you want to deliver the completed lead magnet to the lead
        </p>
      </div>

      {/* Webhook Configuration */}
      {formData.delivery_method === "webhook" && (
        <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Webhook Configuration
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={formData.delivery_webhook_url}
              onChange={(e) => onChange("delivery_webhook_url", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="https://api.example.com/webhook"
              required={formData.delivery_method === "webhook"}
            />
            <p className="mt-1 text-xs text-gray-500">
              The webhook will receive a POST request with job details,
              submission data, and output URL
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Headers (Optional)
            </label>
            <textarea
              value={JSON.stringify(formData.delivery_webhook_headers, null, 2)}
              onChange={(e) => {
                try {
                  const headers = JSON.parse(e.target.value);
                  onChange("delivery_webhook_headers", headers);
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              placeholder='{\n  "Authorization": "Bearer token",\n  "X-Custom-Header": "value"\n}'
              rows={4}
            />
            <p className="mt-1 text-xs text-gray-500">
              JSON object with custom headers to include in webhook requests
            </p>
          </div>
        </div>
      )}

      {/* SMS Configuration */}
      {formData.delivery_method === "sms" && (
        <div className="space-y-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            SMS Configuration
          </h3>

          <div>
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={formData.delivery_sms_ai_generated}
                onChange={(e) =>
                  onChange("delivery_sms_ai_generated", e.target.checked)
                }
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">
                Use AI-Generated SMS Message
              </span>
            </label>
            <p className="text-xs text-gray-500 ml-6">
              AI will generate a personalized SMS message based on the lead
              magnet content
            </p>
          </div>

          {formData.delivery_sms_ai_generated ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI SMS Instructions (Optional)
              </label>
              <textarea
                value={formData.delivery_sms_ai_instructions}
                onChange={(e) =>
                  onChange("delivery_sms_ai_instructions", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Example: Keep it friendly and under 160 characters. Include the lead's name and make it personal."
                rows={3}
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional instructions for AI SMS generation. If empty, defaults
                to friendly message with URL.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMS Message Template
              </label>
              <textarea
                value={formData.delivery_sms_message}
                onChange={(e) =>
                  onChange("delivery_sms_message", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Hi {name}! Your personalized report is ready: {output_url}"
                rows={3}
                maxLength={320}
              />
              <p className="mt-1 text-xs text-gray-500">
                Use placeholders: {"{name}"}, {"{output_url}"}, {"{job_id}"}.
                Max 160 characters per SMS.
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Twilio credentials must be configured in
              AWS Secrets Manager (us-east-1) for SMS delivery to work.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
