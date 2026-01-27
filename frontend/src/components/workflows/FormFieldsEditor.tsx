"use client";

import { useState } from "react";
import { FiEye } from "react-icons/fi";
import { FormFieldsData } from "@/hooks/useWorkflowForm";
import { RecursiveForm } from "@/components/ui/recursive/RecursiveForm";
import { FormFieldListEditor } from "@/components/workflows/FormFieldListEditor";
import { toRecursiveSchema } from "@/components/workflows/formFieldSchema";

interface FormFieldsEditorProps {
  formFieldsData: FormFieldsData;
  onChange: (field: keyof FormFieldsData, value: any) => void;
  onFieldChange: (path: number[], field: string, value: any) => void;
  onAddField?: (parentPath?: number[]) => void;
  onRemoveField?: (path: number[]) => void;
}

export function FormFieldsEditor({
  formFieldsData,
  onChange,
  onFieldChange,
  onAddField,
  onRemoveField,
}: FormFieldsEditorProps) {
  const [showFormPreview, setShowFormPreview] = useState(false);

  const previewSchema = toRecursiveSchema(
    formFieldsData.form_fields_schema.fields,
  );

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
              <RecursiveForm
                schema={previewSchema}
                values={{}}
                onChange={() => {}}
                readOnly={true}
              />
              <div className="mt-4">
                <button
                  type="button"
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors opacity-50 cursor-not-allowed"
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
        <FormFieldListEditor
          fields={formFieldsData.form_fields_schema.fields}
          onFieldChange={onFieldChange}
          onAddField={onAddField}
          onRemoveField={onRemoveField}
          variant="compact"
          showMoveControls={false}
          showAddButton={Boolean(onAddField)}
          addButtonLabel="Add Question"
        />
      </div>
    </div>
  );
}
