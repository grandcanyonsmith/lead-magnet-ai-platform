"use client"

import { Switch as HeadlessSwitch } from "@headlessui/react"
import { cn } from "@/lib/utils"

type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  name?: string
  className?: string
  "aria-label"?: string
}

export function Switch({
  checked,
  onChange,
  disabled,
  id,
  name,
  className,
  ...props
}: SwitchProps) {
  return (
    <div className="relative inline-flex items-center">
      {name && checked && <input type="hidden" name={name} value="on" />}
      <HeadlessSwitch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        id={id}
        type="button"
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full border border-input transition-colors",
          checked ? "bg-primary" : "bg-muted",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition",
            checked ? "translate-x-4" : "translate-x-1",
          )}
        />
      </HeadlessSwitch>
    </div>
  )
}
