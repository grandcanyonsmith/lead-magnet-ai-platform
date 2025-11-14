'use client'

import { useEffect, useState, useRef } from 'react'
import { FiX } from 'react-icons/fi'
import WorkflowStepEditor from './WorkflowStepEditor'
import { WorkflowStep } from '@/types/workflow'

interface FlowchartSidePanelProps {
  step: WorkflowStep | null
  index: number | null
  totalSteps: number
  allSteps?: WorkflowStep[] // All steps for dependency selection
  isOpen: boolean
  onClose: () => void
  onChange: (index: number, step: WorkflowStep) => void
  onDelete: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  workflowId?: string // Required for AI features
}

export default function FlowchartSidePanel({
  step,
  index,
  totalSteps,
  allSteps = [],
  isOpen,
  onClose,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  workflowId,
}: FlowchartSidePanelProps) {
  const [localStep, setLocalStep] = useState<WorkflowStep | null>(step)
  const latestStepRef = useRef<WorkflowStep | null>(step)

  useEffect(() => {
    setLocalStep(step)
    latestStepRef.current = step
  }, [step])

  if (!isOpen || !step || index === null) {
    return null
  }

  const handleChange = (idx: number, updatedStep: WorkflowStep) => {
    setLocalStep(updatedStep)
    latestStepRef.current = updatedStep
    onChange(idx, updatedStep)
  }

  const handleClose = () => {
    // Ensure any pending changes are saved before closing
    // Use ref to get the latest state, as localStep might be stale
    const latestStep = latestStepRef.current
    if (latestStep && index !== null) {
      onChange(index, latestStep)
    }
    onClose()
  }

  const handleDelete = () => {
    if (index !== null) {
      onDelete(index)
      onClose()
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={handleClose} />

      {/* Side Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } overflow-y-auto`}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-r from-white via-white to-slate-50/60 px-6 py-5 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Step {index + 1} of {totalSteps}</div>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">{step.step_name || `Step ${index + 1}`}</h2>
              <p className="mt-1 text-sm text-slate-500">{step.step_description || 'Configure what this step should accomplish.'}</p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
              aria-label="Close panel"
            >
              <FiX className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] font-medium text-slate-500 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Model</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">
                {step.model === 'computer-use-preview' ? 'Computer Use Preview' : step.model.replace('gpt-', 'GPT-').replace('turbo', 'Turbo')}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tools</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">
                {step.tools?.length ? `${step.tools.length} enabled` : 'None'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tool Choice</div>
              <div className="mt-1 text-sm font-semibold text-slate-700 capitalize">
                {step.tool_choice ? step.tool_choice : 'Auto'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Instructions</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">
                {step.instructions?.trim() ? `${step.instructions.trim().split(/\s+/).length} words` : 'Not set'}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 bg-gradient-to-b from-white via-white to-slate-50 px-6 py-6">
          {localStep && (
            <WorkflowStepEditor
              step={localStep}
              index={index}
              totalSteps={totalSteps}
              allSteps={allSteps}
              onChange={handleChange}
              onDelete={handleDelete}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              workflowId={workflowId}
            />
          )}
        </div>
      </div>
    </>
  )
}

