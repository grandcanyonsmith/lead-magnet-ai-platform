"use client"

import * as React from "react"
import { Tab } from "@headlessui/react"
import { cn } from "@/lib/utils"

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Tab.List>
>(({ className, ...props }, ref) => (
  <Tab.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value: _value, ...props }, ref) => (
  <Tab
    ref={ref}
    as="button"
    className={({ selected }) =>
      cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "bg-background text-foreground shadow-sm"
          : "hover:bg-background/50 hover:text-foreground",
        className
      )
    }
    {...props}
  />
))
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value: _value, children, ...props }, ref) => (
  <Tab.Panel
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  >
    {children}
  </Tab.Panel>
))
TabsContent.displayName = "TabsContent"

const isTabsContent = (child: React.ReactNode): child is React.ReactElement<{ value: string }> => {
  return Boolean(
    React.isValidElement(child) &&
      ((child.type as typeof TabsContent) === TabsContent ||
        (child.type as { displayName?: string })?.displayName === "TabsContent")
  )
}

const Tabs = React.forwardRef<
  HTMLDivElement,
  { defaultValue?: string; value?: string; onValueChange?: (value: string) => void; children: React.ReactNode; className?: string }
>(({ defaultValue, value, onValueChange, children, className }, ref) => {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState(defaultValue)

  React.useEffect(() => {
    if (!isControlled) {
      setInternalValue(defaultValue)
    }
  }, [defaultValue, isControlled])

  const currentValue = isControlled ? value : internalValue

  const childArray = React.Children.toArray(children)
  const panels = childArray.filter(isTabsContent)
  const nonPanels = childArray.filter((child) => !isTabsContent(child))
  const values = panels
    .map((panel) => panel.props.value)
    .filter((val): val is string => typeof val === "string")

  const selectedIndex = Math.max(0, values.indexOf(currentValue ?? values[0]))

  const handleValueChange = (index: number) => {
    const nextValue = values[index]
    if (!nextValue) return
    if (!isControlled) {
      setInternalValue(nextValue)
    }
    onValueChange?.(nextValue)
  }

  return (
    <Tab.Group selectedIndex={selectedIndex} onChange={handleValueChange}>
      <div ref={ref} className={cn("", className)}>
        {nonPanels}
        <Tab.Panels>{panels}</Tab.Panels>
      </div>
    </Tab.Group>
  )
})
Tabs.displayName = "Tabs"

export { Tabs, TabsList, TabsTrigger, TabsContent }

