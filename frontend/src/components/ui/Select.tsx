"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
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
  portal?: boolean
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
    const [open, setOpen] = React.useState(false)
    const [searchQuery, setSearchQuery] = React.useState("")
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
    const listRef = React.useRef<HTMLDivElement>(null)
    const searchRef = React.useRef<HTMLInputElement>(null)

    const childOptions = React.Children.toArray(children).flatMap((child, index) =>
      toOptions(child, index),
    )

    const resolvedOptions = options && options.length > 0 ? options : childOptions

    const filteredOptions = React.useMemo(() => {
      if (!searchable || !searchQuery.trim()) return resolvedOptions
      const query = searchQuery.toLowerCase()
      return resolvedOptions.filter((option) => {
        if (option.isGroupLabel) return true
        const labelText = typeof option.label === "string" ? option.label : String(option.label)
        return labelText.toLowerCase().includes(query)
      })
    }, [resolvedOptions, searchQuery, searchable])

    const selectableOptions = React.useMemo(
      () => filteredOptions.filter((o) => !o.disabled && !o.isGroupLabel),
      [filteredOptions],
    )

    const selectedValue = String(value ?? defaultValue ?? "")
    const selectedOption = resolvedOptions.find((opt) => opt.value === selectedValue)

    const handleSelect = React.useCallback(
      (optionValue: string) => {
        onChange?.(optionValue)
        setOpen(false)
        setSearchQuery("")
        setHighlightedIndex(-1)
      },
      [onChange],
    )

    const handleOpenChange = React.useCallback(
      (nextOpen: boolean) => {
        if (disabled) return
        setOpen(nextOpen)
        if (!nextOpen) {
          setSearchQuery("")
          setHighlightedIndex(-1)
        }
      },
      [disabled],
    )

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent) => {
        if (!open) return

        switch (e.key) {
          case "ArrowDown": {
            e.preventDefault()
            setHighlightedIndex((prev) => {
              const next = prev + 1
              return next >= selectableOptions.length ? 0 : next
            })
            break
          }
          case "ArrowUp": {
            e.preventDefault()
            setHighlightedIndex((prev) => {
              const next = prev - 1
              return next < 0 ? selectableOptions.length - 1 : next
            })
            break
          }
          case "Enter": {
            e.preventDefault()
            const target = selectableOptions[highlightedIndex]
            if (target) {
              handleSelect(target.value)
            }
            break
          }
          case "Escape": {
            e.preventDefault()
            setOpen(false)
            setSearchQuery("")
            setHighlightedIndex(-1)
            break
          }
          case "Home": {
            e.preventDefault()
            setHighlightedIndex(0)
            break
          }
          case "End": {
            e.preventDefault()
            setHighlightedIndex(selectableOptions.length - 1)
            break
          }
        }
      },
      [open, selectableOptions, highlightedIndex, handleSelect],
    )

    React.useEffect(() => {
      if (!open) return
      const highlighted = listRef.current?.querySelector("[data-highlighted]")
      highlighted?.scrollIntoView({ block: "nearest" })
    }, [highlightedIndex, open])

    return (
      <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <div className="relative" ref={ref}>
          {name && <input type="hidden" name={name} value={selectedValue} />}
          <PopoverPrimitive.Trigger asChild>
            <button
              id={id}
              type="button"
              role="combobox"
              title={title}
              aria-label={ariaLabel}
              aria-describedby={ariaDescribedBy}
              aria-required={required ? "true" : undefined}
              aria-expanded={open}
              disabled={disabled}
              className={cn(
                "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                className,
              )}
            >
              <span
                className={cn(
                  "min-w-0 flex-1 text-left truncate",
                  !selectedOption && "text-muted-foreground",
                )}
              >
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              <ChevronUpDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={4}
              className="z-[10000] w-[var(--radix-popover-trigger-width)] max-h-60 overflow-auto overscroll-contain rounded-md border border-input bg-popover py-1 text-sm shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
              onKeyDown={handleKeyDown}
              onOpenAutoFocus={(e) => {
                if (searchable) {
                  e.preventDefault()
                  searchRef.current?.focus()
                }
              }}
            >
              {searchable && (
                <div className="sticky top-0 z-10 bg-popover px-2 py-1.5 border-b border-input mb-1">
                  <input
                    ref={searchRef}
                    type="text"
                    autoFocus
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder={searchPlaceholder || "Search..."}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setHighlightedIndex(0)
                    }}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              )}
              <div ref={listRef} role="listbox">
                {filteredOptions.length === 0 ? (
                  <div className="py-2 px-4 text-xs text-muted-foreground text-center">
                    No options found
                  </div>
                ) : (
                  filteredOptions.map((option) => {
                    if (option.isGroupLabel) {
                      return (
                        <div
                          key={option.value}
                          className="cursor-default select-none py-2 pl-3 pr-3 text-xs uppercase tracking-wide text-muted-foreground font-semibold"
                        >
                          {option.label}
                        </div>
                      )
                    }

                    const isSelected = option.value === selectedValue
                    const selectableIdx = selectableOptions.indexOf(option)
                    const isHighlighted = selectableIdx === highlightedIndex

                    return (
                      <div
                        key={option.value}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={option.disabled}
                        data-highlighted={isHighlighted ? "" : undefined}
                        className={cn(
                          "relative cursor-default select-none py-2 pl-8 pr-4",
                          isHighlighted && "bg-accent text-accent-foreground",
                          option.disabled && "opacity-50 pointer-events-none",
                        )}
                        onPointerMove={() => {
                          if (selectableIdx !== highlightedIndex) {
                            setHighlightedIndex(selectableIdx)
                          }
                        }}
                        onClick={() => {
                          if (!option.disabled) {
                            handleSelect(option.value)
                          }
                        }}
                      >
                        <span
                          className={cn(
                            "block truncate break-words",
                            isSelected ? "font-medium" : "font-normal",
                          )}
                        >
                          {option.label}
                        </span>
                        {isSelected && (
                          <span className="absolute inset-y-0 left-2 flex items-center text-accent-foreground">
                            <CheckIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </div>
      </PopoverPrimitive.Root>
    )
  },
)
Select.displayName = "Select"

export { Select }
