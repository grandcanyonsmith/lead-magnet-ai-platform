/**
 * Reusable form field component with label, input, error message, and help text
 */

"use client";

import { ReactNode } from "react";

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

  const baseInputClasses = `w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-200 ${
    error
      ? "border-red-300 focus:ring-red-500 bg-red-50/30"
      : "border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 hover:border-gray-300"
  } ${disabled || readOnly ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "bg-white text-gray-900 shadow-sm"} ${className}`;

  const renderInput = () => {
    if (type === "textarea") {
      return (
        <textarea
          id={inputId}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          className={baseInputClasses}
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
        <select
          id={inputId}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={baseInputClasses}
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
        </select>
      );
    }

    return (
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        className={baseInputClasses}
        data-tour={dataTour}
        aria-describedby={helpText && !error ? `${inputId}-help` : undefined}
        aria-invalid={error ? "true" : "false"}
        aria-required={required ? "true" : "false"}
      />
    );
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      {renderInput()}
      {error && (
        <p
          className="mt-1 text-sm text-red-600"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-sm text-gray-500" id={`${inputId}-help`}>
          {helpText}
        </p>
      )}
    </div>
  );
}
