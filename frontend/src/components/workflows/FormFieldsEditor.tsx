"use client";

import { useState } from "react";
import { FiEye } from "react-icons/fi";
import { FormFieldsData } from "@/hooks/useWorkflowForm";

interface FormFieldsEditorProps {
  formFieldsData: FormFieldsData;
  onChange: (field: keyof FormFieldsData, value: any) => void;
  onFieldChange: (fieldIndex: number, field: string, value: any) => void;
}

export function FormFieldsEditor({
  formFieldsData,
  onChange,
  onFieldChange,
}: FormFieldsEditorProps) {
  const [showFormPreview, setShowFormPreview] = useState(false);

  if (formFieldsData.form_fields_schema.fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 pt-6 border-t">
      <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">
        Lead Form
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Form Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formFieldsData.form_name}
          onChange={(e) => {
            onChange("form_name", e.target.value);
            if (e.target.value.trim() && !showFormPreview) {
              setShowFormPreview(true);
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Lead Capture Form"
          maxLength={200}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          URL Slug <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formFieldsData.public_slug}
          onChange={(e) =>
            onChange(
              "public_slug",
              e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
            )
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          placeholder="lead-capture-form"
          pattern="[a-z0-9\-]+"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          This is the web address for your form. Example: /v1/forms/my-calculator
        </p>
      </div>

      {/* Form Preview */}
      {formFieldsData.form_fields_schema.fields.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center">
              <FiEye className="w-4 h-4 mr-2" />
              Form Preview
            </h3>
            <button
              type="button"
              onClick={() => setShowFormPreview(!showFormPreview)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {showFormPreview ? "Hide Preview" : "Show Preview"}
            </button>
          </div>
          {showFormPreview && (
            <div className="bg-white p-6">
              <h3 className="text-lg font-semibold mb-4">
                {formFieldsData.form_name || "Form Preview"}
              </h3>
              <div className="space-y-4">
                {formFieldsData.form_fields_schema.fields.map(
                  (field: any, index: number) => (
                    <div key={field.field_id || index}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label || `Field ${index + 1}`}
                        {field.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      {field.field_type === "textarea" ? (
                        <textarea
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder={field.placeholder || ""}
                          rows={4}
                          disabled
                        />
                      ) : field.field_type === "select" && field.options ? (
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          disabled
                        >
                          <option value="">Select {field.label}</option>
                          {field.options.map(
                            (option: string, optIndex: number) => (
                              <option key={optIndex} value={option}>
                                {option}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        <input
                          type={
                            field.field_type === "email"
                              ? "email"
                              : field.field_type === "tel"
                                ? "tel"
                                : field.field_type === "number"
                                  ? "number"
                                  : "text"
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder={field.placeholder || ""}
                          disabled
                        />
                      )}
                    </div>
                  ),
                )}
                <button
                  type="button"
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  disabled
                >
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Fields List */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Questions ({formFieldsData.form_fields_schema.fields.length})
        </label>
        <div className="space-y-4">
          {formFieldsData.form_fields_schema.fields.map(
            (field: any, index: number) => (
              <div
                key={field.field_id || index}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Question Label
                    </label>
                    <input
                      type="text"
                      value={field.label || ""}
                      onChange={(e) =>
                        onFieldChange(index, "label", e.target.value)
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="e.g. What is your email?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Type
                    </label>
                    <select
                      value={field.field_type || "text"}
                      onChange={(e) =>
                        onFieldChange(index, "field_type", e.target.value)
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select</option>
                      <option value="number">Number</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Placeholder
                    </label>
                    <input
                      type="text"
                      value={field.placeholder || ""}
                      onChange={(e) =>
                        onFieldChange(index, "placeholder", e.target.value)
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Placeholder text"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={field.required || false}
                        onChange={(e) =>
                          onFieldChange(index, "required", e.target.checked)
                        }
                        className="mr-2"
                      />
                      <span className="text-xs font-medium text-gray-600">
                        Required
                      </span>
                    </label>
                  </div>
                </div>
                {field.field_type === "select" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Options (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={field.options?.join(", ") || ""}
                      onChange={(e) =>
                        onFieldChange(
                          index,
                          "options",
                          e.target.value
                            .split(",")
                            .map((o: string) => o.trim())
                            .filter(Boolean),
                        )
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
