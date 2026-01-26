# Recursive UI Patterns

This project uses a recursive architecture for rendering job steps and blocks. This guide explains the core components and patterns.

## Core Components

### `RecursiveBlock`
`frontend/src/components/ui/recursive/RecursiveBlock.tsx`

The fundamental building block for recursive UIs. It renders a node and its children recursively.

**Props:**
- `node`: The `BlockNode` data structure.
- `renderHeader`: Function to render the header content.
- `renderContent`: Function to render the expanded content.
- `renderBody`: Function to render content that is always visible (below header).

**Features:**
- Handles expansion state (controlled or uncontrolled).
- Renders indentation for children.
- Supports custom styling via `className`.

### `RecursiveStep`
`frontend/src/components/jobs/RecursiveStep.tsx`

Adapts `RecursiveBlock` for rendering job steps. It converts the `MergedStep` tree into a `BlockNode` tree and provides step-specific rendering logic.

**Key Pattern:**
It uses `useMemo` to transform the step data into a `BlockNode` tree, ensuring that `RecursiveBlock` handles the recursion automatically.

```tsx
const blockNode = useMemo(() => 
  createBlockNode(step, getStepStatus, rootId, isExpanded),
  [step, getStepStatus, rootId, isExpanded]
);
```

## Reusable Primitives

### `CollapsiblePanel`
`frontend/src/components/ui/panels/CollapsiblePanel.tsx`

A standard panel with a header that toggles visibility of its content. Used for step metadata panels.

### `Badge`
`frontend/src/components/ui/badges/Badge.tsx`

A unified badge component for status, counts, and toggles. Used in `StepMetaBadges`.

### `CopyButton`
`frontend/src/components/ui/buttons/CopyButton.tsx`

Standard copy-to-clipboard button with feedback state.

## Best Practices

1. **Use `RecursiveBlock` for trees**: If you have nested data, convert it to `BlockNode` format and let `RecursiveBlock` handle the rendering loop.
2. **Separate Data from UI**: Keep your data transformation logic (e.g., `createBlockNode`) separate from your rendering components.
3. **Controlled vs Uncontrolled**: `RecursiveBlock` supports both. Use controlled state for the root node if external control is needed (e.g., "Expand All"), and uncontrolled for children.
4. **Composition**: Pass render props (`renderHeader`, `renderContent`) to customize the look of nodes without changing the recursive structure.
