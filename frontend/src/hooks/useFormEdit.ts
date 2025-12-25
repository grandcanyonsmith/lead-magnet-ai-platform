"use client";

import { useState, useEffect } from "react";

export interface FormField {
  field_id: string;
  field_type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

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

  const handleFieldChange = (index: number, field: string, value: any) => {
    setFormFormData((prev) => {
      const newFields = [...prev.form_fields_schema.fields];
      newFields[index] = { ...newFields[index], [field]: value };
      return {
        ...prev,
        form_fields_schema: {
          ...prev.form_fields_schema,
          fields: newFields,
        },
      };
    });
  };

  const addField = () => {
    setFormFormData((prev) => ({
      ...prev,
      form_fields_schema: {
        ...prev.form_fields_schema,
        fields: [
          ...prev.form_fields_schema.fields,
          {
            field_id: `field_${Date.now()}`,
            field_type: "text",
            label: "",
            placeholder: "",
            required: false,
          },
        ],
      },
    }));
  };

  const removeField = (index: number) => {
    setFormFormData((prev) => {
      const newFields = [...prev.form_fields_schema.fields];
      newFields.splice(index, 1);
      return {
        ...prev,
        form_fields_schema: {
          ...prev.form_fields_schema,
          fields: newFields,
        },
      };
    });
  };

  const moveFieldUp = (index: number) => {
    if (index === 0) return;
    setFormFormData((prev) => {
      const newFields = [...prev.form_fields_schema.fields];
      const temp = newFields[index];
      newFields[index] = newFields[index - 1];
      newFields[index - 1] = temp;
      return {
        ...prev,
        form_fields_schema: {
          ...prev.form_fields_schema,
          fields: newFields,
        },
      };
    });
  };

  const moveFieldDown = (index: number) => {
    setFormFormData((prev) => {
      const newFields = [...prev.form_fields_schema.fields];
      if (index >= newFields.length - 1) return prev;
      const temp = newFields[index];
      newFields[index] = newFields[index + 1];
      newFields[index + 1] = temp;
      return {
        ...prev,
        form_fields_schema: {
          ...prev.form_fields_schema,
          fields: newFields,
        },
      };
    });
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
