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
  children?: React.ReactNode
  "aria-label"?: string
  "aria-describedby"?: string
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
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedBy,
      children,
    },
    ref,
  ) => {
    const childOptions = React.Children.toArray(children).flatMap((child, index) =>
      toOptions(child, index),
    )

    const resolvedOptions = options && options.length > 0 ? options : childOptions
    const selectedValue = String(value ?? defaultValue ?? "")
    const selectedOption = resolvedOptions.find((opt) => opt.value === selectedValue)

    const handleChange = onChange ?? (() => {})

    return (
      <Listbox value={selectedValue} onChange={handleChange} disabled={disabled}>
        <div className="relative" ref={ref}>
          {name && <input type="hidden" name={name} value={selectedValue} />}
          <Listbox.Button
            id={id}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-required={required ? "true" : undefined}
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          >
            <span className={cn(!selectedOption && "text-muted-foreground")}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronUpDownIcon
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-popover py-1 text-sm shadow-md ring-1 ring-black/5 focus:outline-none">
              {resolvedOptions.map((option) => (
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
                          "block truncate",
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
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    )
  },
)
Select.displayName = "Select"

export { Select }

