'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FiMonitor,
  FiCode,
  FiArrowLeft,
  FiSave,
  FiLayers,
  FiSmartphone,
  FiMousePointer,
  FiRotateCcw,
  FiRotateCw,
  FiZap,
} from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { api } from '@/lib/api'
import { ApiError } from '@/lib/api/errors'
import type { Job } from '@/types/job'
import type { Workflow } from '@/types/workflow'

// Types
type EditorMode = 'preview' | 'code'
type DeviceMode = 'desktop' | 'mobile'
type AISpeed = 'normal' | 'fast' | 'turbo'
type AIReasoningEffort = 'low' | 'medium' | 'high'

type HistoryEntry = { html: string; timestamp: number }
type HtmlState = {
  html: string
  history: HistoryEntry[]
  historyIndex: number
}
type HtmlAction =
  | { type: 'reset'; html: string }
  | { type: 'set'; html: string }
  | { type: 'commit'; html: string }
  | { type: 'undo' }
  | { type: 'redo' }

const initialHtmlState: HtmlState = { html: '', history: [], historyIndex: -1 }

function htmlReducer(state: HtmlState, action: HtmlAction): HtmlState {
  switch (action.type) {
    case 'reset': {
      const entry: HistoryEntry = { html: action.html, timestamp: Date.now() }
      return { html: action.html, history: [entry], historyIndex: 0 }
    }
    case 'set': {
      return { ...state, html: action.html }
    }
    case 'commit': {
      const base = state.history.slice(0, state.historyIndex + 1)
      const lastHtml = base[base.length - 1]?.html
      if (lastHtml === action.html) {
        return { ...state, html: action.html }
      }
      const nextHistory: HistoryEntry[] = [...base, { html: action.html, timestamp: Date.now() }]
      return { html: action.html, history: nextHistory, historyIndex: nextHistory.length - 1 }
    }
    case 'undo': {
      if (state.historyIndex <= 0) return state
      const newIndex = state.historyIndex - 1
      return { ...state, html: state.history[newIndex].html, historyIndex: newIndex }
    }
    case 'redo': {
      if (state.historyIndex >= state.history.length - 1) return state
      const newIndex = state.historyIndex + 1
      return { ...state, html: state.history[newIndex].html, historyIndex: newIndex }
    }
    default:
      return state
  }
}

function isTextInputTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}

const SELECTION_SCRIPT = `
  window.__selectionMode = false;
  
  document.addEventListener('mouseover', (e) => {
    if (window.__selectionMode) {
      e.stopPropagation();
      e.target.style.outline = '2px dashed #8b5cf6';
      e.target.style.cursor = 'crosshair';
    }
  }, true);

  document.addEventListener('mouseout', (e) => {
    if (window.__selectionMode) {
      e.stopPropagation();
      e.target.style.outline = '';
      e.target.style.cursor = '';
    }
  }, true);

  document.addEventListener('click', (e) => {
    if (window.__selectionMode) {
      e.preventDefault();
      e.stopPropagation();
      
      const tagName = e.target.tagName.toLowerCase();
      const id = e.target.id ? '#' + e.target.id : '';
      const classes = e.target.className && typeof e.target.className === 'string' ? '.' + e.target.className.split(' ').filter(c => c).join('.') : '';
      const selector = tagName + id + classes;
      
      window.parent.postMessage({ 
        type: 'ELEMENT_SELECTED', 
        selector, 
        outerHtml: e.target.outerHTML 
      }, '*');
      
      // Temporary flash
      const originalOutline = e.target.style.outline;
      e.target.style.outline = '2px solid #8b5cf6';
      setTimeout(() => {
        e.target.style.outline = originalOutline;
      }, 500);
    }
  }, true);

  window.addEventListener('message', (e) => {
    if (e.data.type === 'TOGGLE_SELECTION_MODE') {
        window.__selectionMode = e.data.enabled;
    }
    if (e.data.type === 'UPDATE_CONTENT') {
        // Optional: Update content without reload if needed
    }
  });
`;

export default function EditorClient() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('jobId')
  const initialUrl = searchParams.get('url')
  const artifactId = searchParams.get('artifactId')

  // State
  const [mode, setMode] = useState<EditorMode>('preview')
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [htmlState, dispatchHtml] = useReducer(htmlReducer, initialHtmlState)
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [selectedOuterHtml, setSelectedOuterHtml] = useState<string | null>(null)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [lastSavedHtml, setLastSavedHtml] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  // AI Configuration
  const [aiSpeed, setAiSpeed] = useState<AISpeed>('normal')
  const [aiReasoningEffort, setAiReasoningEffort] = useState<AIReasoningEffort>('medium')
  const [aiModel, setAiModel] = useState<'gpt-4o' | 'gpt-5.2'>('gpt-4o')
  const [showAiSettings, setShowAiSettings] = useState(false)

  // Template / workflow context
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const canUndo = htmlState.historyIndex > 0
  const canRedo = htmlState.historyIndex >= 0 && htmlState.historyIndex < htmlState.history.length - 1
  const isDirty = lastSavedHtml !== null && htmlState.html !== lastSavedHtml

  // Load HTML
  useEffect(() => {
    let isMounted = true

    const loadContent = async () => {
      if (isMounted) {
        setHasError(false)
      }

      // 1. Try fetching via Artifact ID (best for auth/CORS)
      if (artifactId) {
        try {
          const content = await api.artifacts.getArtifactContent(artifactId)
          if (content && isMounted) {
            dispatchHtml({ type: 'reset', html: content })
            setLastSavedHtml(content)
            setLastSavedAt(Date.now())
            setSelectedElement(null)
            setSelectedOuterHtml(null)
            setIsSelectionMode(false)
            return
          }
        } catch (err) {
          console.error('Failed to load artifact content:', err)
        }
      }

      // 2. Prefer server-proxied job document (avoids CloudFront/S3 404/CORS issues)
      if (jobId) {
        try {
          const content = await api.jobs.getJobDocument(jobId)
          if (content && isMounted) {
            dispatchHtml({ type: 'reset', html: content })
            setLastSavedHtml(content)
            setLastSavedAt(Date.now())
            setSelectedElement(null)
            setSelectedOuterHtml(null)
            setIsSelectionMode(false)
            return
          }
        } catch (err) {
          console.error('Failed to load job document:', err)
        }
      }

      // 3. Last resort: fetch the URL directly (may 404 if CloudFront key is stale)
      if (initialUrl) {
        try {
          const res = await fetch(initialUrl)
          if (!res.ok) {
            console.warn(`Failed to fetch URL ${initialUrl}: ${res.status} ${res.statusText}`)
            // continue to failure handling below
          } else {
            const content = await res.text()
            if (isMounted) {
              dispatchHtml({ type: 'reset', html: content })
              setLastSavedHtml(content)
              setLastSavedAt(Date.now())
              setSelectedElement(null)
              setSelectedOuterHtml(null)
              setIsSelectionMode(false)
            }
            return
          }
        } catch (err) {
          console.error('Failed to load initial URL', err)
        }
      }

      // If we got here, all methods failed
      if (isMounted) {
        setHasError(true)
        toast.error('Failed to load content')
      }
    }

    loadContent()

    return () => {
      isMounted = false
    }
  }, [jobId, initialUrl, artifactId])

  // Load job metadata for header context
  useEffect(() => {
    let isMounted = true

    const loadJob = async () => {
      if (!jobId) {
        setJob(null)
        return
      }
      try {
        const data = await api.getJob(jobId)
        if (isMounted) setJob(data)
      } catch {
        // Non-blocking: editor still works without metadata
      }
    }

    loadJob()
    return () => {
      isMounted = false
    }
  }, [jobId])

  // Load workflow (lead magnet) metadata for template actions
  useEffect(() => {
    let isMounted = true

    const loadWorkflow = async () => {
      const workflowId = job?.workflow_id
      if (!workflowId) {
        setWorkflow(null)
        return
      }
      try {
        const wf = await api.getWorkflow(workflowId)
        if (isMounted) setWorkflow(wf as Workflow)
      } catch {
        if (isMounted) setWorkflow(null)
      }
    }

    loadWorkflow()
    return () => {
      isMounted = false
    }
  }, [job?.workflow_id])

  // Inject script when HTML changes or iframe loads
  const getPreviewContent = useCallback(() => {
    if (!htmlState.html) return ''
    
    // Remove injected scripts (overlay + tracking) to prevent conflicts and sandbox errors.
    let cleanContent = String(htmlState.html || '')
      .replace(/<!--\s*Lead Magnet Editor Overlay\s*-->[\s\S]*?<\/script>\s*/gi, '')
      .replace(/<!--\s*Lead Magnet Tracking Script\s*-->[\s\S]*?<\/script>\s*/gi, '')
    
    // Inject our script before closing body
    if (cleanContent.includes('</body>')) {
        return cleanContent.replace('</body>', `<script>${SELECTION_SCRIPT}</script></body>`)
    }
    return cleanContent + `<script>${SELECTION_SCRIPT}</script>`
  }, [htmlState.html])

  // Handle Selection Mode Toggle
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ 
            type: 'TOGGLE_SELECTION_MODE', 
            enabled: isSelectionMode 
        }, '*')
    }
  }, [isSelectionMode])

  // Handle iframe messages
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
        if (e.data.type === 'ELEMENT_SELECTED') {
            setSelectedElement(e.data.selector)
            setSelectedOuterHtml(typeof e.data.outerHtml === 'string' ? e.data.outerHtml : null)
            setIsSelectionMode(false) // Turn off after selection
            toast.success(`Selected: ${e.data.selector}`, { icon: '🎯' })
        }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleUndo = useCallback(() => {
    if (!canUndo) return
    dispatchHtml({ type: 'undo' })
    toast('Undone', { icon: '↩️', duration: 1000 })
  }, [canUndo])

  const handleRedo = useCallback(() => {
    if (!canRedo) return
    dispatchHtml({ type: 'redo' })
    toast('Redone', { icon: '↪️', duration: 1000 })
  }, [canRedo])

  const handleSendMessage = useCallback(async () => {
    if (!prompt.trim() || !jobId) return
    // If the document is very large, full-document rewrites are slow/unreliable.
    // Encourage selection-driven edits (snippet mode).
    if (!selectedOuterHtml && htmlState.html.length > 120_000) {
      toast.error('This page is large—select an element first for faster, more reliable AI edits.')
      return
    }
    setIsProcessing(true)

    try {
      const res = await api.post<{ patched_html: string; summary: string }>(`/v1/jobs/${jobId}/html/patch`, {
        prompt: prompt,
        selector: selectedElement,
        model: aiModel,
        reasoning_effort: aiReasoningEffort,
        selected_outer_html: selectedOuterHtml,
        page_url: initialUrl || undefined,
      })

      if (res.patched_html) {
        dispatchHtml({ type: 'commit', html: res.patched_html })
        setPrompt('')
        setSelectedElement(null)
        setSelectedOuterHtml(null)
        toast.success('AI changes applied!')
      }
    } catch (err) {
      console.error('AI generation failed:', err)
      const apiErr = err instanceof ApiError ? err : null
      if (apiErr?.statusCode === 400) {
        toast.error(apiErr.message)
      } else if (apiErr?.statusCode === 503) {
        toast.error('AI editing is temporarily unavailable. Please try again in a moment.')
      } else {
        toast.error(apiErr?.message || 'Failed to apply AI changes')
      }
    } finally {
      setIsProcessing(false)
    }
  }, [aiModel, aiReasoningEffort, initialUrl, jobId, prompt, selectedElement, selectedOuterHtml])

  const stripInjectedBlocksForTemplate = useCallback((html: string) => {
    return String(html || '')
      .replace(/<!--\s*Lead Magnet Editor Overlay\s*-->[\s\S]*?<\/script>\s*/gi, '')
      .replace(/<!--\s*Lead Magnet Tracking Script\s*-->[\s\S]*?<\/script>\s*/gi, '')
      .trim()
  }, [])

  const handleSaveAsTemplate = useCallback(async () => {
    if (!workflow?.template_id) {
      toast.error('This lead magnet does not have a template attached.')
      return
    }
    if (!htmlState.html) return
    if (savingTemplate) return

    const name = workflow.workflow_name || 'this lead magnet'
    const confirmed = confirm(
      `Save your current HTML as the new template for "${name}"?\n\nThis will create a new template version. Future runs will use the updated template.`
    )
    if (!confirmed) return

    setSavingTemplate(true)
    try {
      const cleanedHtml = stripInjectedBlocksForTemplate(htmlState.html)
      const updatedTemplate = await api.updateTemplate(workflow.template_id, { html_content: cleanedHtml })

      const currentVersion =
        typeof workflow.template_version === 'number' && Number.isFinite(workflow.template_version)
          ? workflow.template_version
          : 0

      // If this workflow is pinned to a specific version (non-zero), bump it to the new version.
      if (currentVersion !== 0 && updatedTemplate?.version && updatedTemplate.version !== currentVersion) {
        await api.updateWorkflow(workflow.workflow_id, { template_version: updatedTemplate.version })
        setWorkflow((prev) => (prev ? { ...prev, template_version: updatedTemplate.version } : prev))
      }

      toast.success(`Template updated (v${updatedTemplate?.version || 'new'})`)
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null
      toast.error(apiErr?.message || 'Failed to update template')
    } finally {
      setSavingTemplate(false)
    }
  }, [htmlState.html, savingTemplate, stripInjectedBlocksForTemplate, workflow])
  
  const handleSave = useCallback(async () => {
    if (!jobId || !htmlState.html) return
    setIsSaving(true)
    try {
      await api.post(`/v1/jobs/${jobId}/html/save`, {
        patched_html: htmlState.html,
      })
      setLastSavedHtml(htmlState.html)
      setLastSavedAt(Date.now())
      toast.success('Changes saved successfully')
    } catch (err) {
      console.error('Save failed:', err)
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }, [htmlState.html, jobId])

  // Keyboard shortcuts: Cmd/Ctrl+S save, Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSelectionMode(false)
        setShowAiSettings(false)
        return
      }

      const isMeta = e.metaKey || e.ctrlKey
      if (!isMeta) return

      const key = e.key.toLowerCase()

      if (key === 's') {
        e.preventDefault()
        handleSave()
        return
      }

      // Don't override native undo/redo inside text inputs
      if (isTextInputTarget(e.target)) return

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }

      if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleRedo, handleSave, handleUndo])

  const headerTitle = useMemo(() => {
    const workflowName = (job as any)?.workflow_name
    if (typeof workflowName === 'string' && workflowName.trim()) return workflowName.trim()
    if (job?.workflow_id) return job.workflow_id
    return 'Lead Magnet Editor'
  }, [job])

  const headerMeta = useMemo(() => {
    if (jobId) return `Job ${jobId.slice(0, 8)}`
    if (artifactId) return `Artifact ${artifactId.slice(0, 8)}`
    return null
  }, [artifactId, jobId])

  const saveStateLabel = useMemo(() => {
    if (isSaving) return 'Saving…'
    if (!lastSavedHtml) return 'Not saved'
    if (isDirty) return 'Unsaved'
    return 'Saved'
  }, [isDirty, isSaving, lastSavedHtml])

  const backHref = jobId ? `/dashboard/jobs/${jobId}` : '/dashboard/jobs'
  const canSave = Boolean(jobId && htmlState.html && isDirty && !isSaving)
  const canSaveAsTemplate = Boolean(workflow?.template_id && htmlState.html && !savingTemplate)
  const reasoningLabel = aiReasoningEffort === 'medium' ? 'MED' : aiReasoningEffort.toUpperCase()

  return (
    <div className="flex h-screen flex-col bg-[#0c0d10] text-gray-200 font-sans selection:bg-purple-500/30 overflow-hidden">
      {/* Top Navigation Bar - Replicating Web Weaver */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0c0d10] z-50">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={backHref}
              className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
              aria-label="Back"
            >
              <FiArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-sm text-gray-200 truncate">{headerTitle}</span>
                {headerMeta && <span className="text-[11px] font-mono text-gray-500 truncate">{headerMeta}</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                <span className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
                <span>{saveStateLabel}</span>
                {lastSavedAt && !isDirty && (
                  <span className="hidden sm:inline">· {new Date(lastSavedAt).toLocaleTimeString()}</span>
                )}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex bg-[#1c1d21] rounded-lg p-1 border border-white/5">
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                mode === 'preview'
                  ? 'bg-[#2b2d31] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <FiMonitor className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              onClick={() => setMode('code')}
              className={`flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                mode === 'code'
                  ? 'bg-[#2b2d31] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <FiCode className="w-3.5 h-3.5" />
              Code
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="p-2 rounded-md hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo (Cmd/Ctrl+Z)"
          >
            <FiRotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="p-2 rounded-md hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo (Cmd/Ctrl+Shift+Z)"
          >
            <FiRotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors border ${
              canSave
                ? 'bg-white text-black hover:bg-gray-200 border-white/10'
                : 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed'
            }`}
            title={jobId ? 'Save (Cmd/Ctrl+S)' : 'Saving requires a jobId'}
          >
            <FiSave className="w-3.5 h-3.5" />
            {isSaving ? 'Saving…' : 'Save'}
          </button>

          <button
            onClick={handleSaveAsTemplate}
            disabled={!canSaveAsTemplate}
            className={`hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors border ${
              canSaveAsTemplate
                ? 'bg-white/10 text-white hover:bg-white/15 border-white/10'
                : 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed'
            }`}
            title={
              workflow?.template_id
                ? 'Update the lead magnet template HTML from your current editor HTML'
                : 'No template attached to this lead magnet'
            }
          >
            <FiLayers className="w-3.5 h-3.5" />
            {savingTemplate ? 'Updating template…' : 'Save as Template'}
          </button>

          <div className="hidden sm:block h-4 w-px bg-white/10 mx-1" />

          <div className="flex items-center gap-1 text-gray-500">
            <button
              onClick={() => setDevice('desktop')}
              className={`p-2 rounded-md hover:bg-white/5 transition-colors ${
                device === 'desktop' ? 'text-gray-200 bg-white/5' : ''
              }`}
              title="Desktop preview"
            >
              <FiMonitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`p-2 rounded-md hover:bg-white/5 transition-colors ${
                device === 'mobile' ? 'text-gray-200 bg-white/5' : ''
              }`}
              title="Mobile preview"
            >
              <FiSmartphone className="w-4 h-4" />
            </button>
          </div>

          {initialUrl ? (
            <a
              href={initialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
            >
              Visit <FiArrowLeft className="w-3 h-3 rotate-[135deg]" />
            </a>
          ) : null}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 relative overflow-hidden bg-[#050505] flex flex-col items-center justify-center p-6">
        {mode === 'preview' ? (
            <div 
                className={`relative transition-all duration-500 ease-spring shadow-2xl ${
                    device === 'mobile' 
                        ? 'w-[375px] h-[667px] rounded-[3rem] border-8 border-[#1c1d21] bg-white overflow-hidden' 
                        : 'w-full max-w-6xl h-full rounded-xl border border-white/5 bg-white overflow-hidden'
                }`}
            >
                {htmlState.html ? (
                  <iframe 
                    ref={iframeRef}
                    srcDoc={getPreviewContent()}
                    className="w-full h-full bg-white"
                    title="Preview"
                    sandbox="allow-scripts allow-popups"
                  />
                ) : hasError ? (
                   <div className="flex flex-col w-full h-full items-center justify-center text-gray-500 bg-[#0c0d10] p-4 text-center">
                       <p className="text-red-400 font-medium mb-2">Failed to load content</p>
                       <button 
                          onClick={() => window.location.reload()}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md text-xs text-white transition-colors"
                       >
                          Refresh Page
                       </button>
                   </div>
                ) : (
                   <div className="flex w-full h-full items-center justify-center text-gray-500 bg-[#0c0d10]">
                       <FiRotateCw className="h-5 w-5 animate-spin mr-2" />
                       Loading...
                   </div> 
                )}
                
                {/* Selection Mode Indicator Overlay */}
                {isSelectionMode && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 pointer-events-none">
                        <FiMousePointer className="w-3.5 h-3.5" />
                        Select an element to edit
                    </div>
                )}
            </div>
        ) : (
            <div className="w-full h-full max-w-6xl rounded-xl border border-white/5 bg-[#15161a] overflow-hidden">
                <textarea
                    value={htmlState.html}
                    onChange={(e) => {
                        dispatchHtml({ type: 'set', html: e.target.value })
                    }}
                    onBlur={() => dispatchHtml({ type: 'commit', html: htmlState.html })}
                    className="w-full h-full bg-[#15161a] text-gray-300 font-mono text-sm p-4 resize-none focus:outline-none"
                    spellCheck={false}
                />
            </div>
        )}
      </main>

      <footer className="relative border-t border-white/5 bg-[#0c0d10] px-4 py-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="bg-[#15161a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 transition-all focus-within:ring-1 focus-within:ring-purple-500/50 ring-offset-2 ring-offset-[#0c0d10]">
            <div className="flex flex-col">
              {/* Context & Selection (if any) */}
              {selectedElement && (
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-white/5 mb-1">
                  <div className="flex items-center gap-2 text-xs text-purple-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    <span className="font-mono truncate max-w-[300px]">{selectedElement}</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedElement(null)
                      setSelectedOuterHtml(null)
                      setIsSelectionMode(false)
                    }}
                    className="text-gray-500 hover:text-white"
                    title="Clear selection"
                  >
                    <FiRotateCw className="w-3 h-3 rotate-45" />
                  </button>
                </div>
              )}

              {/* Main Input Area */}
              <div className="flex items-end gap-2 px-2">
                <button
                  onClick={() => setIsSelectionMode((v) => !v)}
                  disabled={mode !== 'preview' || !htmlState.html}
                  className={`p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    isSelectionMode ? 'text-purple-400 bg-purple-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={mode === 'preview' ? 'Select element' : 'Selection requires Preview mode'}
                >
                  <FiMousePointer className="w-4 h-4" />
                </button>

                <div className="h-9 w-px bg-white/10" />

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder={jobId ? 'Describe the change you want (Shift+Enter for a new line)…' : 'Open this editor from a job to apply AI edits…'}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder-gray-500 min-h-[44px] max-h-36 py-2 resize-none"
                  disabled={isProcessing || !jobId}
                  rows={1}
                />

                <div className="flex items-center gap-1 pb-2">
                  <button
                    onClick={() => setShowAiSettings((v) => !v)}
                    className="px-2 py-1 text-[10px] font-semibold bg-[#2b2d31] text-yellow-300 rounded-md flex items-center gap-1 border border-white/5 hover:bg-white/10 transition-colors"
                    title="AI settings"
                  >
                    <FiZap className="w-3 h-3" />
                    {aiModel === 'gpt-4o' ? 'GPT-4o' : 'GPT-5.2'} · {aiSpeed.toUpperCase()} · {reasoningLabel}
                  </button>

                  <button
                    onClick={handleSendMessage}
                    disabled={!jobId || !prompt.trim() || isProcessing}
                    className={`p-2 rounded-lg transition-all ${
                      jobId && prompt.trim() && !isProcessing
                        ? 'bg-white text-black hover:bg-gray-200'
                        : 'bg-white/5 text-gray-500 cursor-not-allowed'
                    }`}
                    title={jobId ? 'Apply (Enter)' : 'Applying requires a jobId'}
                  >
                    {isProcessing ? (
                      <FiRotateCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FiArrowLeft className="w-4 h-4 rotate-90" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Popover */}
          {showAiSettings && (
            <div className="absolute bottom-full right-4 mb-3 w-72 bg-[#15161a] border border-white/10 rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-2 fade-in">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">
                    Generation Settings
                  </label>

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1.5">AI Model</div>
                      <div className="grid grid-cols-2 gap-1 bg-black/20 p-1 rounded-lg">
                        <button
                          onClick={() => setAiModel('gpt-4o')}
                          className={`text-xs py-1.5 rounded-md transition-colors ${
                            aiModel === 'gpt-4o' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          GPT-4o
                        </button>
                        <button
                          onClick={() => setAiModel('gpt-5.2')}
                          className={`text-xs py-1.5 rounded-md transition-colors ${
                            aiModel === 'gpt-5.2' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          GPT-5.2
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-400 mb-1.5">Speed</div>
                      <div className="flex gap-1">
                        {(['normal', 'fast', 'turbo'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setAiSpeed(s)}
                            className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                              aiSpeed === s
                                ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                                : 'border-transparent bg-white/5 text-gray-500 hover:bg-white/10'
                            }`}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-400 mb-1.5">Reasoning effort</div>
                      <div className="flex gap-1">
                        {(['low', 'medium', 'high'] as const).map((effort) => (
                          <button
                            key={effort}
                            onClick={() => setAiReasoningEffort(effort)}
                            className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                              aiReasoningEffort === effort
                                ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                                : 'border-transparent bg-white/5 text-gray-500 hover:bg-white/10'
                            }`}
                          >
                            {effort === 'medium' ? 'Medium' : effort.charAt(0).toUpperCase() + effort.slice(1)}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Applies to GPT-5 models; ignored on GPT-4o.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
            <div className="flex items-center gap-2">
              <span>Enter to apply</span>
              <span className="text-gray-700">·</span>
              <span>Shift+Enter for a new line</span>
              <span className="hidden sm:inline text-gray-700">·</span>
              <span className="hidden sm:inline">Cmd/Ctrl+S to save</span>
            </div>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`sm:hidden inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors border ${
                canSave
                  ? 'bg-white text-black hover:bg-gray-200 border-white/10'
                  : 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed'
              }`}
            >
              <FiSave className="w-3.5 h-3.5" />
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
