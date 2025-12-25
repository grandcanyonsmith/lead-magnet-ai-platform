"use client";

import { useState, useEffect } from "react";
import { FiSettings, FiFileText, FiLayout } from "react-icons/fi";
import { api } from "@/lib/api";
import { AIModel, Tool } from "@/types";
import { useWorkflowEdit } from "@/hooks/useWorkflowEdit";
import { useFormEdit } from "@/hooks/useFormEdit";
import { useTemplateEdit } from "@/hooks/useTemplateEdit";
import { WorkflowTab } from "@/components/workflows/edit/WorkflowTab";
import { FormTab } from "@/components/workflows/edit/FormTab";
import { TemplateTab } from "@/components/workflows/edit/TemplateTab";
import { extractPlaceholders } from "@/utils/templateUtils";
import { formatHTML } from "@/utils/templateUtils";
import { useSettings } from "@/hooks/api/useSettings";

export default function EditWorkflowPage() {
  const [activeTab, setActiveTab] = useState<"workflow" | "form" | "template">(
    "workflow",
  );
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(
    null,
  );
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);

  // Main workflow hook
  const workflowEdit = useWorkflowEdit();
  const {
    workflowId,
    loading,
    submitting,
    setSubmitting,
    error,
    setError,
    formData,
    setFormData,
    steps,
    setSteps,
    formId,
    workflowForm,
    handleChange,
    handleStepChange,
    handleAddStep,
    handleDeleteStep,
    handleMoveStepUp,
    handleMoveStepDown,
    router,
  } = workflowEdit;

  // Form edit hook
  const formEdit = useFormEdit(formData.workflow_name, formId, workflowForm);
  const {
    formFormData,
    handleFormChange,
    handleFieldChange,
    addField,
    removeField,
    moveFieldUp,
    moveFieldDown,
  } = formEdit;

  // Template edit hook
  const templateEdit = useTemplateEdit(
    formData.workflow_name,
    templateId,
    formData.template_id,
  );
  const {
    templateLoading,
    templateData,
    detectedPlaceholders,
    templateViewMode,
    devicePreviewSize,
    previewKey,
    refining,
    generationStatus,
    editPrompt,
    handleTemplateChange,
    handleHtmlChange,
    handleRefine,
    insertPlaceholder,
    setTemplateViewMode,
    setDevicePreviewSize,
    setEditPrompt,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    history,
    historyIndex,
    jumpToHistory,
    commitHtmlChange,
    selectedSelectors,
    setSelectedSelectors,
  } = templateEdit;

  const { settings } = useSettings();

  // Update templateId when formData.template_id changes
  useEffect(() => {
    if (formData.template_id) {
      setTemplateId(formData.template_id);
    }
  }, [formData.template_id]);

  // Switch away from template tab if no template
  useEffect(() => {
    const hasTemplate = templateId || templateData.html_content.trim();
    if (!hasTemplate && activeTab === "template") {
      setActiveTab("workflow");
    }
  }, [templateId, templateData.html_content, activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.workflow_name.trim()) {
      setError("Lead magnet name is required");
      return;
    }

    // Validate steps
    if (steps.length === 0) {
      setError("At least one workflow step is required");
      return;
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.step_name.trim()) {
        setError(`Step ${i + 1} name is required`);
        return;
      }
      // Only validate instructions for AI generation steps
      if (
        step.step_type !== "webhook" &&
        (!step.instructions || !step.instructions.trim())
      ) {
        setError(
          `Step ${i + 1} instructions are required for AI generation steps`,
        );
        return;
      }
      // Validate HTTP URL for HTTP request steps
      if (
        step.step_type === "webhook" &&
        (!step.webhook_url || !step.webhook_url.trim())
      ) {
        setError(`Step ${i + 1} HTTP URL is required for HTTP request steps`);
        return;
      }
    }

    // Template validation - if template tab is accessible, ensure template exists
    const hasTemplate = templateId || templateData.html_content.trim();
    if (activeTab === "template" && !hasTemplate) {
      setError("Template HTML content is required");
      return;
    }

    setSubmitting(true);

    try {
      // Create or update template if template content exists
      let finalTemplateId = templateId;
      if (templateData.html_content.trim()) {
        const placeholders = extractPlaceholders(templateData.html_content);

        if (templateId) {
          // Update existing template
          await api.updateTemplate(templateId, {
            template_name: templateData.template_name.trim(),
            template_description:
              templateData.template_description.trim() || undefined,
            html_content: templateData.html_content.trim(),
            placeholder_tags:
              placeholders.length > 0 ? placeholders : undefined,
            is_published: templateData.is_published,
          });
          finalTemplateId = templateId;
        } else {
          // Create new template
          const template = await api.createTemplate({
            template_name: templateData.template_name.trim(),
            template_description:
              templateData.template_description.trim() || "",
            html_content: templateData.html_content.trim(),
            placeholder_tags:
              placeholders.length > 0 ? placeholders : undefined,
            is_published: templateData.is_published,
          });
          finalTemplateId = template.template_id;
          setTemplateId(template.template_id);
        }
      }

      // Update workflow with steps
      await api.updateWorkflow(workflowId, {
        workflow_name: formData.workflow_name.trim(),
        workflow_description: formData.workflow_description.trim() || undefined,
        steps: steps.map((step, index: number) => {
          // Clean up tools if tool_choice is 'none'
          const cleanedTools =
            step.tool_choice === "none" ? [] : step.tools || [];

          return {
            ...step,
            step_order: index,
            model: step.model as AIModel,
            tools:
              cleanedTools.length > 0 ? (cleanedTools as Tool[]) : undefined,
            tool_choice: step.tool_choice || "auto",
            depends_on:
              step.depends_on && step.depends_on.length > 0
                ? step.depends_on
                : undefined,
          };
        }),
        // Legacy fields removed - all workflows must use steps format
        template_id: finalTemplateId || undefined,
        template_version: 0,
      });

      // Update form if it exists
      if (formId) {
        await api.updateForm(formId, {
          form_name: formFormData.form_name.trim(),
          public_slug: formFormData.public_slug.trim(),
          form_fields_schema: formFormData.form_fields_schema as any,
          rate_limit_enabled: formFormData.rate_limit_enabled,
          rate_limit_per_hour: formFormData.rate_limit_per_hour,
          captcha_enabled: formFormData.captcha_enabled,
          custom_css: formFormData.custom_css.trim() || undefined,
          thank_you_message: formFormData.thank_you_message.trim() || undefined,
          redirect_url: formFormData.redirect_url.trim() || undefined,
        });
      }

      router.push("/dashboard/workflows");
    } catch (error: any) {
      console.error("Failed to update:", error);
      setError(
        error.response?.data?.message || error.message || "Failed to update",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefineWithError = async () => {
    const result = await handleRefine();
    if (result.error) {
      setError(result.error);
      return result;
    }
    return result;
  };

  const handleFormatHtml = () => {
    const formatted = formatHTML(templateData.html_content);
    handleTemplateChange("html_content", formatted);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading workflow...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Edit Lead Magnet
            </h1>
            <p className="text-gray-600">
              Update your AI lead magnet and form configuration
            </p>
          </div>
          {workflowEdit.workflowStatus === "draft" && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Draft
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 overflow-x-auto">
        <nav className="flex space-x-4 sm:space-x-8 min-w-max">
          <button
            onClick={() => setActiveTab("workflow")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "workflow"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <FiSettings className="inline w-4 h-4 mr-2" />
            Lead Magnet Settings
          </button>
          <button
            onClick={() => setActiveTab("form")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "form"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <FiFileText className="inline w-4 h-4 mr-2" />
            Form Settings
          </button>
          {(templateId || templateData.html_content.trim()) && (
            <button
              onClick={() => setActiveTab("template")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "template"
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <FiLayout className="inline w-4 h-4 mr-2" />
              Template
            </button>
          )}
        </nav>
      </div>

      {activeTab === "workflow" && (
        <WorkflowTab
          workflowId={workflowId || ""}
          formData={formData}
          steps={steps}
          submitting={submitting}
          selectedStepIndex={selectedStepIndex}
          isSidePanelOpen={isSidePanelOpen}
          onFormDataChange={handleChange}
          onStepsChange={setSteps}
          onAddStep={handleAddStep}
          onStepClick={(index) => {
            if (index === -1 || index === null) {
              // Close panel
              setSelectedStepIndex(null);
              setIsSidePanelOpen(false);
            } else {
              // Open panel with selected step
              setSelectedStepIndex(index);
              setIsSidePanelOpen(true);
            }
          }}
          onStepsReorder={setSteps}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          onDeleteStep={handleDeleteStep}
          onMoveStepUp={handleMoveStepUp}
          onMoveStepDown={handleMoveStepDown}
        />
      )}

      {activeTab === "form" && formId && (
        <FormTab
          formFormData={formFormData}
          workflowName={formData.workflow_name}
          submitting={submitting}
          customDomain={settings?.custom_domain}
          onFormChange={handleFormChange}
          onFieldChange={handleFieldChange}
          onAddField={addField}
          onRemoveField={removeField}
          onMoveFieldUp={moveFieldUp}
          onMoveFieldDown={moveFieldDown}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      )}

      {activeTab === "form" && !formId && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 mb-4">
            No form found for this lead magnet.
          </p>
          <p className="text-sm text-gray-500">
            Forms are automatically created when you create a lead magnet.
          </p>
        </div>
      )}

      {activeTab === "template" && (
        <TemplateTab
          templateData={templateData}
          templateLoading={templateLoading}
          detectedPlaceholders={detectedPlaceholders}
          templateViewMode={templateViewMode}
          devicePreviewSize={devicePreviewSize}
          previewKey={previewKey}
          refining={refining}
          generationStatus={generationStatus}
          editPrompt={editPrompt}
          selectedSelectors={selectedSelectors}
          onSelectionChange={setSelectedSelectors}
          onTemplateChange={handleTemplateChange}
          onHtmlChange={handleHtmlChange}
          onViewModeChange={setTemplateViewMode}
          onDeviceSizeChange={setDevicePreviewSize}
          onInsertPlaceholder={insertPlaceholder}
          onRefine={handleRefineWithError}
          onEditPromptChange={setEditPrompt}
          onFormatHtml={handleFormatHtml}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          submitting={submitting}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          history={history}
          historyIndex={historyIndex}
          onJumpToHistory={jumpToHistory}
          onCommitChange={commitHtmlChange}
        />
      )}
    </div>
  );
}
