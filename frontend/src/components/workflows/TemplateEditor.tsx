"use client";

import { useState, useMemo } from "react";
import { FiEye } from "react-icons/fi";
import { TemplateData } from "@/hooks/useWorkflowForm";
import { stripTemplatePlaceholders } from "@/utils/templateUtils";

interface TemplateEditorProps {
  templateData: TemplateData;
  onChange: (
    fieldOrUpdates: keyof TemplateData | Partial<TemplateData>,
    value?: any,
  ) => void;
}

export function TemplateEditor({
  templateData,
  onChange,
}: TemplateEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  // Generate preview HTML with placeholders stripped
  const previewHtml = useMemo(() => {
    if (!templateData.html_content.trim()) return "";
    return stripTemplatePlaceholders(templateData.html_content);
  }, [templateData.html_content]);

  return (
    <div className="space-y-6 pt-6 border-t">
      <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">
        Template Configuration
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Template Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={templateData.template_name}
          onChange={(e) => onChange("template_name", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Email Template"
          maxLength={200}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={templateData.template_description}
          onChange={(e) => onChange("template_description", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Describe what this template is used for..."
          rows={3}
          maxLength={1000}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          HTML Content <span className="text-red-500">*</span>
        </label>

        {/* Preview Section */}
        {templateData.html_content.trim() && (
          <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                <FiEye className="w-4 h-4 mr-2" />
                HTML Preview
              </h3>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </button>
            </div>
            {showPreview && (
              <div
                className="bg-white border-t border-gray-200"
                style={{ height: "600px" }}
              >
                <iframe
                  key={`preview-${templateData.html_content.length}-${templateData.html_content.slice(0, 50)}`}
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  title="HTML Preview"
                  sandbox="allow-scripts allow-popups"
                />
              </div>
            )}
          </div>
        )}

        <textarea
          value={templateData.html_content}
          onChange={(e) => {
            onChange("html_content", e.target.value);
            // Auto-show preview when HTML content is added
            if (e.target.value.trim() && !showPreview) {
              setShowPreview(true);
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
          placeholder="<!DOCTYPE html>..."
          rows={20}
          required
        />
      </div>
    </div>
  );
}
