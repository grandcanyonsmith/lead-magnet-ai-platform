'use client'

import React, { useCallback, useMemo, useEffect, useState } from 'react'
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
} from 'reactflow'
import 'reactflow/dist/style.css'
import FlowchartNode from './FlowchartNode'
import { WorkflowStep } from './WorkflowStepEditor'
import { FiPlus, FiMaximize2 } from 'react-icons/fi'

const nodeTypes = {
  workflowStep: FlowchartNode,
}

interface WorkflowFlowchartProps {
  steps: WorkflowStep[]
  onStepClick: (index: number) => void
  onAddStep: () => void
  onStepsReorder: (newSteps: WorkflowStep[]) => void
}

const NODE_WIDTH = 250
const NODE_SPACING = 300
const START_NODE_X = 100
const NODE_Y = 200

function FitViewButton() {
  const { fitView } = useReactFlow()

  return (
    <button
      onClick={() => fitView({ padding: 0.2, duration: 300 })}
      className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm text-gray-700"
      title="Fit view"
    >
      <FiMaximize2 className="w-4 h-4" />
      Fit View
    </button>
  )
}

function FlowchartContent({
  steps,
  onStepClick,
  onAddStep,
  onStepsReorder,
}: WorkflowFlowchartProps) {
  const { fitView } = useReactFlow()

  // Create nodes from steps
  const nodes = useMemo<Node[]>(() => {
    const workflowNodes: Node[] = []

    // Start node
    workflowNodes.push({
      id: 'start',
      type: 'default',
      position: { x: START_NODE_X - 100, y: NODE_Y },
      data: {
        label: (
          <div className="text-center px-4 py-2">
            <div className="text-sm font-semibold text-gray-700">Start</div>
          </div>
        ),
      },
      style: {
        background: '#f3f4f6',
        border: '2px solid #9ca3af',
        borderRadius: '8px',
        minWidth: '80px',
      },
    })

    // Step nodes
    steps.forEach((step, index) => {
      const x = START_NODE_X + index * NODE_SPACING
      workflowNodes.push({
        id: `step-${index}`,
        type: 'workflowStep',
        position: { x, y: NODE_Y },
        data: {
          step,
          index,
          onClick: () => onStepClick(index),
        },
        draggable: true,
      })
    })

    // End node
    const endX = START_NODE_X + steps.length * NODE_SPACING
    workflowNodes.push({
      id: 'end',
      type: 'default',
      position: { x: endX, y: NODE_Y },
      data: {
        label: (
          <div className="text-center px-4 py-2">
            <div className="text-sm font-semibold text-gray-700">End</div>
          </div>
        ),
      },
      style: {
        background: '#f3f4f6',
        border: '2px solid #9ca3af',
        borderRadius: '8px',
        minWidth: '80px',
      },
    })

    return workflowNodes
  }, [steps, onStepClick])

  // Create edges between nodes
  const edges = useMemo<Edge[]>(() => {
    const workflowEdges: Edge[] = []

    // Edge from start to first step
    if (steps.length > 0) {
      workflowEdges.push({
        id: 'start-step-0',
        source: 'start',
        target: 'step-0',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
      })
    }

    // Edges between steps
    for (let i = 0; i < steps.length - 1; i++) {
      workflowEdges.push({
        id: `step-${i}-step-${i + 1}`,
        source: `step-${i}`,
        target: `step-${i + 1}`,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
      })
    }

    // Edge from last step to end
    if (steps.length > 0) {
      workflowEdges.push({
        id: `step-${steps.length - 1}-end`,
        source: `step-${steps.length - 1}`,
        target: 'end',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
      })
    }

    return workflowEdges
  }, [steps])

  const [nodesState, setNodesState] = useState<Node[]>(nodes)
  const [edgesState, setEdgesState] = useState<Edge[]>(edges)

  useEffect(() => {
    setNodesState(nodes)
  }, [nodes])

  useEffect(() => {
    setEdgesState(edges)
  }, [edges])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodesState((nds) => applyNodeChanges(changes, nds))
    },
    []
  )

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdgesState((eds) => applyEdgeChanges(changes, eds))
  }, [])

  const onConnect = useCallback((params: Connection) => {
    setEdgesState((eds) => addEdge(params, eds))
  }, [])

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!node.id.startsWith('step-')) return
      
      const stepIndex = parseInt(node.id.replace('step-', ''))
      if (stepIndex < 0 || stepIndex >= steps.length) return
      
      const newX = node.position.x
      const expectedX = START_NODE_X + stepIndex * NODE_SPACING
      const threshold = NODE_SPACING / 2
      
      // If moved significantly, reorder
      if (Math.abs(newX - expectedX) > threshold) {
        const newOrder = Math.round((newX - START_NODE_X) / NODE_SPACING)
        const clampedOrder = Math.max(0, Math.min(steps.length - 1, newOrder))
        
        if (clampedOrder !== stepIndex && clampedOrder >= 0 && clampedOrder < steps.length) {
          // Reorder steps
          const newSteps = [...steps]
          const [movedStep] = newSteps.splice(stepIndex, 1)
          newSteps.splice(clampedOrder, 0, movedStep)
          onStepsReorder(newSteps)
          return
        }
      }
      
      // Snap back to grid position
      const snappedNodes = nodesState.map((n) =>
        n.id === node.id
          ? { ...n, position: { x: START_NODE_X + stepIndex * NODE_SPACING, y: NODE_Y } }
          : n
      )
      setNodesState(snappedNodes)
    },
    [steps, onStepsReorder, nodesState]
  )

  // Fit view on mount and when steps change
  useEffect(() => {
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 })
    }, 100)
  }, [steps.length, fitView])

  return (
    <div className="w-full h-[600px] border border-gray-200 rounded-lg bg-gray-50 relative">
      <ReactFlow
        nodes={nodesState}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls className="bg-white border border-gray-300 rounded-lg shadow-sm" />
        <MiniMap
          nodeColor="#3b82f6"
          maskColor="rgba(0, 0, 0, 0.1)"
          className="bg-white border border-gray-300 rounded-lg"
        />
      </ReactFlow>

      {/* Toolbar */}
      <div className="absolute top-4 left-4 flex gap-2 z-10">
        <button
          onClick={onAddStep}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <FiPlus className="w-4 h-4" />
          Add Step
        </button>
        <FitViewButton />
      </div>

      {/* Empty State */}
      {steps.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">No workflow steps yet</p>
            <button
              onClick={onAddStep}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add Your First Step
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WorkflowFlowchart(props: WorkflowFlowchartProps) {
  return (
    <div className="w-full h-[600px] border border-gray-200 rounded-lg bg-gray-50 relative">
      <ReactFlowProvider>
        <FlowchartContent {...props} />
      </ReactFlowProvider>
    </div>
  )
}

