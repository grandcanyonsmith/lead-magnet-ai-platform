import { useState, useEffect } from 'react'
import { WorkflowStep } from '@/features/workflows/types'

interface ComputerUseConfig {
  display_width: number
  display_height: number
  environment: 'browser' | 'mac' | 'windows' | 'ubuntu'
}

interface UseToolManagementProps {
  step: WorkflowStep
  onChange: (field: keyof WorkflowStep, value: any) => void
}

export function useToolManagement({ step, onChange }: UseToolManagementProps) {
  const [computerUseConfig, setComputerUseConfig] = useState<ComputerUseConfig>({
    display_width: 1024,
    display_height: 768,
    environment: 'browser',
  })

  // Sync computer use config from step
  useEffect(() => {
    const computerUseTool = (step.tools || []).find(
      (t) => (typeof t === 'object' && t.type === 'computer_use_preview') || t === 'computer_use_preview'
    )
    if (computerUseTool && typeof computerUseTool === 'object') {
      setComputerUseConfig({
        display_width: computerUseTool.display_width || 1024,
        display_height: computerUseTool.display_height || 768,
        environment: computerUseTool.environment || 'browser',
      })
    }
  }, [step])

  const isToolSelected = (toolValue: string): boolean => {
    const currentTools = step.tools || []
    return currentTools.some(t => {
      if (typeof t === 'string') return t === toolValue
      return t.type === toolValue
    })
  }

  const handleToolToggle = (toolValue: string) => {
    const currentTools = step.tools || []
    const isSelected = isToolSelected(toolValue)
    
    let updatedTools: (string | { type: string; [key: string]: any })[]
    
    if (isSelected) {
      // Remove tool
      updatedTools = currentTools.filter(t => {
        if (typeof t === 'string') return t !== toolValue
        return t.type !== toolValue
      })
    } else {
      // Add tool
      if (toolValue === 'computer_use_preview') {
        // Add as object with config
        updatedTools = [...currentTools, {
          type: 'computer_use_preview',
          display_width: computerUseConfig.display_width,
          display_height: computerUseConfig.display_height,
          environment: computerUseConfig.environment,
        }]
      } else {
        // Add as string
        updatedTools = [...currentTools, toolValue]
      }
    }
    
    onChange('tools', updatedTools)
  }

  const handleComputerUseConfigChange = (field: 'display_width' | 'display_height' | 'environment', value: number | string) => {
    const newConfig = { ...computerUseConfig, [field]: value }
    setComputerUseConfig(newConfig)
    
    // Update the tool object in tools array
    const currentTools = step.tools || []
    const updatedTools = currentTools.map(t => {
      if (typeof t === 'object' && t.type === 'computer_use_preview') {
        return {
          ...t,
          display_width: newConfig.display_width,
          display_height: newConfig.display_height,
          environment: newConfig.environment,
        }
      }
      return t
    })
    
    // If computer_use_preview is selected but not in tools array, add it
    if (isToolSelected('computer_use_preview') && !updatedTools.some(t => typeof t === 'object' && t.type === 'computer_use_preview')) {
      updatedTools.push({
        type: 'computer_use_preview',
        display_width: newConfig.display_width,
        display_height: newConfig.display_height,
        environment: newConfig.environment,
      })
    }
    
    onChange('tools', updatedTools)
  }

  return {
    computerUseConfig,
    isToolSelected,
    handleToolToggle,
    handleComputerUseConfigChange,
  }
}

