"use client";

import React, { useCallback, useMemo, useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  ReactFlowProvider,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import StepNode from "./StepNode";
import { WorkflowStep } from "@/types/workflow";
import { FiPlus, FiMaximize2 } from "react-icons/fi";

const nodeTypes = {
  workflowStep: StepNode,
};

interface WorkflowFlowchartProps {
  steps: WorkflowStep[];
  onStepClick: (index: number) => void;
  onAddStep: () => void;
  onStepsReorder: (newSteps: WorkflowStep[]) => void;
  activeStepIndex?: number | null;
  onTriggerClick?: () => void;
}

const NODE_SPACING = 320;
const START_NODE_X = 140;
const NODE_Y = 210;

const getBasePosition = (index: number) => START_NODE_X + index * NODE_SPACING;

const getStepWarnings = (step: WorkflowStep, index: number): string[] => {
  const warnings: string[] = [];

  const isWebhookStep = Boolean(
    (step.webhook_url && step.webhook_url.trim()) || step.step_type === "webhook",
  );
  const isHandoffStep = Boolean(
    step.handoff_workflow_id && step.handoff_workflow_id.trim(),
  );
  const isAiStep = !isWebhookStep && !isHandoffStep;

  if (!step.step_name.trim()) {
    warnings.push(`Step ${index + 1} is missing a name.`);
  }
  if (isAiStep && !step.instructions.trim()) {
    warnings.push(`Add synthesis instructions so the model knows what to do.`);
  }
  if (
    (step.tools || []).some((tool) => {
      return typeof tool === "string" && tool === "image_generation";
    })
  ) {
    if (step.tool_choice !== "required") {
      warnings.push(
        'Image generation works best when tool choice is set to "required".',
      );
    }
  }
  return warnings;
};

type DragState = {
  nodeId: string | null;
  targetIndex: number | null;
};

function FlowchartContent({
  steps,
  onStepClick,
  onAddStep,
  onStepsReorder,
  activeStepIndex,
  onTriggerClick,
}: WorkflowFlowchartProps) {
  const { fitView } = useReactFlow();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    nodeId: null,
    targetIndex: null,
  });
  const [nodesState, setNodesState] = useState<Node[]>([]);
  const [edgesState, setEdgesState] = useState<Edge[]>([]);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setHasMounted(true), 75);
    return () => window.clearTimeout(timeout);
  }, []);

  const highlightIndices = useMemo(() => {
    const indices = new Set<number>();
    if (typeof activeStepIndex === "number") indices.add(activeStepIndex);
    if (typeof hoveredIndex === "number") indices.add(hoveredIndex);
    if (typeof dragState.targetIndex === "number")
      indices.add(dragState.targetIndex);
    return indices;
  }, [activeStepIndex, hoveredIndex, dragState.targetIndex]);

  const nodes = useMemo<Node[]>(() => {
    const workflowNodes: Node[] = [];

    workflowNodes.push({
      id: "start",
      type: "default",
      position: { x: START_NODE_X - NODE_SPACING * 0.7, y: NODE_Y },
      data: {
        label: (
          <div 
            onClick={() => onTriggerClick?.()}
            className="flex h-20 w-24 flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-border bg-white/80 dark:bg-card/80 text-xs font-semibold text-slate-500 dark:text-muted-foreground shadow-sm backdrop-blur cursor-pointer hover:border-primary-500 hover:text-primary-600 transition-colors"
          >
            Start
          </div>
        ),
      },
      selectable: false,
      draggable: false,
      style: { border: "none", background: "transparent" },
    });

    steps.forEach((step, index) => {
      const nodeId = `step-${index}`;
      workflowNodes.push({
        id: nodeId,
        type: "workflowStep",
        position: { x: getBasePosition(index), y: NODE_Y },
        data: {
          step,
          index,
          onClick: () => onStepClick(index),
          onHover: (isHovering: boolean) =>
            setHoveredIndex(isHovering ? index : null),
          isActive: activeStepIndex === index,
          isHovered: hoveredIndex === index,
          isDropTarget:
            dragState.nodeId &&
            dragState.nodeId !== nodeId &&
            dragState.targetIndex === index,
          isDragging: dragState.nodeId === nodeId,
          warnings: getStepWarnings(step, index),
          animateIn: hasMounted,
          // subSteps: step.subSteps // If we had this data
        },
        draggable: true,
        dragHandle: ".flow-node-drag-handle",
        style: { border: "none", background: "transparent" },
      });
    });

    workflowNodes.push({
      id: "end",
      type: "default",
      position: { x: getBasePosition(steps.length), y: NODE_Y },
      data: {
        label: (
          <div className="flex h-20 w-24 flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-border bg-white/80 dark:bg-card/80 text-xs font-semibold text-slate-500 dark:text-muted-foreground shadow-sm backdrop-blur">
            End
          </div>
        ),
      },
      selectable: false,
      draggable: false,
      style: { border: "none", background: "transparent" },
    });

    return workflowNodes;
  }, [
    steps,
    onStepClick,
    onTriggerClick,
    activeStepIndex,
    hoveredIndex,
    dragState.nodeId,
    dragState.targetIndex,
    hasMounted,
  ]);

  const edges = useMemo<Edge[]>(() => {
    const workflowEdges: Edge[] = [];
    const makeEdge = (
      id: string,
      source: string,
      target: string,
      targetIndex?: number,
    ) => {
      const isHighlighted =
        typeof targetIndex === "number" && highlightIndices.has(targetIndex);
      const color = isHighlighted ? "#2563eb" : "#CBD5F5";
      workflowEdges.push({
        id,
        source,
        target,
        type: "smoothstep",
        animated: isHighlighted,
        style: {
          stroke: color,
          strokeWidth: isHighlighted ? 3 : 2,
          transition: "stroke 150ms ease, stroke-width 150ms ease",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 18,
          height: 18,
        },
      });
    };

    if (steps.length > 0) {
      makeEdge("start-step-0", "start", "step-0", 0);
    }

    for (let i = 0; i < steps.length - 1; i++) {
      makeEdge(`step-${i}-step-${i + 1}`, `step-${i}`, `step-${i + 1}`, i + 1);
    }

    if (steps.length > 0) {
      makeEdge(
        `step-${steps.length - 1}-end`,
        `step-${steps.length - 1}`,
        "end",
        steps.length - 1,
      );
    }

    return workflowEdges;
  }, [steps, highlightIndices]);

  useEffect(() => {
    setNodesState(nodes);
  }, [nodes]);

  useEffect(() => {
    setEdgesState(edges);
  }, [edges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodesState((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdgesState((current) => applyEdgeChanges(changes, current));
  }, []);

  const onConnect = useCallback((params: Connection) => {
    setEdgesState((current) => addEdge(params, current));
  }, []);

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!node.id.startsWith("step-")) return;
      const stepIndex = parseInt(node.id.replace("step-", ""), 10);
      if (Number.isNaN(stepIndex)) return;

      const newOrder = Math.round(
        (node.position.x - START_NODE_X) / NODE_SPACING,
      );
      const clampedOrder = Math.max(0, Math.min(steps.length - 1, newOrder));
      setDragState({ nodeId: node.id, targetIndex: clampedOrder });
    },
    [steps.length],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!node.id.startsWith("step-")) {
        setDragState({ nodeId: null, targetIndex: null });
        return;
      }

      const stepIndex = parseInt(node.id.replace("step-", ""), 10);
      if (
        Number.isNaN(stepIndex) ||
        stepIndex < 0 ||
        stepIndex >= steps.length
      ) {
        setDragState({ nodeId: null, targetIndex: null });
        return;
      }

      const newOrder = Math.round(
        (node.position.x - START_NODE_X) / NODE_SPACING,
      );
      const clampedOrder = Math.max(0, Math.min(steps.length - 1, newOrder));

      if (clampedOrder !== stepIndex) {
        const newSteps = [...steps];
        const [movedStep] = newSteps.splice(stepIndex, 1);
        newSteps.splice(clampedOrder, 0, movedStep);
        onStepsReorder(newSteps);
      }

      setNodesState((current) =>
        current.map((n) =>
          n.id === node.id
            ? {
                ...n,
                position: { x: getBasePosition(clampedOrder), y: NODE_Y },
              }
            : n,
        ),
      );
      setDragState({ nodeId: null, targetIndex: null });
    },
    [steps, onStepsReorder],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fitView({ padding: 0.3, duration: 350 });
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [steps.length, fitView]);

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-3xl border border-slate-200 dark:border-border bg-gradient-to-br from-slate-50 dark:from-secondary/30 via-white dark:via-card to-primary-50/20 dark:to-primary/10 shadow-inner shadow-white/70 dark:shadow-black/20">
      <ReactFlow
        nodes={nodesState}
        edges={edgesState}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        panOnScroll
        panOnDrag={[1, 2]}
        zoomOnScroll
        zoomOnPinch
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        minZoom={0.35}
        maxZoom={1.5}
        snapToGrid
        snapGrid={[20, 20]}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          animated: false,
          style: { stroke: "#CBD5F5", strokeWidth: 2 },
        }}
        className="workflow-flow-canvas"
      >
        <Background color="#dbeafe" gap={30} size={1} className="dark:opacity-20" />
        <Controls
          showInteractive={false}
          className="rounded-full border border-slate-200 dark:border-border bg-white/90 dark:bg-card/90 shadow-sm backdrop-blur"
        />
        <MiniMap
          className="rounded-xl border border-slate-200 dark:border-border bg-white/90 dark:bg-card/90 shadow-sm"
          pannable
          zoomable
          nodeColor={(node) => {
            if (node.id.startsWith("step-")) {
              const index = parseInt(node.id.replace("step-", ""), 10);
              return highlightIndices.has(index) ? "#2563eb" : "#cbd5f5";
            }
            return "#e2e8f0";
          }}
          maskColor="rgba(15, 23, 42, 0.08)"
        />
      </ReactFlow>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.06),transparent_55%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/95 dark:from-card/95 via-white/60 dark:via-card/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/95 dark:from-card/95 via-white/60 dark:via-card/60 to-transparent" />

      <div className="pointer-events-auto absolute left-3 sm:left-6 top-3 sm:top-6 z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <button
          onClick={onAddStep}
          className="flex items-center justify-center gap-2 rounded-full bg-primary-600 px-3 sm:px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-300/60 transition hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/80 touch-target"
        >
          <FiPlus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Add Step</span>
          <span className="sm:hidden">Add</span>
        </button>
        <button
          onClick={() => fitView({ padding: 0.25, duration: 300 })}
          className="flex items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-border bg-white/90 dark:bg-card/90 px-3 sm:px-4 py-2 text-sm text-slate-600 dark:text-foreground shadow-sm transition hover:border-primary-200 dark:hover:border-primary hover:text-primary-600 dark:hover:text-primary touch-target"
          title="Fit view"
        >
          <FiMaximize2 className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Fit View</span>
          <span className="sm:hidden">Fit</span>
        </button>
      </div>

      {dragState.nodeId && dragState.targetIndex !== null && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div
            className="absolute top-14 bottom-14 w-[2px] rounded-full bg-primary-400/60 shadow-[0_0_12px_rgba(37,99,235,0.45)] transition-all duration-100"
            style={{ left: `${getBasePosition(dragState.targetIndex)}px` }}
          />
        </div>
      )}

      {steps.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-2xl border border-dashed border-primary-200 dark:border-primary/30 bg-white/90 dark:bg-card/90 px-10 py-12 text-center shadow-lg shadow-primary-100/50 dark:shadow-primary/20 backdrop-blur">
            <p className="text-base font-semibold text-slate-700 dark:text-foreground">
              No steps yet
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-muted-foreground">
              Add a step, then click it to edit in the side panel.
            </p>
            <button
              onClick={onAddStep}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary-300/50 transition hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/80 touch-target"
            >
              <FiPlus className="h-4 w-4" aria-hidden />
              Add your first step
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowFlowchart(props: WorkflowFlowchartProps) {
  return (
    <div className="relative w-full rounded-3xl">
      <ReactFlowProvider>
        <FlowchartContent {...props} />
      </ReactFlowProvider>
    </div>
  );
}
