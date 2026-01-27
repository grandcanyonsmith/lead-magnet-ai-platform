"use client";

import { ChevronDown, ChevronUp, Minus } from "lucide-react";
import { FiTrash2 } from "react-icons/fi";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { getFieldTypeIcon } from "@/utils/formUtils";
import type { FormField } from "@/types/form";
import type { FormFieldPath } from "./FormFieldListEditor";

type EditorVariant = "compact" | "card";

interface FormFieldEditorProps {
  field: FormField;
  index: number;
  totalCount: number;
  path: FormFieldPath;
  onFieldChange: (path: FormFieldPath, field: string, value: any) => void;
  onRemove?: (path: FormFieldPath) => void;
  onMoveUp?: (path: FormFieldPath) => void;
  onMoveDown?: (path: FormFieldPath) => void;
  showMoveControls?: boolean;
  variant?: EditorVariant;
}

const BASE_FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Select" },
  { value: "number", label: "Number" },
  { value: "url", label: "URL" },
  { value: "file", label: "File Upload" },
];

export function FormFieldEditor({
  field,
  index,
  totalCount,
  path,
  onFieldChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  showMoveControls = false,
  variant = "card",
}: FormFieldEditorProps) {
  const fieldType = field.field_type || "text";
  const isGroup = fieldType === "group";
  const fieldTypeOptions = isGroup
    ? [...BASE_FIELD_TYPE_OPTIONS, { value: "group", label: "Group" }]
    : BASE_FIELD_TYPE_OPTIONS;
  const showOptions = fieldType === "select";
  const showPlaceholder = !isGroup;
  const showRequired = !isGroup;

  const handleOptionsChange = (value: string) => {
    onFieldChange(
      path,
      "options",
      value
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean),
    );
  };

  if (variant === "compact") {
    return (
      <div className="border border-gray-200 rounded-lg p-4 relative group">
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(path)}
            className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors p-1"
            title="Remove field"
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 pr-8">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Question Label
            </label>
            <input
              type="text"
              value={field.label || ""}
              onChange={(e) => onFieldChange(path, "label", e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              placeholder="e.g. What is your email?"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Type
            </label>
            <Select
              value={fieldType}
              onChange={(nextValue) =>
                onFieldChange(path, "field_type", nextValue)
              }
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {fieldTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {showPlaceholder && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Placeholder
              </label>
              <input
                type="text"
                value={field.placeholder || ""}
                onChange={(e) =>
                  onFieldChange(path, "placeholder", e.target.value)
                }
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Placeholder text"
              />
            </div>
            {showRequired && (
              <div className="flex items-center">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={field.required || false}
                    onChange={(checked) =>
                      onFieldChange(path, "required", checked)
                    }
                  />
                  <span className="text-xs font-medium text-gray-600">
                    Required
                  </span>
                </label>
              </div>
            )}
          </div>
        )}
        {showOptions && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Options (comma-separated)
            </label>
            <input
              type="text"
              value={field.options?.join(", ") || ""}
              onChange={(e) => handleOptionsChange(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              placeholder="Option 1, Option 2, Option 3"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-border bg-white/90 dark:bg-secondary/50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-200 dark:hover:border-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 dark:bg-secondary text-xs font-semibold text-gray-500 dark:text-muted-foreground">
            #{index + 1}
          </span>
          <div className="flex items-center gap-2 rounded-full bg-gray-100 dark:bg-secondary px-3 py-1 text-xs font-medium text-gray-700 dark:text-foreground">
            {getFieldTypeIcon(fieldType)}
            <span className="capitalize">{fieldType}</span>
          </div>
          {field.required && showRequired && (
            <span className="rounded-full bg-red-50 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
              Required
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {showMoveControls && onMoveUp && (
            <button
              type="button"
              onClick={() => onMoveUp(path)}
              disabled={index === 0}
              className="rounded-full border border-gray-200 dark:border-border p-2 text-gray-500 dark:text-muted-foreground transition hover:text-gray-900 dark:hover:text-foreground disabled:cursor-not-allowed disabled:text-gray-300 dark:disabled:text-muted-foreground/50"
              title="Move field up"
              aria-label={`Move ${field.label || "field"} up`}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
          {showMoveControls && onMoveDown && (
            <button
              type="button"
              onClick={() => onMoveDown(path)}
              disabled={index === totalCount - 1}
              className="rounded-full border border-gray-200 dark:border-border p-2 text-gray-500 dark:text-muted-foreground transition hover:text-gray-900 dark:hover:text-foreground disabled:cursor-not-allowed disabled:text-gray-300 dark:disabled:text-muted-foreground/50"
              title="Move field down"
              aria-label={`Move ${field.label || "field"} down`}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(path)}
              className="ml-1 rounded-full border border-red-100 dark:border-red-800 p-2 text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/30"
              title="Remove field"
              aria-label={`Remove ${field.label || "field"}`}
            >
              <Minus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-muted-foreground">
            Field type
          </label>
          <Select
            value={fieldType}
            onChange={(nextValue) =>
              onFieldChange(path, "field_type", nextValue)
            }
            className="mt-2 w-full rounded-xl border border-gray-200 dark:border-border px-3 py-2 text-sm bg-white dark:bg-secondary text-gray-900 dark:text-foreground focus:border-primary-500 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary/20"
          >
            {fieldTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-muted-foreground">
            Label
          </label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onFieldChange(path, "label", e.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 dark:border-border px-3 py-2 text-sm bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:border-primary-500 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary/20"
            placeholder="Field label"
          />
        </div>
      </div>

      {showPlaceholder && (
        <div className="mt-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-muted-foreground">
            Placeholder
          </label>
          <input
            type="text"
            value={field.placeholder || ""}
            onChange={(e) => onFieldChange(path, "placeholder", e.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 dark:border-border px-3 py-2 text-sm bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:border-primary-500 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary/20"
            placeholder="Placeholder text"
          />
        </div>
      )}

      {showOptions && (
        <div className="mt-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-muted-foreground">
            Options (comma separated)
          </label>
          <input
            type="text"
            value={field.options?.join(", ") || ""}
            onChange={(e) => handleOptionsChange(e.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 dark:border-border px-3 py-2 text-sm bg-white dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-muted-foreground focus:border-primary-500 dark:focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary/20"
            placeholder="Option 1, Option 2, Option 3"
          />
        </div>
      )}

      {showRequired && (
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-600 dark:text-muted-foreground">
          <Checkbox
            checked={field.required}
            onChange={(checked) => onFieldChange(path, "required", checked)}
          />
          Required field
        </label>
      )}
    </div>
  );
}
