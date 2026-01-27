"use client";

import { FiPlus } from "react-icons/fi";
import { cn } from "@/lib/utils";
import type { FormField } from "@/types/form";
import { FormFieldEditor } from "./FormFieldEditor";

export type FormFieldPath = number[];

type EditorVariant = "compact" | "card";

interface FormFieldListEditorProps {
  fields: FormField[];
  onFieldChange: (path: FormFieldPath, field: string, value: any) => void;
  onAddField?: (parentPath?: FormFieldPath) => void;
  onRemoveField?: (path: FormFieldPath) => void;
  onMoveFieldUp?: (path: FormFieldPath) => void;
  onMoveFieldDown?: (path: FormFieldPath) => void;
  variant?: EditorVariant;
  showMoveControls?: boolean;
  showAddButton?: boolean;
  showNestedAddButton?: boolean;
  addButtonLabel?: string;
  parentPath?: FormFieldPath;
}

export function FormFieldListEditor({
  fields,
  onFieldChange,
  onAddField,
  onRemoveField,
  onMoveFieldUp,
  onMoveFieldDown,
  variant = "card",
  showMoveControls = false,
  showAddButton = false,
  showNestedAddButton = false,
  addButtonLabel = "Add Field",
  parentPath = [],
}: FormFieldListEditorProps) {
  const isNested = parentPath.length > 0;
  const wrapperClassName = cn(
    "space-y-4",
    isNested &&
      "mt-4 border-l border-dashed border-gray-200 dark:border-border/60 pl-4",
  );

  return (
    <div className={wrapperClassName}>
      {fields.map((field, index) => {
        const path = [...parentPath, index];
        const fieldKey = field.field_id || `field-${path.join("-")}`;

        return (
          <div key={fieldKey}>
            <FormFieldEditor
              field={field}
              index={index}
              totalCount={fields.length}
              path={path}
              onFieldChange={onFieldChange}
              onRemove={onRemoveField}
              onMoveUp={onMoveFieldUp}
              onMoveDown={onMoveFieldDown}
              showMoveControls={showMoveControls}
              variant={variant}
            />
            {field.field_type === "group" &&
              ((field.fields && field.fields.length > 0) || showNestedAddButton) && (
                <FormFieldListEditor
                  fields={field.fields ?? []}
                  onFieldChange={onFieldChange}
                  onAddField={onAddField}
                  onRemoveField={onRemoveField}
                  onMoveFieldUp={onMoveFieldUp}
                  onMoveFieldDown={onMoveFieldDown}
                  variant={variant}
                  showMoveControls={showMoveControls}
                  showAddButton={showNestedAddButton}
                  showNestedAddButton={showNestedAddButton}
                  addButtonLabel={addButtonLabel}
                  parentPath={path}
                />
              )}
          </div>
        );
      })}

      {showAddButton && onAddField && (
        <button
          type="button"
          onClick={() => onAddField(parentPath)}
          className={cn(
            "mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors w-full justify-center",
            variant === "compact"
              ? "text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg border border-primary-200 border-dashed"
              : "text-primary-700 border border-primary-600 rounded-full hover:bg-primary-600 hover:text-white",
          )}
        >
          <FiPlus className="w-4 h-4" />
          {addButtonLabel}
        </button>
      )}
    </div>
  );
}
