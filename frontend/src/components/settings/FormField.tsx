/**
 * Reusable form field component with label, input, error message, and help text
 */

"use client";

import { ReactNode } from "react";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string | ReactNode;
  name: string;
  type?: "text" | "email" | "url" | "tel" | "number" | "textarea";
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  options?: { value: string; label: string }[];
  className?: string;
  dataTour?: string;
}

export function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  helpText,
  placeholder,
  required = false,
  disabled = false,
  readOnly = false,
  options,
  className = "",
  dataTour,
}: FormFieldProps) {
  const inputId = `field-${name}`;

  const renderInput = () => {
    if (type === "textarea") {
      return (
        <Textarea
          id={inputId}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(className, error && "border-red-500 focus-visible:ring-red-500")}
          rows={4}
          data-tour={dataTour}
          aria-describedby={helpText && !error ? `${inputId}-help` : undefined}
          aria-invalid={error ? "true" : "false"}
          aria-required={required ? "true" : "false"}
        />
      );
    }

    if (options && options.length > 0) {
      return (
        <Select
          id={inputId}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={cn(className, error && "border-red-500 focus-visible:ring-red-500")}
          data-tour={dataTour}
          aria-describedby={helpText && !error ? `${inputId}-help` : undefined}
          aria-invalid={error ? "true" : "false"}
          aria-required={required ? "true" : "false"}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );
    }

    return (
      <Input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(className, error && "border-red-500 focus-visible:ring-red-500")}
        data-tour={dataTour}
        aria-describedby={helpText && !error ? `${inputId}-help` : undefined}
        aria-invalid={error ? "true" : "false"}
        aria-required={required ? "true" : "false"}
      />
    );
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </Label>
      {renderInput()}
      {error && (
        <p
          className="text-sm text-red-500 font-medium"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className="text-sm text-gray-500 dark:text-muted-foreground" id={`${inputId}-help`}>
          {helpText}
        </p>
      )}
    </div>
  );
}
