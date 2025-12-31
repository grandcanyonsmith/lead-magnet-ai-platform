"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useSettings } from "@/hooks/api/useSettings";
import { buildPublicFormUrl } from "@/utils/url";
import { FiArrowLeft, FiSave } from "react-icons/fi";

type FormField = {
  field_id: string;
  field_type:
    | "text"
    | "textarea"
    | "email"
    | "tel"
    | "number"
    | "select"
    | "checkbox";
  label: string;
  placeholder?: string;
  required: boolean;
  validation_regex?: string;
  max_length?: number;
  options?: string[];
};

export default function EditFormClient() {
  const router = useRouter();
  const params = useParams();
  // Extract form ID from params, or fallback to URL pathname if param is '_' (static export edge rewrite)
  const getFormId = () => {
    const paramId = params?.id as string;
    if (paramId && paramId !== "_") {
      return paramId;
    }
    // Fallback: extract from browser URL
    if (typeof window !== "undefined") {
      const pathMatch = window.location.pathname.match(
        /\/dashboard\/forms\/([^/]+)\/edit/,
      );
      if (pathMatch && pathMatch[1] && pathMatch[1] !== "_") {
        return pathMatch[1];
      }
    }
    return paramId || "";
  };
  const formId = getFormId();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();

  const [formFormData, setFormFormData] = useState({
    form_name: "",
    public_slug: "",
    form_fields_schema: {
      fields: [] as FormField[],
    },
    rate_limit_enabled: true,
    rate_limit_per_hour: 10,
    captcha_enabled: false,
    custom_css: "",
    thank_you_message: "",
    redirect_url: "",
  });

  useEffect(() => {
    if (formId) {
      loadForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  const loadForm = async () => {
    try {
      const form = await api.getForm(formId);
      setFormFormData({
        form_name: form.form_name || "",
        public_slug: form.public_slug || "",
        form_fields_schema: form.form_fields_schema || { fields: [] },
        rate_limit_enabled:
          form.rate_limit_enabled !== undefined
            ? form.rate_limit_enabled
            : true,
        rate_limit_per_hour: form.rate_limit_per_hour || 10,
        captcha_enabled: form.captcha_enabled || false,
        custom_css: form.custom_css || "",
        thank_you_message: form.thank_you_message || "",
        redirect_url: form.redirect_url || "",
      });
      setError(null);
    } catch (error: any) {
      console.error("Failed to load form:", error);
      setError(
        error.response?.data?.message || error.message || "Failed to load form",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formFormData.form_name.trim()) {
      setError("Form name is required");
      return;
    }

    if (!formFormData.public_slug.trim()) {
      setError("Public URL slug is required");
      return;
    }

    setSubmitting(true);

    try {
      await api.updateForm(formId, {
        form_name: formFormData.form_name.trim(),
        public_slug: formFormData.public_slug.trim(),
        form_fields_schema: formFormData.form_fields_schema,
        rate_limit_enabled: formFormData.rate_limit_enabled,
        rate_limit_per_hour: formFormData.rate_limit_per_hour,
        captcha_enabled: formFormData.captcha_enabled,
        custom_css: formFormData.custom_css.trim() || undefined,
        thank_you_message: formFormData.thank_you_message.trim() || undefined,
        redirect_url: formFormData.redirect_url.trim() || undefined,
      });

      router.push("/dashboard/workflows");
    } catch (error: any) {
      console.error("Failed to update form:", error);
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to update form",
      );
    } finally {
      setSubmitting(false);
    }
  };

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-secondary rounded w-48 animate-pulse"></div>
        <div className="bg-white dark:bg-card rounded-lg shadow p-6 border border-gray-200 dark:border-border">
          <div className="h-64 bg-gray-200 dark:bg-secondary rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error && !formFormData.form_name) {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <FiArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 py-2 touch-target"
        >
          <FiArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900">Edit Form</h1>
        <p className="text-gray-600 mt-1">
          Update your lead capture form settings
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow p-6 space-y-6"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Form Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formFormData.form_name}
            onChange={(e) => handleFormChange("form_name", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Lead Magnet Form"
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Public URL Slug <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formFormData.public_slug}
            onChange={(e) =>
              handleFormChange(
                "public_slug",
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
              )
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            placeholder="lead-magnet-form"
            pattern="[a-z0-9-]+"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            URL-friendly identifier. Only lowercase letters, numbers, and
            hyphens allowed.
          </p>
          {formFormData.public_slug && (
            <p className="mt-1 text-xs text-primary-600">
              Form URL:{" "}
              {buildPublicFormUrl(
                formFormData.public_slug,
                settings?.custom_domain,
              )}
            </p>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Form Fields
            </label>
            <button
              type="button"
              onClick={addField}
              className="text-sm text-primary-600 hover:text-primary-900 py-2 px-2 touch-target"
            >
              + Add Field
            </button>
          </div>
          <div className="space-y-4">
            {formFormData.form_fields_schema.fields.map((field, index) => (
              <div
                key={field.field_id || index}
                className="border border-gray-200 rounded-lg p-4 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Field Type
                    </label>
                    <select
                      value={field.field_type}
                      onChange={(e) =>
                        handleFieldChange(index, "field_type", e.target.value)
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select</option>
                      <option value="number">Number</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) =>
                        handleFieldChange(index, "label", e.target.value)
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Field Label"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={field.placeholder || ""}
                    onChange={(e) =>
                      handleFieldChange(index, "placeholder", e.target.value)
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Placeholder text"
                  />
                </div>
                {field.field_type === "select" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Options (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={field.options?.join(", ") || ""}
                      onChange={(e) =>
                        handleFieldChange(
                          index,
                          "options",
                          e.target.value
                            .split(",")
                            .map((o) => o.trim())
                            .filter((o) => o),
                        )
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) =>
                        handleFieldChange(index, "required", e.target.checked)
                      }
                      className="mr-2"
                    />
                    <span className="text-xs text-gray-700">Required</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    className="text-xs text-red-600 hover:text-red-900 py-2 px-2 touch-target"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {formFormData.form_fields_schema.fields.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No custom fields. Name, email, and phone are always included.
              </p>
            )}
          </div>
        </div>

        <div className="border-t pt-6 space-y-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formFormData.rate_limit_enabled}
                onChange={(e) =>
                  handleFormChange("rate_limit_enabled", e.target.checked)
                }
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">
                Enable Rate Limiting
              </span>
            </label>
          </div>
          {formFormData.rate_limit_enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Submissions Per Hour
              </label>
              <input
                type="number"
                value={formFormData.rate_limit_per_hour}
                onChange={(e) =>
                  handleFormChange(
                    "rate_limit_per_hour",
                    parseInt(e.target.value) || 10,
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                min={1}
                max={1000}
              />
            </div>
          )}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formFormData.captcha_enabled}
                onChange={(e) =>
                  handleFormChange("captcha_enabled", e.target.checked)
                }
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">
                Enable CAPTCHA
              </span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thank You Message
          </label>
          <textarea
            value={formFormData.thank_you_message}
            onChange={(e) =>
              handleFormChange("thank_you_message", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Thank you! Your submission is being processed."
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Redirect URL (optional)
          </label>
          <input
            type="url"
            value={formFormData.redirect_url}
            onChange={(e) => handleFormChange("redirect_url", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="https://example.com/thank-you"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom CSS (optional)
          </label>
          <textarea
            value={formFormData.custom_css}
            onChange={(e) => handleFormChange("custom_css", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            placeholder="/* Custom CSS styles */"
            rows={6}
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4 border-t">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors touch-target"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
          >
            <FiSave className="w-5 h-5 mr-2" />
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
