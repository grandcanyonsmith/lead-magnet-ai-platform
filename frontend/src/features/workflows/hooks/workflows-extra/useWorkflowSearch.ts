import { useMemo, useState } from 'react'
import { Workflow } from '@/shared/types'

export function useWorkflowSearch(workflows: Workflow[]) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((workflow) => {
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      const name = (workflow.workflow_name || '').toLowerCase()
      const description = (workflow.workflow_description || '').toLowerCase()
      const formName = (workflow.form?.form_name || '').toLowerCase()
      return name.includes(query) || description.includes(query) || formName.includes(query)
    })
  }, [workflows, searchQuery])

  return {
    searchQuery,
    setSearchQuery,
    filteredWorkflows,
  }
}

