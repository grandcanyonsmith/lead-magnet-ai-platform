'use client'

import { useEffect, useState } from 'react'
import { FiX } from 'react-icons/fi'
import WorkflowStepEditor, { WorkflowStep } from './WorkflowStepEditor'

interface FlowchartSidePanelProps {
  step: WorkflowStep | null
  index: number | null
  totalSteps: number
  isOpen: boolean
  onClose: () => void
  onChange: (index: number, step: WorkflowStep) => void
  onDelete: (index: number) => void
}

export default function FlowchartSidePanel({
  step,
  index,
  totalSteps,
  isOpen,
  onClose,
  onChange,
  onDelete,
}: FlowchartSidePanelProps) {
  const [localStep, setLocalStep] = useState<WorkflowStep | null>(step)

  useEffect(() => {
    setLocalStep(step)
  }, [step])

  if (!isOpen || !step || index === null) {
    return null
  }

  const handleChange = (idx: number, updatedStep: WorkflowStep) => {
    setLocalStep(updatedStep)
    onChange(idx, updatedStep)
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
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } overflow-y-auto`}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit Step {index + 1}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {localStep && (
            <WorkflowStepEditor
              step={localStep}
              index={index}
              totalSteps={totalSteps}
              onChange={handleChange}
              onDelete={handleDelete}
              onMoveUp={() => {}}
              onMoveDown={() => {}}
            />
          )}
        </div>
      </div>
    </>
  )
}

