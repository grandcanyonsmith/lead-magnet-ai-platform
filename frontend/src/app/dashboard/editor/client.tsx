'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { FiMonitor, FiCode, FiArrowLeft, FiSave, FiClock, FiSettings, FiSend, FiSmartphone, FiMousePointer, FiRotateCcw, FiRotateCw, FiZap, FiCommand, FiTerminal, FiLayout, FiMaximize2, FiMinimize2, FiMoreHorizontal } from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { api } from '@/lib/api'

// Types
type EditorMode = 'preview' | 'code'
type DeviceMode = 'desktop' | 'mobile'
type AISpeed = 'normal' | 'fast' | 'turbo'
type AIReasoning = 'low' | 'medium' | 'high'

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
  const router = useRouter()
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
  const [htmlContent, setHtmlContent] = useState('')
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [selectedOuterHtml, setSelectedOuterHtml] = useState<string | null>(null)
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  // AI Configuration
  const [aiSpeed, setAiSpeed] = useState<AISpeed>('normal')
  const [aiReasoning, setAiReasoning] = useState<AIReasoning>('medium')
  const [aiModel, setAiModel] = useState<'gpt-4o' | 'gpt-5.2'>('gpt-4o')
  const [showAiSettings, setShowAiSettings] = useState(false)

  // History
  const [history, setHistory] = useState<{ html: string; timestamp: number }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showHistory, setShowHistory] = useState(false)

  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Load HTML
  useEffect(() => {
    let isMounted = true

    const loadContent = async () => {
      if (isMounted) {
        setHasError(false)
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-editor-load-2',hypothesisId:'H_load_order',location:'frontend/editor/client.tsx:loadContent:entry',message:'loadContent entry',data:{jobId,artifactIdPresent:Boolean(artifactId),hasInitialUrl:Boolean(initialUrl)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // 1. Try fetching via Artifact ID (best for auth/CORS)
      if (artifactId) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-editor-load-2',hypothesisId:'H_artifact_fetch',location:'frontend/editor/client.tsx:loadContent:artifact:start',message:'artifact content fetch start',data:{artifactId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        try {
          const content = await api.artifacts.getArtifactContent(artifactId)
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-editor-load-2',hypothesisId:'H_artifact_fetch',location:'frontend/editor/client.tsx:loadContent:artifact:end',message:'artifact content fetch end',data:{ok:Boolean(content),contentLength:content?content.length:0,isMounted},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (content && isMounted) {
            setHtmlContent(content)
            addToHistory(content)
            return
          }
        } catch (err) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-editor-load-2',hypothesisId:'H_artifact_fetch',location:'frontend/editor/client.tsx:loadContent:artifact:end',message:'artifact content fetch error',data:{error:String((err as any)?.message||err)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          console.error('Failed to load artifact content:', err)
        }
      }

      // 2. Prefer server-proxied job document (avoids CloudFront/S3 404/CORS issues)
      if (jobId) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-editor-load-2',hypothesisId:'H_jobdoc_fetch',location:'frontend/editor/client.tsx:loadContent:jobdoc:start',message:'job document fetch start',data:{jobId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        try {
          const content = await api.jobs.getJobDocument(jobId)
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-editor-load-2',hypothesisId:'H_jobdoc_fetch',location:'frontend/editor/client.tsx:loadContent:jobdoc:end',message:'job document fetch end',data:{ok:Boolean(content),contentLength:content?content.length:0,isMounted},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (content && isMounted) {
            setHtmlContent(content)
            addToHistory(content)
            return
          }
        } catch (err) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-editor-load-2',hypothesisId:'H_jobdoc_fetch',location:'frontend/editor/client.tsx:loadContent:jobdoc:end',message:'job document fetch error',data:{error:String((err as any)?.message||err)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          console.error('Failed to load job document:', err)
        }
      }

      // 3. Last resort: fetch the URL directly (may 404 if CloudFront key is stale)
      if (initialUrl) {
        try {
          const res = await fetch(initialUrl)
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-editor-load-2',hypothesisId:'H_url_fetch',location:'frontend/editor/client.tsx:loadContent:url:end',message:'initialUrl fetch end',data:{ok:res.ok,status:res.status},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (!res.ok) {
            console.warn(`Failed to fetch URL ${initialUrl}: ${res.status} ${res.statusText}`)
            // continue to failure handling below
          } else {
            const content = await res.text()
            if (isMounted) {
              setHtmlContent(content)
              addToHistory(content)
            }
            return
          }
        } catch (err) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-editor-load-2',hypothesisId:'H_url_fetch',location:'frontend/editor/client.tsx:loadContent:url:end',message:'initialUrl fetch error',data:{error:String((err as any)?.message||err)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          console.error('Failed to load initial URL', err)
        }
      }

      // If we got here, all methods failed
      if (isMounted) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-editor-load-2',hypothesisId:'H_all_failed',location:'frontend/editor/client.tsx:loadContent:failed',message:'loadContent failed (all sources)',data:{jobId,artifactIdPresent:Boolean(artifactId),hasInitialUrl:Boolean(initialUrl)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setHasError(true)
        toast.error('Failed to load content')
      }
    }

    loadContent()

    return () => {
      isMounted = false
    }
  }, [jobId, initialUrl, artifactId]) // Removed htmlContent from deps to avoid loop

  // Inject script when HTML changes or iframe loads
  const getPreviewContent = useCallback(() => {
    if (!htmlContent) return ''
    
    // Remove legacy overlay script to prevent conflicts
    let cleanContent = htmlContent.replace(/<!--\s*Lead Magnet Editor Overlay\s*-->[\s\S]*?<\/script>/gi, '')
    
    // Inject our script before closing body
    if (cleanContent.includes('</body>')) {
        return cleanContent.replace('</body>', `<script>${SELECTION_SCRIPT}</script></body>`)
    }
    return cleanContent + `<script>${SELECTION_SCRIPT}</script>`
  }, [htmlContent])

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

  const addToHistory = (html: string) => {
      setHistory(prev => {
          const newHistory = prev.slice(0, historyIndex + 1)
          newHistory.push({ html, timestamp: Date.now() })
          return newHistory
      })
      setHistoryIndex(prev => prev + 1)
  }

  const handleUndo = () => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1
          setHistoryIndex(newIndex)
          setHtmlContent(history[newIndex].html)
          toast('Undone', { icon: '↩️', duration: 1000 })
      }
  }

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1
          setHistoryIndex(newIndex)
          setHtmlContent(history[newIndex].html)
          toast('Redone', { icon: '↪️', duration: 1000 })
      }
  }
  
  const restoreVersion = (index: number) => {
      setHistoryIndex(index)
      setHtmlContent(history[index].html)
      setShowHistory(false)
      toast.success('Version restored')
  }

  const handleSendMessage = async () => {
    if (!prompt.trim() || !jobId) return
    setIsProcessing(true)
    
    try {
        const res = await api.post<{ patched_html: string; summary: string }>(`/v1/jobs/${jobId}/html/patch`, {
            prompt: prompt,
            selector: selectedElement,
            model: aiModel,
            selected_outer_html: selectedOuterHtml,
            page_url: initialUrl || undefined,
        })

        if (res.patched_html) {
            setHtmlContent(res.patched_html)
            addToHistory(res.patched_html)
            setPrompt('')
            setSelectedElement(null)
            setSelectedOuterHtml(null)
            toast.success('AI changes applied!')
        }
    } catch (err) {
        console.error('AI generation failed:', err)
        toast.error('Failed to generate changes')
    } finally {
        setIsProcessing(false)
    }
  }
  
  const handleSave = async () => {
      if (!jobId || !htmlContent) return
      setIsSaving(true)
      try {
           await api.post(`/v1/jobs/${jobId}/html/save`, {
               patched_html: htmlContent
           })
           toast.success('Changes saved successfully')
      } catch (err) {
          console.error('Save failed:', err)
          toast.error('Failed to save changes')
      } finally {
          setIsSaving(false)
      }
  }

  return (
    <div className="flex h-screen flex-col bg-[#0c0d10] text-gray-200 font-sans selection:bg-purple-500/30 overflow-hidden">
      {/* Top Navigation Bar - Replicating Web Weaver */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0c0d10] z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
             <Link href={`/dashboard/jobs/${jobId}`} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5">
                <FiArrowLeft className="w-4 h-4" />
             </Link>
             <span className="font-semibold text-sm text-gray-200">Course Creator 360 Inc</span>
          </div>
          
          <div className="flex bg-[#1c1d21] rounded-lg p-1 border border-white/5">
             <button 
                onClick={() => setMode('preview')}
                className={`flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'preview' ? 'bg-[#2b2d31] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
             >
                <FiMonitor className="w-3.5 h-3.5" />
                Preview
             </button>
             <button 
                onClick={() => setMode('code')}
                className={`flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'code' ? 'bg-[#2b2d31] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
             >
                <FiCode className="w-3.5 h-3.5" />
                Code
             </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-gray-500">
                <button 
                    onClick={() => setDevice('desktop')}
                    className={`p-2 rounded-md hover:bg-white/5 transition-colors ${device === 'desktop' ? 'text-gray-200 bg-white/5' : ''}`}
                >
                    <FiMonitor className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setDevice('mobile')}
                    className={`p-2 rounded-md hover:bg-white/5 transition-colors ${device === 'mobile' ? 'text-gray-200 bg-white/5' : ''}`}
                >
                    <FiSmartphone className="w-4 h-4" />
                </button>
            </div>
            
            <div className="h-4 w-px bg-white/10" />
            
            <a 
                href={initialUrl || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
            >
                Visit <FiArrowLeft className="w-3 h-3 rotate-[135deg]" />
            </a>
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
                {htmlContent ? (
                  <iframe 
                    ref={iframeRef}
                    srcDoc={getPreviewContent()}
                    className="w-full h-full bg-white"
                    title="Preview"
                    sandbox="allow-scripts allow-same-origin"
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
                    value={htmlContent}
                    onChange={(e) => {
                        setHtmlContent(e.target.value)
                    }}
                    onBlur={() => addToHistory(htmlContent)}
                    className="w-full h-full bg-[#15161a] text-gray-300 font-mono text-sm p-4 resize-none focus:outline-none"
                    spellCheck={false}
                />
            </div>
        )}
      </main>

      {/* Bottom Floating Input Bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4">
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
                        >
                            <FiRotateCw className="w-3 h-3 rotate-45" />
                        </button>
                    </div>
                )}

                {/* Main Input Area */}
                <div className="flex items-center gap-2 px-2">
                    <button 
                        onClick={() => setIsSelectionMode(!isSelectionMode)}
                        className={`p-2 rounded-lg transition-colors ${isSelectionMode ? 'text-purple-400 bg-purple-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        title="Select Element"
                    >
                        <FiMousePointer className="w-4 h-4" />
                    </button>
                    
                    <button className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-lg">
                        <FiLayout className="w-4 h-4" />
                    </button>

                    <div className="h-6 w-px bg-white/10" />

                    <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Make lightweight changes, quickly..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder-gray-500 h-10"
                        disabled={isProcessing}
                    />

                    <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1 bg-[#0c0d10] rounded-lg p-0.5 border border-white/5">
                            <button className="px-2 py-1 text-[10px] font-medium text-gray-400 hover:text-white flex items-center gap-1">
                                <FiCommand className="w-3 h-3" /> Agent
                            </button>
                            <button 
                                onClick={() => setShowAiSettings(!showAiSettings)}
                                className="px-2 py-1 text-[10px] font-medium bg-[#2b2d31] text-yellow-400 rounded-md flex items-center gap-1 border border-white/5"
                            >
                                <FiZap className="w-3 h-3" /> NORMAL
                            </button>
                        </div>
                        
                        <button 
                            onClick={handleSendMessage}
                            disabled={!prompt.trim() || isProcessing}
                            className={`p-2 rounded-lg transition-all ${prompt.trim() && !isProcessing ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/5 text-gray-500'}`}
                        >
                            {isProcessing ? <FiRotateCw className="w-4 h-4 animate-spin" /> : <FiArrowLeft className="w-4 h-4 rotate-90" />}
                        </button>
                    </div>
                </div>
            </div>
         </div>
         
         {/* Settings Popover */}
         {showAiSettings && (
             <div className="absolute bottom-full right-4 mb-2 w-64 bg-[#15161a] border border-white/10 rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-2 fade-in">
                 <div className="flex flex-col gap-4">
                     <div>
                         <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">Generation Settings</label>
                         
                         <div className="space-y-3">
                             <div>
                                 <div className="text-xs text-gray-400 mb-1.5">AI Model</div>
                                 <div className="grid grid-cols-2 gap-1 bg-black/20 p-1 rounded-lg">
                                     <button 
                                        onClick={() => setAiModel('gpt-4o')}
                                        className={`text-xs py-1.5 rounded-md transition-colors ${aiModel === 'gpt-4o' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                     >
                                         GPT-4o
                                     </button>
                                     <button 
                                        onClick={() => setAiModel('gpt-5.2')}
                                        className={`text-xs py-1.5 rounded-md transition-colors ${aiModel === 'gpt-5.2' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                     >
                                         GPT-5.2
                                     </button>
                                 </div>
                             </div>
                             
                             <div>
                                 <div className="text-xs text-gray-400 mb-1.5">Speed</div>
                                 <div className="flex gap-1">
                                     {(['normal', 'fast', 'turbo'] as const).map(s => (
                                         <button 
                                            key={s}
                                            onClick={() => setAiSpeed(s)}
                                            className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${aiSpeed === s ? 'border-purple-500/30 bg-purple-500/10 text-purple-300' : 'border-transparent bg-white/5 text-gray-500 hover:bg-white/10'}`}
                                         >
                                             {s.charAt(0).toUpperCase() + s.slice(1)}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
         )}

         {/* Bottom Action Footer */}
         <div className="mt-2 flex justify-center gap-4 text-xs text-gray-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100">
             <button onClick={handleUndo} className="hover:text-gray-300 flex items-center gap-1"><FiRotateCcw /> Undo</button>
             <button onClick={handleSave} className="hover:text-gray-300 flex items-center gap-1"><FiSave /> {isSaving ? 'Saving...' : 'Save Changes'}</button>
         </div>
      </div>
    </div>
  )
}
