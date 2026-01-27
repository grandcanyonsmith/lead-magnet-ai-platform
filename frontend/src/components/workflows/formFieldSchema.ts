import type { FieldSchema } from "@/components/ui/recursive/RecursiveForm";
import type { FormField } from "@/types/form";

export const toRecursiveSchema = (
  fields: FormField[],
  parentPath: number[] = [],
): FieldSchema[] =>
  fields.map((field, index) => {
    const path = [...parentPath, index];
    const fallbackId = `field-${path.join("-")}`;
    return {
      id: field.field_id || fallbackId,
      type: (field.field_type || "text") as FieldSchema["type"],
      label: field.label || `Field ${index + 1}`,
      name: field.field_id || fallbackId,
      placeholder: field.placeholder,
      required: field.required,
      options: field.options,
      fields: field.fields ? toRecursiveSchema(field.fields, path) : undefined,
    };
  });
