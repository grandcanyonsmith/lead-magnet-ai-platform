import type { FormField } from "@/types/form";

export type FormFieldPath = number[];

export const updateFieldAtPath = (
  fields: FormField[],
  path: FormFieldPath,
  updater: (field: FormField) => FormField,
): FormField[] => {
  if (path.length === 0) return fields;
  const [index, ...rest] = path;
  return fields.map((field, currentIndex) => {
    if (currentIndex !== index) return field;
    if (rest.length === 0) return updater(field);
    return {
      ...field,
      fields: updateFieldAtPath(field.fields ?? [], rest, updater),
    };
  });
};

export const updateFieldListAtPath = (
  fields: FormField[],
  path: FormFieldPath,
  updater: (fields: FormField[]) => FormField[],
): FormField[] => {
  if (path.length === 0) return updater(fields);
  const [index, ...rest] = path;
  return fields.map((field, currentIndex) => {
    if (currentIndex !== index) return field;
    return {
      ...field,
      fields: updateFieldListAtPath(field.fields ?? [], rest, updater),
    };
  });
};
