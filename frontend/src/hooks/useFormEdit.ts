"use client";

import { useState, useEffect, useCallback } from "react";
import type { FormField as FormFieldType } from "@/types/form";
import { useOrderedList } from "@/hooks/useOrderedList";
import {
  FormFieldPath,
  updateFieldAtPath,
  updateFieldListAtPath,
} from "@/utils/formFieldTree";

export type FormField = FormFieldType;

export interface FormFormData {
  form_name: string;
  public_slug: string;
  form_fields_schema: {
    fields: FormField[];
  };
  rate_limit_enabled: boolean;
  rate_limit_per_hour: number;
  captcha_enabled: boolean;
  custom_css: string;
  thank_you_message: string;
  redirect_url: string;
}

export function useFormEdit(
  workflowName: string,
  formId: string | null,
  workflowForm?: any,
) {
  const [formFormData, setFormFormData] = useState<FormFormData>({
    form_name: "",
    public_slug: "",
    form_fields_schema: {
      fields: [],
    },
    rate_limit_enabled: true,
    rate_limit_per_hour: 10,
    captcha_enabled: false,
    custom_css: "",
    thank_you_message: "",
    redirect_url: "",
  });

  // Load form data if provided
  useEffect(() => {
    if (workflowForm) {
      setFormFormData({
        form_name: workflowForm.form_name || "",
        public_slug: workflowForm.public_slug || "",
        form_fields_schema: workflowForm.form_fields_schema || { fields: [] },
        rate_limit_enabled:
          workflowForm.rate_limit_enabled !== undefined
            ? workflowForm.rate_limit_enabled
            : true,
        rate_limit_per_hour: workflowForm.rate_limit_per_hour || 10,
        captcha_enabled: workflowForm.captcha_enabled || false,
        custom_css: workflowForm.custom_css || "",
        thank_you_message: workflowForm.thank_you_message || "",
        redirect_url: workflowForm.redirect_url || "",
      });
    }
  }, [workflowForm]);

  // Auto-update form name when workflow name changes
  useEffect(() => {
    if (
      workflowName &&
      (formFormData.form_name === `${workflowName} Form` ||
        !formFormData.form_name)
    ) {
      setFormFormData((prev) => ({
        ...prev,
        form_name: `${workflowName} Form`,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowName]);

  const handleFormChange = (field: string, value: any) => {
    setFormFormData((prev) => ({ ...prev, [field]: value }));
  };

  const setFields = useCallback(
    (
      updater:
        | FormFieldType[]
        | ((prevFields: FormFieldType[]) => FormFieldType[]),
    ) => {
      setFormFormData((prev) => {
        const nextFields =
          typeof updater === "function"
            ? updater(prev.form_fields_schema.fields)
            : updater;
        return {
          ...prev,
          form_fields_schema: {
            ...prev.form_fields_schema,
            fields: nextFields,
          },
        };
      });
    },
    [],
  );

  const {
    updateItem: updateRootField,
    addItem: addRootField,
    removeItem: removeRootField,
    moveItemUp: moveRootFieldUp,
    moveItemDown: moveRootFieldDown,
  } = useOrderedList(formFormData.form_fields_schema.fields, setFields);

  const buildEmptyField = () => ({
    field_id: `field_${Date.now()}`,
    field_type: "text",
    label: "",
    placeholder: "",
    required: false,
  });

  const handleFieldChange = (
    path: FormFieldPath,
    field: string,
    value: any,
  ) => {
    if (path.length === 1) {
      updateRootField(path[0], (prev) => ({ ...prev, [field]: value }));
      return;
    }
    setFormFormData((prev) => ({
      ...prev,
      form_fields_schema: {
        ...prev.form_fields_schema,
        fields: updateFieldAtPath(prev.form_fields_schema.fields, path, (item) => ({
          ...item,
          [field]: value,
        })),
      },
    }));
  };

  const addField = (parentPath: FormFieldPath = []) => {
    if (parentPath.length === 0) {
      addRootField(buildEmptyField());
      return;
    }
    setFormFormData((prev) => ({
      ...prev,
      form_fields_schema: {
        ...prev.form_fields_schema,
        fields: updateFieldListAtPath(
          prev.form_fields_schema.fields,
          parentPath,
          (fields) => [...fields, buildEmptyField()],
        ),
      },
    }));
  };

  const removeField = (path: FormFieldPath) => {
    if (path.length === 0) return;
    if (path.length === 1) {
      removeRootField(path[0]);
      return;
    }
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    setFormFormData((prev) => ({
      ...prev,
      form_fields_schema: {
        ...prev.form_fields_schema,
        fields: updateFieldListAtPath(
          prev.form_fields_schema.fields,
          parentPath,
          (fields) => fields.filter((_, fieldIndex) => fieldIndex !== index),
        ),
      },
    }));
  };

  const moveFieldUp = (path: FormFieldPath) => {
    if (path.length === 0) return;
    const index = path[path.length - 1];
    if (index <= 0) return;
    if (path.length === 1) {
      moveRootFieldUp(index);
      return;
    }
    const parentPath = path.slice(0, -1);
    setFormFormData((prev) => ({
      ...prev,
      form_fields_schema: {
        ...prev.form_fields_schema,
        fields: updateFieldListAtPath(
          prev.form_fields_schema.fields,
          parentPath,
          (fields) => {
            if (index >= fields.length) return fields;
            const nextFields = [...fields];
            [nextFields[index - 1], nextFields[index]] = [
              nextFields[index],
              nextFields[index - 1],
            ];
            return nextFields;
          },
        ),
      },
    }));
  };

  const moveFieldDown = (path: FormFieldPath) => {
    if (path.length === 0) return;
    const index = path[path.length - 1];
    if (path.length === 1) {
      moveRootFieldDown(index);
      return;
    }
    const parentPath = path.slice(0, -1);
    setFormFormData((prev) => ({
      ...prev,
      form_fields_schema: {
        ...prev.form_fields_schema,
        fields: updateFieldListAtPath(
          prev.form_fields_schema.fields,
          parentPath,
          (fields) => {
            if (index >= fields.length - 1) return fields;
            const nextFields = [...fields];
            [nextFields[index], nextFields[index + 1]] = [
              nextFields[index + 1],
              nextFields[index],
            ];
            return nextFields;
          },
        ),
      },
    }));
  };

  return {
    formFormData,
    setFormFormData,
    handleFormChange,
    handleFieldChange,
    addField,
    removeField,
    moveFieldUp,
    moveFieldDown,
  };
}
