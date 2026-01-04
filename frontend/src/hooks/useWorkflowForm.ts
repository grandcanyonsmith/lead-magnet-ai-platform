"use client";

import { useState, useCallback } from "react";
import { WorkflowStep } from "@/types/workflow";

export interface WorkflowFormData {
  workflow_name: string;
  workflow_description: string;
  template_id: string;
  template_version: number;
}

export interface TemplateData {
  template_name: string;
  template_description: string;
  html_content: string;
  placeholder_tags: string[];
}

export interface FormFieldsData {
  form_name: string;
  public_slug: string;
  form_fields_schema: {
    fields: any[];
  };
}

const defaultFormData: WorkflowFormData = {
  workflow_name: "",
  workflow_description: "",
  template_id: "",
  template_version: 0,
};

const defaultTemplateData: TemplateData = {
  template_name: "",
  template_description: "",
  html_content: "",
  placeholder_tags: [],
};

const defaultFormFieldsData: FormFieldsData = {
  form_name: "",
  public_slug: "",
  form_fields_schema: {
    fields: [],
  },
};

export function useWorkflowForm() {
  const [formData, setFormData] = useState<WorkflowFormData>(defaultFormData);
  const [templateData, setTemplateData] =
    useState<TemplateData>(defaultTemplateData);
  const [formFieldsData, setFormFieldsData] = useState<FormFieldsData>(
    defaultFormFieldsData,
  );

  const updateFormData = useCallback(
    (field: keyof WorkflowFormData, value: any) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const updateTemplateData = useCallback(
    (field: keyof TemplateData, value: any) => {
      setTemplateData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const updateFormFieldsData = useCallback(
    (field: keyof FormFieldsData, value: any) => {
      setFormFieldsData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const updateFormField = useCallback(
    (fieldIndex: number, field: string, value: any) => {
      setFormFieldsData((prev) => {
        const newFields = [...prev.form_fields_schema.fields];
        newFields[fieldIndex] = { ...newFields[fieldIndex], [field]: value };
        return {
          ...prev,
          form_fields_schema: {
            fields: newFields,
          },
        };
      });
    },
    [],
  );

  const addFormField = useCallback(() => {
    setFormFieldsData((prev) => ({
      ...prev,
      form_fields_schema: {
        fields: [
          ...prev.form_fields_schema.fields,
          {
            field_id: `field_${Date.now()}`,
            label: "New Question",
            field_type: "text",
            required: true,
            placeholder: "",
          },
        ],
      },
    }));
  }, []);

  const removeFormField = useCallback((index: number) => {
    setFormFieldsData((prev) => ({
      ...prev,
      form_fields_schema: {
        fields: prev.form_fields_schema.fields.filter((_, i) => i !== index),
      },
    }));
  }, []);

  const populateFromAIGeneration = useCallback(
    (result: {
      workflow?: {
        workflow_name?: string;
        workflow_description?: string;
        research_instructions?: string;
        steps?: WorkflowStep[];
      };
      template?: {
        template_name?: string;
        template_description?: string;
        html_content?: string;
        placeholder_tags?: string[];
      };
      form?: {
        form_name?: string;
        public_slug?: string;
        form_fields_schema?: {
          fields: any[];
        };
      };
    }) => {
      if (result.workflow) {
        setFormData((prev) => ({
          ...prev,
          workflow_name: result.workflow?.workflow_name || prev.workflow_name,
          workflow_description:
            result.workflow?.workflow_description || prev.workflow_description,
        }));
      }

      if (result.template) {
        setTemplateData({
          template_name: result.template?.template_name || "",
          template_description: result.template?.template_description || "",
          html_content: result.template?.html_content || "",
          placeholder_tags: result.template?.placeholder_tags || [],
        });
      }

      if (result.form) {
        setFormFieldsData({
          form_name: result.form.form_name || "",
          public_slug: result.form.public_slug || "",
          form_fields_schema: result.form.form_fields_schema || { fields: [] },
        });
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setFormData(defaultFormData);
    setTemplateData(defaultTemplateData);
    setFormFieldsData(defaultFormFieldsData);
  }, []);

  return {
    formData,
    templateData,
    formFieldsData,
    updateFormData,
    updateTemplateData,
    updateFormFieldsData,
    updateFormField,
    addFormField,
    removeFormField,
    populateFromAIGeneration,
    reset,
  };
}
