/**
 * Step Header Component
 * Displays step header with status, name, metrics, and action buttons
 */

import { useState, useRef, useEffect } from 'react'
import { MergedStep, StepStatus } from '@/types/job'
import { formatDurationMs } from '@/utils/jobFormatting'
import { FiEdit, FiRefreshCw, FiLoader, FiCheckCircle, FiCircle, FiXCircle, FiMoreVertical, FiEye, FiDollarSign, FiClock } from 'react-icons/fi'
import { Tooltip } from '@/components/ui/Tooltip'
import { api } from '@/lib/api'

const STEP_TYPE_COLORS: Record<string, string> = {
  form_submission: 'bg-blue-100 text-blue-800',
  ai_generation: 'bg-purple-100 text-purple-800',
  html_generation: 'bg-green-100 text-green-800',
  final_output: 'bg-gray-100 text-gray-800',
  workflow_step: 'bg-gray-100 text-gray-800',
}

const DEFAULT_STEP_TYPE_COLOR = 'bg-gray-100 text-gray-800'

interface StepHeaderProps {
  step: MergedStep
  status: StepStatus
  jobStatus?: string
  canEdit?: boolean
  rerunningStep?: number | null
  onEditStep?: (stepIndex: number) => void
  onRerunStep?: (stepIndex: number) => Promise<void>
}

// Type for tool - can be a string or an object with a type property
type Tool = string | { type: string; [key: string]: unknown }

// Helper to get tool name from tool object or string
function getToolName(tool: Tool): string {
  return typeof tool === 'string' ? tool : (tool.type || 'unknown')
}

// Render status icon inline
function renderStatusIcon(status: StepStatus) {
  const iconClass = "w-5 h-5 flex-shrink-0"
  switch (status) {
    case 'completed':
      return <FiCheckCircle className={`${iconClass} text-green-600`} />
    case 'in_progress':
      return <FiLoader className={`${iconClass} text-yellow-500 animate-spin`} />
    case 'failed':
      return <FiXCircle className={`${iconClass} text-red-600`} />
    case 'pending':
    default:
      return <FiCircle className={`${iconClass} text-gray-400`} />
  }
}

// Render tool badges inline
function renderToolBadges(tools?: string[] | unknown[], toolChoice?: string) {
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return (
      <span className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded border border-gray-200">
        None
      </span>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {tools.map((tool, toolIdx) => {
          const toolName = getToolName(tool as Tool)
          return (
            <span
              key={toolIdx}
              className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 whitespace-nowrap"
            >
              {toolName}
            </span>
          )
        })}
      </div>
      {toolChoice && (
        <span className="text-gray-500">({toolChoice})</span>
      )}
    </>
  )
}

export function StepHeader({
  step,
  status,
  jobStatus,
  canEdit = false,
  rerunningStep,
  onEditStep,
  onRerunStep,
}: StepHeaderProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [artifactUrl, setArtifactUrl] = useState<string | null>(null)
  const [loadingArtifact, setLoadingArtifact] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const isPending = status === 'pending'
  const isCompleted = status === 'completed'
  const isInProgress = status === 'in_progress'
  
  const stepTypeColor = STEP_TYPE_COLORS[step.step_type] || DEFAULT_STEP_TYPE_COLOR

  // Fetch artifact URL when step has artifact_id
  useEffect(() => {
    const fetchArtifactUrl = async () => {
      if (step.artifact_id && !artifactUrl && !loadingArtifact) {
        try {
          setLoadingArtifact(true)
          const artifact = await api.getArtifact(step.artifact_id)
          const url = artifact.object_url || artifact.public_url
          if (url) {
            setArtifactUrl(url)
          }
        } catch (error) {
          console.error('Failed to fetch artifact:', error)
        } finally {
          setLoadingArtifact(false)
        }
      }
    }

    fetchArtifactUrl()
  }, [step.artifact_id, artifactUrl, loadingArtifact])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchstart', handleClickOutside)
      }
    }
  }, [showMenu])

  // Determine if menu should be shown
  const hasEdit = canEdit && onEditStep && step.step_order > 0
  const hasRerun = onRerunStep && step.step_order > 0 && step.step_type === 'ai_generation'
  const hasView = step.artifact_id
  const showMenuButton = hasEdit || hasRerun || hasView

  return (
    <div className="flex flex-col">
      {/* Top Bar: Status, Step Name, and Actions */}
      <div className={`flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2.5 border-b ${
        isPending 
          ? 'bg-gray-100/50 border-gray-200' 
          : isInProgress 
          ? 'bg-blue-100/50 border-blue-200' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        {/* Left: Status Icon and Step Name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Status Icon */}
          <div className="flex-shrink-0">
            {renderStatusIcon(status)}
          </div>
          
          {/* Step Name */}
          <h3 className={`text-sm sm:text-base font-semibold break-words flex-1 min-w-0 ${
            isPending ? 'text-gray-500' : 'text-gray-900'
          }`}>
            {step.step_name}
          </h3>
        </div>

        {/* Right: Action Menu - 3-dot dropdown */}
        {showMenuButton && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              onTouchStart={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors touch-target min-h-[44px] sm:min-h-0"
              aria-label="Step actions"
            >
              <FiMoreVertical className="w-4 h-4" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <div className="py-1">
                  {/* Edit Option - Always show if onEditStep is available and step_order > 0 */}
                  {hasEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        if (jobStatus === 'processing') {
                          return
                        }
                        const workflowStepIndex = step.step_order - 1
                        onEditStep?.(workflowStepIndex)
                        setShowMenu(false)
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation()
                      }}
                      disabled={jobStatus === 'processing'}
                      className={`w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target ${
                        jobStatus === 'processing' ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <FiEdit className="w-4 h-4 mr-2" />
                      Edit Step
                    </button>
                  )}
                  
                  {/* Rerun Option */}
                  {hasRerun && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        const stepIndex = step.step_order - 1
                        onRerunStep?.(stepIndex)
                        setShowMenu(false)
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation()
                      }}
                      disabled={rerunningStep === step.step_order - 1}
                      className={`w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target ${
                        rerunningStep === step.step_order - 1 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {rerunningStep === step.step_order - 1 ? (
                        <FiLoader className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FiRefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Rerun Step
                    </button>
                  )}
                  
                  {/* View Option */}
                  {step.artifact_id && (
                    <a
                      href={artifactUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!artifactUrl) {
                          e.preventDefault()
                        }
                        setShowMenu(false)
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation()
                      }}
                      className={`w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target ${
                        !artifactUrl ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <FiEye className="w-4 h-4 mr-2" />
                      View
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Badges Section: Step Badge, Metrics, and Processing Status */}
      <div className={`px-2.5 sm:px-3 py-2.5 ${
        isPending 
          ? 'bg-gray-50/30' 
          : isInProgress 
          ? 'bg-blue-50/30' 
          : 'bg-white'
      }`}>
        <div className="flex items-center flex-wrap gap-1.5">
          {/* Step Badge */}
          <span className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${stepTypeColor}`}>
            Step {step.step_order}
          </span>
          
          {/* Metrics - Only show for completed steps */}
          {isCompleted && (step.duration_ms !== undefined || step.usage_info) && (
            <>
              {step.duration_ms !== undefined && (
                <Tooltip
                  content={
                    <div className="text-left space-y-1">
                      {step.usage_info && (
                        <>
                          {step.usage_info.total_tokens && (
                            <div>Tokens: {step.usage_info.total_tokens.toLocaleString()}</div>
                          )}
                          {(!step.usage_info.total_tokens && (step.usage_info.prompt_tokens || step.usage_info.completion_tokens)) && (
                            <div>
                              Tokens: {((step.usage_info.prompt_tokens || 0) + (step.usage_info.completion_tokens || 0)).toLocaleString()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  }
                  position="top"
                >
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    <FiClock className="w-3 h-3" />
                    {formatDurationMs(step.duration_ms)}
                  </span>
                </Tooltip>
              )}
              {step.usage_info?.cost_usd && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-200">
                  <FiDollarSign className="w-3 h-3" />
                  {typeof step.usage_info.cost_usd === 'number' 
                    ? step.usage_info.cost_usd.toFixed(2) 
                    : parseFloat(step.usage_info.cost_usd || '0').toFixed(2)}
                </span>
              )}
            </>
          )}
          
          {/* Processing Status */}
          {isInProgress && (
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full animate-pulse">
              Processing...
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

