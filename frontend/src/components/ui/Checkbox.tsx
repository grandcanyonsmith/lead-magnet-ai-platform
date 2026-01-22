"use client"

import { Checkbox as HeadlessCheckbox } from "@headlessui/react"
import { CheckIcon } from "@heroicons/react/20/solid"
import { cn } from "@/lib/utils"

type CheckboxProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  name?: string
  value?: string
  required?: boolean
  className?: string
  "aria-label"?: string
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  id,
  name,
  value,
  required,
  className,
  ...props
}: CheckboxProps) {
  return (
    <div className="relative inline-flex items-center">
      {name && checked && (
        <input type="hidden" name={name} value={value ?? "on"} />
      )}
      <HeadlessCheckbox
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        id={id}
        aria-required={required ? "true" : undefined}
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border border-input bg-background text-primary-foreground shadow-sm transition",
          checked && "border-primary bg-primary",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        {...props}
      >
        <CheckIcon className={cn("h-3 w-3", checked ? "opacity-100" : "opacity-0")} />
      </HeadlessCheckbox>
    </div>
  )
}
