import React from "react";
import { FormField } from "@/components/settings/FormField";
import { cn } from "@/lib/utils";

export interface FieldSchema {
  id: string;
  type:
    | "text"
    | "email"
    | "number"
    | "select"
    | "textarea"
    | "group"
    | "file"
    | "url"
    | "tel";
  label?: string;
  name: string; // key in values object
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[] | string[];
  fields?: FieldSchema[]; // For groups
  defaultValue?: any;
  helpText?: string;
  disabled?: boolean;
  className?: string;
}

interface RecursiveFormProps {
  schema: FieldSchema[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  errors?: Record<string, string>;
  readOnly?: boolean;
  className?: string;
}

export const RecursiveForm: React.FC<RecursiveFormProps> = ({
  schema,
  values,
  onChange,
  errors = {},
  readOnly = false,
  className,
}) => {
  const renderField = (field: FieldSchema) => {
    if (field.type === "group" && field.fields) {
      return (
        <div key={field.id} className={cn("space-y-4", field.className)}>
          {field.label && (
            <h3 className="text-lg font-medium text-foreground">
              {field.label}
            </h3>
          )}
          <RecursiveForm
            schema={field.fields}
            values={values}
            onChange={onChange}
            errors={errors}
            readOnly={readOnly}
          />
        </div>
      );
    }

    // Normalize options if they are strings
    const options = field.options?.map((opt) =>
      typeof opt === "string" ? { label: opt, value: opt } : opt
    );

    return (
      <FormField
        key={field.id}
        label={field.label || field.name}
        name={field.name}
        type={field.type as any}
        value={values[field.name] ?? field.defaultValue ?? ""}
        onChange={(val) => onChange(field.name, val)}
        error={errors[field.name]}
        helpText={field.helpText}
        placeholder={field.placeholder}
        required={field.required}
        disabled={field.disabled || readOnly}
        readOnly={readOnly}
        options={options}
        className={field.className}
      />
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {schema.map((field) => renderField(field))}
    </div>
  );
};
