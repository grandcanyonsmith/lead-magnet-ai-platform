"use client";

import { Eye, Info, Plus, Settings, Shield } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Switch } from "@/components/ui/Switch";
import { FormFormData } from "@/hooks/useFormEdit";
import { buildPublicFormUrl } from "@/utils/url";
import { RecursiveForm } from "@/components/ui/recursive/RecursiveForm";
import { FormFieldListEditor } from "@/components/workflows/FormFieldListEditor";
import { toRecursiveSchema } from "@/components/workflows/formFieldSchema";

interface FormTabProps {
  formFormData: FormFormData;
  workflowName: string;
  submitting: boolean;
  customDomain?: string;
  onFormChange: (field: string, value: any) => void;
  onFieldChange: (path: number[], field: string, value: any) => void;
  onAddField: (parentPath?: number[]) => void;
  onRemoveField: (path: number[]) => void;
  onMoveFieldUp: (path: number[]) => void;
  onMoveFieldDown: (path: number[]) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function FormPreview({ formFormData }: { formFormData: FormFormData }) {
  const allFields = formFormData.form_fields_schema.fields;
  const previewSchema = toRecursiveSchema(allFields);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-foreground">
        {formFormData.form_name || "Form Preview"}
      </h3>
      <div className="space-y-4">
        <RecursiveForm
          schema={previewSchema}
          values={{}}
          onChange={() => {}}
          readOnly={true}
        />
        <button
          type="button"
          className="w-full py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 dark:bg-primary hover:bg-primary-700 dark:hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled
        >
          Submit
        </button>
      </div>
    </div>
  );
}

export function FormTab({
  formFormData,
  workflowName,
  submitting,
  customDomain,
  onFormChange,
  onFieldChange,
  onAddField,
  onRemoveField,
  onMoveFieldUp,
  onMoveFieldDown,
  onSubmit,
  onCancel,
}: FormTabProps) {
  const customFields = formFormData.form_fields_schema.fields;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="order-2 space-y-6 lg:order-1">
        <SectionCard
          title="Form basics"
          description="Keep your form easy to identify and simple to share."
          icon={<Info className="h-5 w-5" aria-hidden="true" />}
        >
          <div className="rounded-2xl border border-blue-100/80 dark:border-blue-800/50 bg-blue-50/70 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-900 dark:text-blue-300">
            <p>
              <strong className="font-semibold">Heads up:</strong> this form
              name automatically mirrors your lead magnet name.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-foreground">
                Form name <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formFormData.form_name}
                onChange={(e) => onFormChange("form_name", e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-border px-3 py-2.5 text-sm shadow-sm bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:border-primary-500 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary/20"
                placeholder="Lead Magnet Form"
                maxLength={200}
                required
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                Automatically set to &quot;{workflowName} Form&quot;.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-foreground">
                Public URL slug <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formFormData.public_slug}
                onChange={(e) =>
                  onFormChange(
                    "public_slug",
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-border px-3 py-2.5 font-mono text-sm lowercase shadow-sm bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:border-primary-500 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary/20"
                placeholder="lead-magnet-form"
                pattern="[a-z0-9-]+"
                required
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                Only lowercase letters, numbers, and hyphens are allowed.
              </p>
              {formFormData.public_slug && (
                <p className="mt-1 text-xs font-medium text-primary-600 dark:text-primary">
                  Form URL:{" "}
                  {buildPublicFormUrl(formFormData.public_slug, customDomain)}
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Form fields"
          description="Collect only the information that matters."
          icon={<Settings className="h-5 w-5" aria-hidden="true" />}
          actions={
            <button
              type="button"
              onClick={onAddField}
              className="inline-flex items-center gap-2 rounded-full border border-primary-600 dark:border-primary px-4 py-2 text-sm font-semibold text-primary-700 dark:text-primary transition hover:bg-primary-600 dark:hover:bg-primary hover:text-white"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add field
            </button>
          }
        >
          <p className="text-sm text-gray-500 dark:text-muted-foreground">
            Add fields below to collect the information you need from your
            leads.
          </p>

          <div className="mt-4 space-y-3">
            <FormFieldListEditor
              fields={customFields}
              onFieldChange={onFieldChange}
              onRemoveField={onRemoveField}
              onMoveFieldUp={onMoveFieldUp}
              onMoveFieldDown={onMoveFieldDown}
              variant="card"
              showMoveControls={true}
            />

            {customFields.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-border px-4 py-10 text-center">
                <p className="text-sm text-gray-600 dark:text-muted-foreground">
                  No fields yet. Add fields to collect information from your
                  leads.
                </p>
                <button
                  type="button"
                  onClick={onAddField}
                  className="mt-4 text-sm font-semibold text-primary-600 dark:text-primary transition hover:text-primary-800 dark:hover:text-primary/80"
                >
                  Add your first field
                </button>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Security & limits"
          description="Prevent spam and control submission flow."
          icon={<Shield className="h-5 w-5" aria-hidden="true" />}
        >
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <Switch
                checked={formFormData.rate_limit_enabled}
                onChange={(checked) =>
                  onFormChange("rate_limit_enabled", checked)
                }
              />
              <span className="text-sm font-medium text-gray-900 dark:text-foreground">
                Enable rate limiting
              </span>
            </label>

            {formFormData.rate_limit_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-foreground">
                  Submissions per hour
                </label>
                <input
                  type="number"
                  value={formFormData.rate_limit_per_hour}
                  onChange={(e) =>
                    onFormChange(
                      "rate_limit_per_hour",
                      parseInt(e.target.value, 10) || 10,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-border px-3 py-2 text-sm bg-white dark:bg-secondary text-gray-900 dark:text-foreground focus:border-primary-500 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary/20"
                  min={1}
                  max={1000}
                />
              </div>
            )}

            <label className="flex items-center gap-3">
              <Switch
                checked={formFormData.captcha_enabled}
                onChange={(checked) =>
                  onFormChange("captcha_enabled", checked)
                }
              />
              <span className="text-sm font-medium text-gray-900 dark:text-foreground">
                Enable CAPTCHA
              </span>
            </label>
          </div>
        </SectionCard>

        <SectionCard
          title="Confirmation & styling"
          description="Polish the experience after someone submits the form."
          icon={<Settings className="h-5 w-5" aria-hidden="true" />}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-foreground">
                Thank you message
              </label>
              <textarea
                value={formFormData.thank_you_message}
                onChange={(e) =>
                  onFormChange("thank_you_message", e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-border px-3 py-2 text-sm shadow-sm bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:border-primary-500 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary/20"
                placeholder="Thank you! Your submission is being processed."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-foreground">
                Redirect URL (optional)
              </label>
              <input
                type="url"
                value={formFormData.redirect_url}
                onChange={(e) => onFormChange("redirect_url", e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-border px-3 py-2 text-sm shadow-sm bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:border-primary-500 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary/20"
                placeholder="https://example.com/thank-you"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-foreground">
                Custom CSS (optional)
              </label>
              <textarea
                value={formFormData.custom_css}
                onChange={(e) => onFormChange("custom_css", e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-border px-3 py-2 font-mono text-sm shadow-sm bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:border-primary-500 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary/20"
                placeholder="/* Custom CSS styles */"
                rows={6}
              />
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-6">
          <SectionCard
            title="Live preview"
            description="See exactly what visitors will experience."
            icon={<Eye className="h-5 w-5" aria-hidden="true" />}
            stickyHeader
          >
            <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
              <FormPreview formFormData={formFormData} />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
