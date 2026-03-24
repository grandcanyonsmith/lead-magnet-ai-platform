"use client";

import { useState, useCallback } from "react";
import { WorkflowStep } from "@/types/workflow";
import type { FormField } from "@/types/form";
import {
  FormFieldPath,
  updateFieldAtPath,
  updateFieldListAtPath,
} from "@/utils/formFieldTree";

export interface WorkflowFormData {
  workflow_name: string;
  workflow_description: string;
}

export interface FormFieldsData {
  form_name: string;
  public_slug: string;
  form_fields_schema: {
    fields: FormField[];
  };
}

const defaultFormData: WorkflowFormData = {
  workflow_name: "",
  workflow_description: "",
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
  const [formFieldsData, setFormFieldsData] = useState<FormFieldsData>(
    defaultFormFieldsData,
  );

  const updateFormData = useCallback(
    (
      fieldOrUpdates: keyof WorkflowFormData | Partial<WorkflowFormData>,
      value?: any,
    ) => {
      if (typeof fieldOrUpdates === "object") {
        setFormData((prev) => ({ ...prev, ...fieldOrUpdates }));
      } else {
        setFormData((prev) => ({ ...prev, [fieldOrUpdates]: value }));
      }
    },
    [],
  );

  const updateFormFieldsData = useCallback(
    (
      fieldOrUpdates: keyof FormFieldsData | Partial<FormFieldsData>,
      value?: any,
    ) => {
      if (typeof fieldOrUpdates === "object") {
        setFormFieldsData((prev) => ({ ...prev, ...fieldOrUpdates }));
      } else {
        setFormFieldsData((prev) => ({ ...prev, [fieldOrUpdates]: value }));
      }
    },
    [],
  );

  const updateFormField = useCallback(
    (path: FormFieldPath, field: string, value: any) => {
      setFormFieldsData((prev) => ({
        ...prev,
        form_fields_schema: {
          fields: updateFieldAtPath(prev.form_fields_schema.fields, path, (item) => ({
            ...item,
            [field]: value,
          })),
        },
      }));
    },
    [],
  );

  const addFormField = useCallback((parentPath: FormFieldPath = []) => {
    const newField: FormField = {
      field_id: `field_${Date.now()}`,
      label: "New Question",
      field_type: "text",
      required: true,
      placeholder: "",
    };
    setFormFieldsData((prev) => ({
      ...prev,
      form_fields_schema: {
        fields: updateFieldListAtPath(
          prev.form_fields_schema.fields,
          parentPath,
          (fields) => [...fields, newField],
        ),
      },
    }));
  }, []);

  const removeFormField = useCallback((path: FormFieldPath) => {
    if (path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    setFormFieldsData((prev) => ({
      ...prev,
      form_fields_schema: {
        fields: updateFieldListAtPath(
          prev.form_fields_schema.fields,
          parentPath,
          (fields) => fields.filter((_, fieldIndex) => fieldIndex !== index),
        ),
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
      form?: {
        form_name?: string;
        public_slug?: string;
        form_fields_schema?: {
          fields: FormField[];
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
    setFormFieldsData(defaultFormFieldsData);
  }, []);

  return {
    formData,
    formFieldsData,
    updateFormData,
    updateFormFieldsData,
    updateFormField,
    addFormField,
    removeFormField,
    populateFromAIGeneration,
    reset,
  };
}
