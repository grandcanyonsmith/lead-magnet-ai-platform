'use client'

import React, { createContext, useContext, ReactNode } from 'react'

interface JobFiltersContextValue {
  statusFilter: string
  workflowFilter: string
  setStatusFilter: (value: string) => void
  setWorkflowFilter: (value: string) => void
  workflows: any[]
}

const JobFiltersContext = createContext<JobFiltersContextValue | null>(null)

export function JobFiltersProvider({ 
  children,
  statusFilter,
  workflowFilter,
  setStatusFilter,
  setWorkflowFilter,
  workflows = []
}: {
  children: ReactNode
  statusFilter: string
  workflowFilter: string
  setStatusFilter: (value: string) => void
  setWorkflowFilter: (value: string) => void
  workflows?: any[]
}) {
  return (
    <JobFiltersContext.Provider value={{
      statusFilter,
      workflowFilter,
      setStatusFilter,
      setWorkflowFilter,
      workflows
    }}>
      {children}
    </JobFiltersContext.Provider>
  )
}

export function useJobFiltersContext() {
  const context = useContext(JobFiltersContext)
  return context
}

