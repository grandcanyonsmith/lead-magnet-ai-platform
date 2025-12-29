/**
 * Search input component with debouncing
 */

import React, { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import clsx from "clsx";

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  onDebouncedChange?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
}

export const SearchInput = React.memo(function SearchInput({
  value: controlledValue,
  onChange,
  onDebouncedChange,
  placeholder = "Search...",
  debounceMs = 300,
  className = "",
  disabled = false,
  autoFocus = false,
  "aria-label": ariaLabel = "Search",
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(controlledValue || "");
  const isControlled = controlledValue !== undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  const currentValue = isControlled ? controlledValue : internalValue;
  const debouncedValue = useDebounce(currentValue, debounceMs);

  // Call debounced change handler
  useEffect(() => {
    if (onDebouncedChange && debouncedValue !== undefined) {
      onDebouncedChange(debouncedValue);
    }
  }, [debouncedValue, onDebouncedChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange(newValue);
  };

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue("");
    }
    onChange("");
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className={clsx("relative", className)}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={currentValue || ""}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        className={clsx(
          "block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg",
          "focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
          "disabled:bg-gray-100 disabled:cursor-not-allowed",
          "text-sm sm:text-base"
        )}
      />
      {currentValue && (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          aria-label="Clear search"
        >
          <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </div>
  );
});

