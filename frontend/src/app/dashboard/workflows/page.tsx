'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useSettings } from '@/hooks/api/useSettings'
import { buildPublicFormUrl } from '@/utils/url'
import { FiPlus, FiEdit, FiTrash2, FiEye, FiExternalLink, FiCopy, FiCheck, FiMoreVertical, FiLoader, FiCheckCircle, FiXCircle, FiClock, FiList, FiFileText, FiArrowLeft, FiFolder, FiFolderPlus, FiMove, FiX } from 'react-icons/fi'
import { Folder } from '@/types'
import toast from 'react-hot-toast'

export default function WorkflowsPage() {
  const router = useRouter()
  const [workflows, setWorkflows] = useState<any[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [workflowJobs, setWorkflowJobs] = useState<Record<string, any[]>>({})
  const [loadingJobs, setLoadingJobs] = useState<Record<string, boolean>>({})
  const [openingDocumentJobId, setOpeningDocumentJobId] = useState<string | null>(null)
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // Folder modal state
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [showMoveFolderModal, setShowMoveFolderModal] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [folderActionLoading, setFolderActionLoading] = useState(false)
  // Track which workflow IDs we've already loaded jobs for
  const loadedWorkflowIdsRef = useRef<Set<string>>(new Set())
  // Ref to track the latest workflows and workflowJobs for polling
  const workflowsRef = useRef<any[]>([])
  const workflowJobsRef = useRef<Record<string, any[]>>({})
  const loadJobsForWorkflowRef = useRef<((workflowId: string) => Promise<void>) | null>(null)
  // Track if we're currently processing a batch to prevent concurrent batches
  const isProcessingBatchRef = useRef<boolean>(false)
  // Track active polling cancellation to allow cleanup
  const pollingCancellationRef = useRef<(() => void) | null>(null)
  // Track active initial load cancellation to allow cleanup
  const initialLoadCancellationRef = useRef<(() => void) | null>(null)
  // Global request queue to ensure only one API request happens at a time
  const requestQueueRef = useRef<Promise<void>>(Promise.resolve())
  // Track active requests to prevent duplicates - use Map to store promises for deduplication
  const activeRequestsRef = useRef<Map<string, Promise<void>>>(new Map())
  const { settings } = useSettings()

  const openJobDocument = useCallback(
    async (jobId: string, fallbackUrl?: string) => {
      if (!jobId || openingDocumentJobId) return

      setOpeningDocumentJobId(jobId)
      let blobUrl: string | null = null

      try {
        blobUrl = await api.getJobDocumentBlobUrl(jobId)

        if (!blobUrl) {
          throw new Error('Failed to create blob URL')
        }

        const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer')

        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          toast.error('Popup blocked. Please allow popups for this site and try again.')
          URL.revokeObjectURL(blobUrl)
          return
        }

        setTimeout(() => {
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl)
          }
        }, 5000)
      } catch (error: unknown) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to open document:', error)
        }

        if (fallbackUrl) {
          window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
          toast.error('Could not open via secure viewer — opened direct link instead.')
        } else {
          toast.error('Failed to open document. Please try again.')
        }

        if (blobUrl) {
          URL.revokeObjectURL(blobUrl)
        }
      } finally {
        setOpeningDocumentJobId(null)
      }
    },
    [openingDocumentJobId]
  )

  const loadWorkflows = useCallback(async () => {
    try {
      // Get all workflows including drafts - don't filter by status
      const data = await api.getWorkflows()
      const workflowsList = data.workflows || []
      // Ensure we include all statuses: 'active', 'inactive', and 'draft'
      // No status filtering - show all workflows regardless of status
      // Sort by updated_at DESC (most recently updated first), fallback to created_at
      workflowsList.sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime()
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime()
        return dateB - dateA // DESC order
      })
      setWorkflows(workflowsList)
      // Reset loaded workflow IDs when workflows are reloaded
      loadedWorkflowIdsRef.current.clear()
      // Reset processed workflow IDs tracker so effect runs again
      lastProcessedWorkflowIdsRef.current = ''
    } catch (error) {
      console.error('Failed to load workflows:', error)
      toast.error('Failed to load lead magnets')
    } finally {
      setLoading(false)
    }
  }, [])

  // Define loadJobsForWorkflow before it's used in useEffect hooks
  const loadJobsForWorkflow = useCallback(async (workflowId: string) => {
    // Check if there's already an active request for this workflow
    const existingRequest = activeRequestsRef.current.get(workflowId)
    if (existingRequest) {
      // Return the existing promise to deduplicate
      return existingRequest
    }

    // Create a promise that will be queued after the previous request completes
    // This ensures global serialization - only one API request happens at a time
    const requestPromise = requestQueueRef.current.then(async () => {
      // Mark as loading in state
      setLoadingJobs((prev) => ({ ...prev, [workflowId]: true }))

      try {
        const data = await api.getJobs({ workflow_id: workflowId, limit: 5 })
        setWorkflowJobs((prev) => ({ ...prev, [workflowId]: data.jobs || [] }))
      } catch (error) {
        console.error(`Failed to load jobs for workflow ${workflowId}:`, error)
        setWorkflowJobs((prev) => ({ ...prev, [workflowId]: [] }))
        throw error
      } finally {
        // Remove from active requests and clear loading state
        activeRequestsRef.current.delete(workflowId)
        setLoadingJobs((prev) => ({ ...prev, [workflowId]: false }))
      }
    })

    // Update the queue to include this new request
    requestQueueRef.current = requestPromise.catch(() => {}) // Don't let errors break the queue

    // Store the promise IMMEDIATELY (atomic operation) - before any async work starts
    activeRequestsRef.current.set(workflowId, requestPromise)

    return requestPromise
  }, [])

  // Load folders
  const loadFolders = useCallback(async () => {
    try {
      const data = await api.getFolders()
      setFolders(data.folders || [])
    } catch (error) {
      console.error('Failed to load folders:', error)
      toast.error('Failed to load folders')
    }
  }, [])

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setFolderActionLoading(true)
    try {
      await api.createFolder({ folder_name: newFolderName.trim() })
      await loadFolders()
      setNewFolderName('')
      setShowCreateFolderModal(false)
      toast.success('Folder created')
    } catch (error: any) {
      console.error('Failed to create folder:', error)
      toast.error(error?.message || 'Failed to create folder')
    } finally {
      setFolderActionLoading(false)
    }
  }

  // Rename folder
  const handleRenameFolder = async (folderId: string) => {
    if (!editingFolderName.trim()) return
    setFolderActionLoading(true)
    try {
      await api.updateFolder(folderId, { folder_name: editingFolderName.trim() })
      await loadFolders()
      setEditingFolderId(null)
      setEditingFolderName('')
      toast.success('Folder renamed')
    } catch (error: any) {
      console.error('Failed to rename folder:', error)
      toast.error(error?.message || 'Failed to rename folder')
    } finally {
      setFolderActionLoading(false)
    }
  }

  // Delete folder
  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder? Lead magnets inside will be moved to the root.')) return
    setFolderActionLoading(true)
    try {
      await api.deleteFolder(folderId)
      await Promise.all([loadFolders(), loadWorkflows()])
      if (currentFolderId === folderId) {
        setCurrentFolderId(null)
      }
      toast.success('Folder deleted')
    } catch (error: any) {
      console.error('Failed to delete folder:', error)
      toast.error(error?.message || 'Failed to delete folder')
    } finally {
      setFolderActionLoading(false)
    }
  }

  // Move workflow to folder
  const handleMoveToFolder = async (workflowId: string, folderId: string | null) => {
    setFolderActionLoading(true)
    try {
      await api.moveWorkflowToFolder(workflowId, folderId)
      await loadWorkflows()
      setShowMoveFolderModal(null)
      toast.success('Moved')
    } catch (error: any) {
      console.error('Failed to move workflow:', error)
      toast.error(error?.message || 'Failed to move lead magnet')
    } finally {
      setFolderActionLoading(false)
    }
  }

  // Get current folder name
  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null
    return folders.find(f => f.folder_id === currentFolderId) || null
  }, [currentFolderId, folders])

  useEffect(() => {
    loadWorkflows()
    loadFolders()
  }, [loadFolders, loadWorkflows])

  // Create stable workflow IDs array to prevent unnecessary effect runs
  const workflowIds = useMemo(() => {
    return workflows.map(w => w.workflow_id).sort().join(',')
  }, [workflows])

  // Track the last workflowIds we processed to prevent duplicate processing
  const lastProcessedWorkflowIdsRef = useRef<string>('')

  // Load jobs for each workflow - only when workflow IDs actually change
  useEffect(() => {
    if (workflows.length === 0) return

    // Skip if we've already processed these workflow IDs
    if (lastProcessedWorkflowIdsRef.current === workflowIds) {
      return
    }

    // Cancel any previous initial load batch before starting a new one
    if (initialLoadCancellationRef.current) {
      initialLoadCancellationRef.current()
      initialLoadCancellationRef.current = null
    }

    // Atomic check-and-set: skip if already processing, otherwise mark as processing
    if (isProcessingBatchRef.current) {
      return
    }

    // Mark as processing IMMEDIATELY to prevent concurrent runs (atomic)
    // This must happen synchronously before any async work starts
    isProcessingBatchRef.current = true
    lastProcessedWorkflowIdsRef.current = workflowIds

    // Batch load jobs to prevent overwhelming the server
    // Process workflows in batches of 5 with a small delay between batches
    const workflowsToLoad = workflows.filter((workflow) => {
      const workflowId = workflow.workflow_id
      if (!loadedWorkflowIdsRef.current.has(workflowId)) {
        loadedWorkflowIdsRef.current.add(workflowId)
        return true
      }
      return false
    })

    if (workflowsToLoad.length === 0) {
      isProcessingBatchRef.current = false
      return
    }

    // Process in batches of 5
    const batchSize = 5
    let batchIndex = 0
    let cancelled = false
    const timeoutIds: NodeJS.Timeout[] = []

    // Create cleanup function and store it in ref so it can be called from outside
    const cleanupInitialLoad = () => {
      cancelled = true
      timeoutIds.forEach(id => clearTimeout(id))
      isProcessingBatchRef.current = false
      initialLoadCancellationRef.current = null
    }

    // Store cleanup function so it can be called when effect re-runs or unmounts
    initialLoadCancellationRef.current = cleanupInitialLoad

    const processBatch = async () => {
      if (cancelled) {
        return
      }

      const batch = workflowsToLoad.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize)

      // Process workflows sequentially within batch to prevent race conditions
      for (const workflow of batch) {
        if (cancelled) break
        await loadJobsForWorkflow(workflow.workflow_id)
        // Small delay between requests in the same batch
        if (!cancelled) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      if (cancelled) return

      batchIndex++
      if (batchIndex * batchSize < workflowsToLoad.length) {
        // Process next batch after a short delay
        const timeoutId = setTimeout(processBatch, 100)
        timeoutIds.push(timeoutId)
      } else {
        // All batches processed, clear the flag after a small delay to ensure all requests started
        const timeoutId = setTimeout(() => {
          if (!cancelled) {
            isProcessingBatchRef.current = false
            initialLoadCancellationRef.current = null
          }
        }, 200)
        timeoutIds.push(timeoutId)
      }
    }

    processBatch()

    // Cleanup function: cancel any pending batches and clear the flag
    return () => {
      cleanupInitialLoad()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowIds]) // Removed loadJobsForWorkflow - it's stable and we use ref

  // Keep refs updated with latest values
  useEffect(() => {
    workflowsRef.current = workflows
    workflowJobsRef.current = workflowJobs
    loadJobsForWorkflowRef.current = loadJobsForWorkflow
  }, [workflows, workflowJobs, loadJobsForWorkflow])

  // Track if we have processing jobs to avoid recreating interval unnecessarily
  const hasProcessingJobs = useMemo(() => {
    return Object.values(workflowJobs).some((jobs) =>
      jobs.some((job: any) => job.status === 'processing' || job.status === 'pending')
    )
  }, [workflowJobs])

  // Auto-refresh jobs for workflows that have processing jobs
  useEffect(() => {
    if (!hasProcessingJobs) {
      // Cancel any active polling when there are no processing jobs
      if (pollingCancellationRef.current) {
        pollingCancellationRef.current()
        pollingCancellationRef.current = null
      }
      return
    }

    const interval = setInterval(() => {
      // Use refs to get latest values without recreating interval
      const currentWorkflows = workflowsRef.current
      const currentWorkflowJobs = workflowJobsRef.current
      const currentLoadJobsForWorkflow = loadJobsForWorkflowRef.current

      if (!currentLoadJobsForWorkflow) return

      // Collect workflows that need polling
      const workflowsToPoll = currentWorkflows.filter((workflow) => {
        const jobs = currentWorkflowJobs[workflow.workflow_id] || []
        return jobs.some((job: any) => job.status === 'processing' || job.status === 'pending')
      })

      if (workflowsToPoll.length === 0) return

      // Cancel any previous polling cycle before starting a new one
      if (pollingCancellationRef.current) {
        pollingCancellationRef.current()
        pollingCancellationRef.current = null
      }

      // Atomic check-and-set: skip if already processing, otherwise mark as processing
      if (isProcessingBatchRef.current) {
        return
      }

      // Mark as processing IMMEDIATELY (atomic operation)
      // This must happen synchronously before any async work starts
      isProcessingBatchRef.current = true

      // Batch polling requests to prevent overwhelming the server
      const batchSize = 5
      let batchIndex = 0
      let cancelled = false
      const timeoutIds: NodeJS.Timeout[] = []

      // Create cleanup function and store it in ref so it can be called from outside
      const cleanupPolling = () => {
        cancelled = true
        timeoutIds.forEach(id => clearTimeout(id))
        isProcessingBatchRef.current = false
        pollingCancellationRef.current = null
      }

      // Store cleanup function so it can be called when effect re-runs or unmounts
      pollingCancellationRef.current = cleanupPolling

      const processPollBatch = async () => {
        if (cancelled) {
          return
        }

        const batch = workflowsToPoll.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize)

        // Process workflows sequentially within batch to prevent race conditions
        for (const workflow of batch) {
          if (cancelled) break
          await currentLoadJobsForWorkflow(workflow.workflow_id)
          // Small delay between requests in the same batch
          if (!cancelled) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }

        if (cancelled) return

        batchIndex++
        if (batchIndex * batchSize < workflowsToPoll.length) {
          // Process next batch after a short delay
          const timeoutId = setTimeout(processPollBatch, 100)
          timeoutIds.push(timeoutId)
        } else {
          // All batches processed, clear the flag
          const timeoutId = setTimeout(() => {
            if (!cancelled) {
              isProcessingBatchRef.current = false
              pollingCancellationRef.current = null
            }
          }, 200)
          timeoutIds.push(timeoutId)
        }
      }

      processPollBatch()
    }, 5000)

    return () => {
      clearInterval(interval)
      // Cancel any active polling batches
      if (pollingCancellationRef.current) {
        pollingCancellationRef.current()
        pollingCancellationRef.current = null
      }
      isProcessingBatchRef.current = false
    }
  }, [hasProcessingJobs]) // Only recreate interval when processing status changes

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (openMenuId) {
        const target = event.target as HTMLElement
        if (!target) {
          setOpenMenuId(null)
          return
        }
        
        // Check if click is on a menu item using data attribute (more reliable than refs)
        const menuItem = target.closest('[data-menu-item="true"]')
        const menuContainer = target.closest('[data-menu-id]')
        
        // If click is on a menu item or inside a menu container for the open menu, don't close
        if (menuItem || (menuContainer && menuContainer.getAttribute('data-menu-id') === openMenuId)) {
          return // Don't close menu - let the button's onClick handle it
        }
        
        // Also check refs for backward compatibility (mobile and desktop use different ref keys)
        const mobileMenuElement = menuRefs.current[`mobile-${openMenuId}`]
        const desktopMenuElement = menuRefs.current[openMenuId]
        const menuElement = mobileMenuElement || desktopMenuElement
        
        if (menuElement) {
          // Check if target is inside the menu element
          if (menuElement.contains(target)) {
            return
          }
        }
        
        // Click is outside menu - close it
        setOpenMenuId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [openMenuId])

  // loadWorkflows is defined above with useCallback

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead magnet? This will also delete its associated form.')) {
      return
    }

    try {
      await api.deleteWorkflow(id)
      await loadWorkflows()
      toast.success('Lead magnet deleted')
    } catch (error) {
      console.error('Failed to delete workflow:', error)
      toast.error('Failed to delete lead magnet')
    }
  }


  const publicUrlFor = (form: any) => {
    if (!form || !form.public_slug) return null
    return buildPublicFormUrl(form.public_slug, settings?.custom_domain)
  }

  const copyToClipboard = async (text: string, workflowId: string) => {
    if (!text) {
      console.error('No URL to copy')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopiedUrl(workflowId)
      setTimeout(() => setCopiedUrl(null), 2000)
      toast.success('Copied')
    } catch (error) {
      console.error('Failed to copy:', error)
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopiedUrl(workflowId)
        setTimeout(() => setCopiedUrl(null), 2000)
        toast.success('Copied')
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError)
        toast.error('Failed to copy URL')
      }
    }
  }

  const formatUrl = (url: string) => {
    if (url.length > 40) {
      return url.substring(0, 37) + '...'
    }
    return url
  }

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FiCheckCircle className="w-3 h-3 text-green-600" />
      case 'failed':
        return <FiXCircle className="w-3 h-3 text-red-600" />
      case 'processing':
        return <FiLoader className="w-3 h-3 text-blue-600 animate-spin" />
      default:
        return <FiClock className="w-3 h-3 text-yellow-600" />
    }
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  // Filter workflows based on search query and current folder
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((workflow) => {
      // Filter by folder
      const workflowFolderId = workflow.folder_id || null
      if (workflowFolderId !== currentFolderId) return false
      
      // Filter by search query
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      const name = (workflow.workflow_name || '').toLowerCase()
      const description = (workflow.workflow_description || '').toLowerCase()
      const formName = (workflow.form?.form_name || '').toLowerCase()
      return name.includes(query) || description.includes(query) || formName.includes(query)
    })
  }, [workflows, currentFolderId, searchQuery])

  // Workflows in root (no folder) for count
  const rootWorkflowCount = useMemo(() => {
    return workflows.filter(w => !w.folder_id).length
  }, [workflows])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => {
          if (currentFolderId) {
            setCurrentFolderId(null)
          } else {
            router.back()
          }
        }}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-4 py-2 touch-target"
      >
        <FiArrowLeft className="w-4 h-4 mr-2" />
        {currentFolderId ? 'Back to All Lead Magnets' : 'Back'}
      </button>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div className="mb-2 sm:mb-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
            {currentFolder ? currentFolder.folder_name : 'Lead Magnets'}
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {currentFolder ? `${filteredWorkflows.length} lead magnet${filteredWorkflows.length !== 1 ? 's' : ''} in this folder` : 'Manage your AI lead magnets and their forms'}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="flex items-center justify-center px-3 py-2 sm:py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm sm:text-base"
          >
            <FiFolderPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            <span className="hidden sm:inline">New Folder</span>
            <span className="sm:hidden">Folder</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/workflows/new')}
            className="flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm sm:text-base flex-1 sm:flex-none"
          >
            <FiPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Create Lead Magnet
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {workflows.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lead magnets by name, description, or form..."
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      )}

      {/* Folders Section - Only show when not inside a folder */}
      {!currentFolderId && folders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FiFolder className="w-4 h-4" />
            Folders
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {folders.map((folder) => (
              <div
                key={folder.folder_id}
                className="relative group"
              >
                {editingFolderId === folder.folder_id ? (
                  <div className="bg-white rounded-lg border-2 border-primary-500 p-3 shadow-sm">
                    <input
                      type="text"
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFolder(folder.folder_id)
                        if (e.key === 'Escape') {
                          setEditingFolderId(null)
                          setEditingFolderName('')
                        }
                      }}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      autoFocus
                      disabled={folderActionLoading}
                    />
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => handleRenameFolder(folder.folder_id)}
                        className="text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700 disabled:opacity-50"
                        disabled={folderActionLoading}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingFolderId(null)
                          setEditingFolderName('')
                        }}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                        disabled={folderActionLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setCurrentFolderId(folder.folder_id)}
                    className="w-full bg-white rounded-lg border border-gray-200 p-3 hover:border-primary-300 hover:shadow-md transition-all text-left group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FiFolder className="w-5 h-5 text-primary-600" />
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">{folder.folder_name}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {folder.workflow_count || 0} item{(folder.workflow_count || 0) !== 1 ? 's' : ''}
                    </span>
                  </button>
                )}
                {/* Folder actions dropdown */}
                {editingFolderId !== folder.folder_id && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingFolderId(folder.folder_id)
                          setEditingFolderName(folder.folder_name)
                        }}
                        className="p-1 bg-white rounded shadow text-gray-600 hover:text-primary-600"
                        title="Rename folder"
                      >
                        <FiEdit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteFolder(folder.folder_id)
                        }}
                        className="p-1 bg-white rounded shadow text-gray-600 hover:text-red-600"
                        title="Delete folder"
                      >
                        <FiTrash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create New Folder</h2>
              <button
                onClick={() => {
                  setShowCreateFolderModal(false)
                  setNewFolderName('')
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
                if (e.key === 'Escape') {
                  setShowCreateFolderModal(false)
                  setNewFolderName('')
                }
              }}
              placeholder="Folder name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
              autoFocus
              disabled={folderActionLoading}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateFolderModal(false)
                  setNewFolderName('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={folderActionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                disabled={!newFolderName.trim() || folderActionLoading}
              >
                {folderActionLoading ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Folder Modal */}
      {showMoveFolderModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Move to Folder</h2>
              <button
                onClick={() => setShowMoveFolderModal(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <button
                onClick={() => handleMoveToFolder(showMoveFolderModal, null)}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-3"
                disabled={folderActionLoading}
              >
                <FiFolder className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Root (No folder)</span>
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.folder_id}
                  onClick={() => handleMoveToFolder(showMoveFolderModal, folder.folder_id)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-3"
                  disabled={folderActionLoading}
                >
                  <FiFolder className="w-5 h-5 text-primary-600" />
                  <span className="text-sm font-medium text-gray-700">{folder.folder_name}</span>
                </button>
              ))}
            </div>
            {folderActionLoading && (
              <div className="flex justify-center mt-4">
                <FiLoader className="w-5 h-5 animate-spin text-primary-600" />
              </div>
            )}
          </div>
        </div>
      )}

      {filteredWorkflows.length === 0 && workflows.length > 0 ? (
        <div className="bg-white rounded-lg shadow p-6 sm:p-12 text-center">
          <p className="text-gray-600 mb-4 text-sm sm:text-base">No lead magnets match your search</p>
          <button
            onClick={() => setSearchQuery('')}
            className="inline-flex items-center px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm sm:text-base"
          >
            Clear search
          </button>
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 sm:p-12 text-center">
          <p className="text-gray-600 mb-4 text-sm sm:text-base">No lead magnets yet</p>
          <button
            onClick={() => router.push('/dashboard/workflows/new')}
            className="inline-flex items-center px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base"
          >
            <FiPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Create your first lead magnet
          </button>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {filteredWorkflows.map((workflow) => {
              const formUrl = workflow.form ? publicUrlFor(workflow.form) : null
              return (
                <div key={workflow.workflow_id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/dashboard/workflows/${workflow.workflow_id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/workflows/${workflow.workflow_id}`)
                        }}
                        className="text-base font-semibold text-primary-600 hover:text-primary-900 truncate block transition-colors"
                      >
                        {workflow.workflow_name}
                      </a>
                      {workflow.workflow_description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{workflow.workflow_description}</p>
                      )}
                    </div>
                    <div className="relative ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)
                        }}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all touch-target"
                        aria-label="Actions"
                      >
                        <FiMoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === workflow.workflow_id && (
                        <div
                          ref={(el) => { menuRefs.current[`mobile-${workflow.workflow_id}`] = el; }}
                          data-menu-id={workflow.workflow_id}
                          className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                        >
                          <div className="py-1">
                            <button
                              data-menu-item="true"
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                if (typeof window !== 'undefined') {
                                  window.location.href = `/dashboard/workflows/${workflow.workflow_id}`
                                } else {
                                  router.push(`/dashboard/workflows/${workflow.workflow_id}`)
                                }
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                if (typeof window !== 'undefined') {
                                  window.location.href = `/dashboard/workflows/${workflow.workflow_id}`
                                } else {
                                  router.push(`/dashboard/workflows/${workflow.workflow_id}`)
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                            >
                              <FiEye className="w-3 h-3 mr-2" />
                              View
                            </button>
                            <button
                              data-menu-item="true"
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                if (typeof window !== 'undefined') {
                                  window.location.href = `/dashboard/workflows/${workflow.workflow_id}/edit`
                                } else {
                                  router.push(`/dashboard/workflows/${workflow.workflow_id}/edit`)
                                }
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                if (typeof window !== 'undefined') {
                                  window.location.href = `/dashboard/workflows/${workflow.workflow_id}/edit`
                                } else {
                                  router.push(`/dashboard/workflows/${workflow.workflow_id}/edit`)
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                            >
                              <FiEdit className="w-3 h-3 mr-2" />
                              Edit
                            </button>
                            <button
                              data-menu-item="true"
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                handleDelete(workflow.workflow_id)
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                handleDelete(workflow.workflow_id)
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 active:bg-red-50 flex items-center touch-target"
                            >
                              <FiTrash2 className="w-3 h-3 mr-2" />
                              Delete
                            </button>
                            <button
                              data-menu-item="true"
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                setShowMoveFolderModal(workflow.workflow_id)
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setOpenMenuId(null)
                                setShowMoveFolderModal(workflow.workflow_id)
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target border-t border-gray-100"
                            >
                              <FiMove className="w-3 h-3 mr-2" />
                              Move to Folder
                            </button>
                            {formUrl && (
                              <button
                                data-menu-item="true"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  await copyToClipboard(formUrl, workflow.workflow_id)
                                  // Small delay to show feedback before closing
                                  setTimeout(() => setOpenMenuId(null), 100)
                                }}
                                onTouchEnd={async (e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  await copyToClipboard(formUrl, workflow.workflow_id)
                                  // Small delay to show feedback before closing
                                  setTimeout(() => setOpenMenuId(null), 100)
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                              >
                                {copiedUrl === workflow.workflow_id ? (
                                  <>
                                    <FiCheck className="w-3 h-3 mr-2 text-green-600" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <FiCopy className="w-3 h-3 mr-2" />
                                    Copy Form URL
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {/* Form Link - Consolidated */}
                    {workflow.form && formUrl ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={formUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-900 font-medium truncate flex-1 min-w-0 flex items-center gap-1.5"
                          title={formUrl}
                        >
                          <FiExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{workflow.form.form_name}</span>
                        </a>
                      </div>
                    ) : workflow.form ? (
                      <div className="text-gray-400 italic text-xs">No form URL</div>
                    ) : null}

                    {/* Metadata - Two Column Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-1.5">
                        <FiList className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <div className="flex gap-1 flex-wrap">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {workflow.steps?.length || 0} step{workflow.steps?.length !== 1 ? 's' : ''}
                          </span>
                          {workflow.template_id && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Template
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <FiClock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600 text-xs">{new Date(workflow.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Generated Documents - Simplified */}
                    <div className="pt-1.5">
                      {loadingJobs[workflow.workflow_id] ? (
                        <div className="text-xs text-gray-500 flex items-center gap-1.5">
                          <FiLoader className="w-3 h-3 animate-spin" />
                          <span>Loading...</span>
                        </div>
                      ) : (() => {
                        const jobs = workflowJobs[workflow.workflow_id] || []
                        const processingJobs = jobs.filter((j: any) => j.status === 'processing' || j.status === 'pending')
                        const completedJobs = jobs.filter((j: any) => j.status === 'completed')

                        if (processingJobs.length > 0) {
                          return (
                            <div className="text-xs text-blue-600 flex items-center gap-1.5">
                              <FiLoader className="w-3 h-3 animate-spin" />
                              <span>Processing...</span>
                            </div>
                          )
                        } else if (completedJobs.length > 0) {
                          const mostRecentJob = completedJobs[0]
                          return (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <FiFileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-600 text-xs">
                                  {completedJobs.length} document{completedJobs.length !== 1 ? 's' : ''}
                                </span>
                                {mostRecentJob.output_url && (
                                  <button
                                    type="button"
                                    className="text-primary-600 hover:text-primary-900 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openJobDocument(mostRecentJob.job_id, mostRecentJob.output_url)
                                    }}
                                    title="Open most recent document"
                                    aria-label="Open most recent document"
                                  >
                                    {openingDocumentJobId === mostRecentJob.job_id ? (
                                      <FiLoader className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <FiExternalLink className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                              {completedJobs.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/dashboard/jobs?workflow_id=${workflow.workflow_id}`)
                                  }}
                                  className="text-xs text-primary-600 hover:text-primary-900 flex-shrink-0"
                                >
                                  View all
                                </button>
                              )}
                            </div>
                          )
                        } else {
                          return (
                            <div className="text-xs text-gray-400 italic flex items-center gap-1.5">
                              <FiFileText className="w-3.5 h-3.5" />
                              <span>No documents yet</span>
                            </div>
                          )
                        }
                      })()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 md:px-4 lg:px-6 py-3 md:py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Lead Magnet Name
                  </th>
                  <th className="px-3 md:px-4 lg:px-6 py-3 md:py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Form
                  </th>
                  <th className="hidden xl:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-3 md:px-4 lg:px-6 py-3 md:py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Generated Documents
                  </th>
                  <th className="px-3 md:px-4 lg:px-6 py-3 md:py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredWorkflows.map((workflow) => {
                  const formUrl = workflow.form ? publicUrlFor(workflow.form) : null
                  const jobs = workflowJobs[workflow.workflow_id] || []
                  const processingJobs = jobs.filter((j: any) => j.status === 'processing' || j.status === 'pending')
                  const completedJobs = jobs.filter((j: any) => j.status === 'completed')

                  return (
                    <tr key={workflow.workflow_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 md:px-4 lg:px-6 py-3 md:py-4">
                        <a
                          href={`/dashboard/workflows/${workflow.workflow_id}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/dashboard/workflows/${workflow.workflow_id}`)
                          }}
                          className="text-xs md:text-sm font-semibold text-primary-600 hover:text-primary-900 transition-colors"
                        >
                          {workflow.workflow_name}
                        </a>
                        {workflow.workflow_description && (
                          <div className="text-xs md:text-sm text-gray-500 mt-1 line-clamp-1">{workflow.workflow_description}</div>
                        )}
                      </td>
                      <td className="px-3 md:px-4 lg:px-6 py-3 md:py-4">
                        {workflow.form ? (
                          formUrl ? (
                            <a
                              href={formUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs md:text-sm text-primary-600 hover:text-primary-900 font-medium flex items-center gap-1.5"
                              title={formUrl}
                            >
                              <span className="truncate">{workflow.form.form_name}</span>
                              <FiExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          ) : (
                            <div className="text-xs md:text-sm text-gray-900">{workflow.form.form_name}</div>
                          )
                        ) : (
                          <span className="text-xs md:text-sm text-gray-400 italic">No form</span>
                        )}
                      </td>
                      <td className="hidden xl:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(workflow.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 md:px-4 lg:px-6 py-3 md:py-4">
                        {loadingJobs[workflow.workflow_id] ? (
                          <div className="text-xs text-gray-500 flex items-center">
                            <FiLoader className="w-3 h-3 mr-1 animate-spin" />
                            Loading...
                          </div>
                        ) : processingJobs.length > 0 ? (
                          <div className="text-xs text-blue-600 flex items-center">
                            <FiLoader className="w-3 h-3 mr-1 animate-spin" />
                            Processing...
                          </div>
                        ) : completedJobs.length > 0 ? (
                          <div className="space-y-1">
                            {completedJobs.slice(0, 2).map((job: any) => (
                              <div key={job.job_id} className="flex items-center gap-2 text-xs">
                                {getJobStatusIcon(job.status)}
                                <span className="text-gray-600">{formatRelativeTime(job.created_at)}</span>
                                {job.output_url && (
                                  <button
                                    type="button"
                                    className="text-primary-600 hover:text-primary-900"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openJobDocument(job.job_id, job.output_url)
                                    }}
                                    title="Open document"
                                    aria-label="Open document"
                                  >
                                    {openingDocumentJobId === job.job_id ? (
                                      <FiLoader className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <FiExternalLink className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            ))}
                            {completedJobs.length > 2 && (
                              <button
                                onClick={() => router.push(`/dashboard/jobs?workflow_id=${workflow.workflow_id}`)}
                                className="text-xs text-primary-600 hover:text-primary-900"
                              >
                                View all {completedJobs.length}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No documents yet</span>
                        )}
                      </td>
                      <td className="px-3 md:px-4 lg:px-6 py-3 md:py-4 whitespace-nowrap text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(openMenuId === workflow.workflow_id ? null : workflow.workflow_id)
                            }}
                            className="p-1.5 md:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all touch-target"
                            title="Actions"
                          >
                            <FiMoreVertical className="w-4 h-4 md:w-5 md:h-5" />
                          </button>
                          {openMenuId === workflow.workflow_id && (
                            <div
                              ref={(el) => { menuRefs.current[workflow.workflow_id] = el; }}
                              data-menu-id={workflow.workflow_id}
                              className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    router.push(`/dashboard/workflows/${workflow.workflow_id}`)
                                    setOpenMenuId(null)
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation()
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                >
                                  <FiEye className="w-4 h-4 mr-2" />
                                  View
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    router.push(`/dashboard/workflows/${workflow.workflow_id}/edit`)
                                    setOpenMenuId(null)
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation()
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                >
                                  <FiEdit className="w-4 h-4 mr-2" />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setOpenMenuId(null)
                                    handleDelete(workflow.workflow_id)
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation()
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 active:bg-red-50 flex items-center touch-target"
                                >
                                  <FiTrash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setOpenMenuId(null)
                                    setShowMoveFolderModal(workflow.workflow_id)
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation()
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target border-t border-gray-100"
                                >
                                  <FiMove className="w-4 h-4 mr-2" />
                                  Move to Folder
                                </button>
                                {formUrl && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      e.preventDefault()
                                      await copyToClipboard(formUrl, workflow.workflow_id)
                                      // Small delay to show feedback before closing
                                      setTimeout(() => setOpenMenuId(null), 100)
                                    }}
                                    onTouchStart={(e) => {
                                      e.stopPropagation()
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-100 flex items-center touch-target"
                                  >
                                    {copiedUrl === workflow.workflow_id ? (
                                      <>
                                        <FiCheck className="w-4 h-4 mr-2 text-green-600" />
                                        Copied!
                                      </>
                                    ) : (
                                      <>
                                        <FiCopy className="w-4 h-4 mr-2" />
                                        Copy Form URL
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  )
}

