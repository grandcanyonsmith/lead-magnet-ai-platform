"use client"

import * as React from "react"
import { Fragment } from "react"
import { Listbox, Transition } from "@headlessui/react"
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid"
import { cn } from "@/lib/utils"

type SelectOption = {
  value: string
  label: React.ReactNode
  disabled?: boolean
  isGroupLabel?: boolean
}

export interface SelectProps {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  options?: SelectOption[]
  className?: string
  disabled?: boolean
  required?: boolean
  name?: string
  id?: string
  title?: string
  children?: React.ReactNode
  "aria-label"?: string
  "aria-describedby"?: string
  searchable?: boolean
  searchPlaceholder?: string
}

const toOptions = (child: React.ReactNode, groupIndex = 0): SelectOption[] => {
  if (!React.isValidElement(child)) return []
  if (child.type === "option") {
    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>
    const value = props.value ?? ""
    return [
      {
        value: String(value),
        label: props.children,
        disabled: props.disabled,
      },
    ]
  }
  if (child.type === "optgroup") {
    const label = child.props.label
    const nested = React.Children.toArray(child.props.children).flatMap(
      (nestedChild) => toOptions(nestedChild, groupIndex + 1),
    )
    return [
      {
        value: `__group_${groupIndex}_${String(label)}`,
        label,
        disabled: true,
        isGroupLabel: true,
      },
      ...nested,
    ]
  }
  return []
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      placeholder = "Select an option",
      options,
      className,
      disabled,
      required,
      name,
      id,
      title,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedBy,
      searchable,
      searchPlaceholder,
      children,
    },
    ref,
  ) => {
    const [searchQuery, setSearchQuery] = React.useState("")

    const childOptions = React.Children.toArray(children).flatMap((child, index) =>
      toOptions(child, index),
    )

    const resolvedOptions = options && options.length > 0 ? options : childOptions
    
    const filteredOptions = React.useMemo(() => {
      if (!searchable || !searchQuery.trim()) return resolvedOptions
      const query = searchQuery.toLowerCase()
      return resolvedOptions.filter((option) => {
        if (option.isGroupLabel) return true // Keep group labels? Maybe logic needs to be smarter
        // Simple text match on label (assuming label is string or renderable)
        // If label is ReactNode, we might need a way to get text. 
        // For now assume string conversion works or label is string.
        // In ModelConfig, label is string.
        const labelText = typeof option.label === 'string' ? option.label : String(option.label)
        return labelText.toLowerCase().includes(query)
      })
    }, [resolvedOptions, searchQuery, searchable])

    const selectedValue = String(value ?? defaultValue ?? "")
    const selectedOption = resolvedOptions.find((opt) => opt.value === selectedValue)

    const handleChange = onChange ?? (() => {})

    // Reset search when closed? 
    // We can't easily detect close with just Listbox, but it's fine to keep state or reset on open if we wrapped it.
    // For now, let's just keep it simple.

    return (
      <Listbox value={selectedValue} onChange={handleChange} disabled={disabled}>
        <div className="relative" ref={ref}>
          {name && <input type="hidden" name={name} value={selectedValue} />}
          <Listbox.Button
            id={id}
            title={title}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-required={required ? "true" : undefined}
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          >
            <span className={cn(
              "min-w-0 flex-1 text-left truncate",
              !selectedOption && "text-muted-foreground"
            )}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronUpDownIcon
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options
              anchor="bottom start"
              className="z-50 mt-1 max-h-60 w-[var(--button-width)] max-w-[calc(100vw-2rem)] overflow-auto rounded-md border border-input bg-popover py-1 text-sm shadow-md ring-1 ring-black/5 focus:outline-none"
            >
              {searchable && (
                <div className="sticky top-0 z-10 bg-popover px-2 py-1.5 border-b border-input mb-1">
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder={searchPlaceholder || "Search..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              {filteredOptions.length === 0 ? (
                <div className="py-2 px-4 text-xs text-muted-foreground text-center">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <Listbox.Option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={({ active, disabled: optionDisabled }) =>
                      cn(
                        "relative cursor-default select-none py-2 pl-8 pr-4",
                        option.isGroupLabel && "cursor-default pl-3 pr-3 text-xs uppercase tracking-wide text-muted-foreground",
                        active && "bg-accent text-accent-foreground",
                        optionDisabled && "opacity-50",
                      )
                    }
                  >
                    {({ selected }) => (
                      <>
                        <span
                          className={cn(
                            "block truncate break-words",
                            option.isGroupLabel
                              ? "font-semibold"
                              : selected
                                ? "font-medium"
                                : "font-normal",
                          )}
                        >
                          {option.label}
                        </span>
                        {selected && !option.isGroupLabel ? (
                          <span className="absolute inset-y-0 left-2 flex items-center text-accent-foreground">
                            <CheckIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))
              )}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    )
  },
)
Select.displayName = "Select"

export { Select }

