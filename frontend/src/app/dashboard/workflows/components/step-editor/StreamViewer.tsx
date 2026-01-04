"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  FiTerminal,
  FiImage,
  FiCheckCircle,
  FiAlertCircle,
  FiLayout,
  FiMaximize2,
  FiMinimize2,
  FiCopy,
  FiExternalLink,
  FiDownload,
  FiSidebar,
  FiTrash2,
  FiPlay,
  FiPause,
  FiSearch,
  FiX
} from "react-icons/fi";
import { authService } from "@/lib/auth";
import toast from "react-hot-toast";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";

interface StreamViewerProps {
  endpoint: string;
  requestBody: any;
  onClose: () => void;
}

interface LogEntry {
  timestamp: number;
  message: string;
  level: string;
  type: string;
}

const OUTPUT_DELTA_PREFIX = "__OUTPUT_DELTA__";

// -----------------------------------------------------------------------------
// Log Line Component
// -----------------------------------------------------------------------------

import { formatLogMessage } from "./LogFormatter";

function LogLine({ log, searchQuery, isMatch, isCurrentMatch, index, onRef }: { 
  log: LogEntry; 
  searchQuery: string;
  isMatch: boolean;
  isCurrentMatch: boolean;
  index: number;
  onRef: (el: HTMLDivElement | null) => void;
}) {
  // If searching, use the highlighter logic
  const content = useMemo(() => {
    if (searchQuery && isMatch) {
      const parts = log.message.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      return (
        <span className={log.level === 'error' ? 'text-red-300' : log.level === 'warn' ? 'text-yellow-300' : 'text-gray-300'}>
          {parts.map((part, i) => 
            part.toLowerCase() === searchQuery.toLowerCase() ? (
              <mark key={i} className={`bg-yellow-400 text-gray-900 px-0.5 rounded ${isCurrentMatch ? 'ring-2 ring-yellow-300 ring-offset-1 ring-offset-[#0d1117]' : ''}`}>
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </span>
      );
    }
    
    // Otherwise use the rich formatter
    return (
      <div className={log.level === 'error' ? 'text-red-300' : log.level === 'warn' ? 'text-yellow-300' : 'text-gray-300'}>
        {formatLogMessage(log.message)}
      </div>
    );
  }, [log.message, log.level, searchQuery, isMatch, isCurrentMatch]);

  return (
    <div 
      ref={onRef}
      className={`
        flex items-start gap-3 py-0.5 px-4 hover:bg-white/5 transition-colors font-mono text-[13px] leading-6 group
        ${log.level === 'error' ? 'bg-red-500/10' : ''}
        ${log.level === 'warn' ? 'bg-yellow-500/10' : ''}
        ${isCurrentMatch ? 'bg-blue-500/20' : ''}
        ${isMatch && !isCurrentMatch ? 'bg-yellow-500/10' : ''}
      `}
    >
      <div className="flex select-none text-gray-600 text-right w-[24px] shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
        {index + 1}
      </div>
      <div className="flex gap-3 w-full">
        <span className="text-gray-500 select-none shrink-0 w-[60px] opacity-70">
          {new Date(log.timestamp * 1000).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
        </span>
        <div className="break-all whitespace-pre-wrap w-full border-l border-gray-800 pl-3 min-h-[1.5em]">
          {content}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function StreamViewer({ endpoint, requestBody, onClose }: StreamViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "streaming" | "completed" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  
  // UI State
  const [viewMode, setViewMode] = useState<'split' | 'terminal' | 'preview'>('split');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const matchRefs = useRef<(HTMLDivElement | null)[]>([]);
  const streamedOutputLogIndexRef = useRef<number | null>(null);

  // Connection Logic
  useEffect(() => {
    let active = true;
    const abortController = new AbortController();

    async function startStream() {
      try {
        const token = await authService.getIdToken();
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(requestBody),
          signal: abortController.signal
        });

        if (!response.ok) {
           const text = await response.text();
           throw new Error(`API Error: ${response.status} ${text}`);
        }
        
        setStatus("streaming");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Response body is not readable");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              
              if (active) {
                handleEvent(event);
              }
            } catch (e) {
              console.warn("Failed to parse JSON line:", line);
            }
          }
        }
        
        if (active) setStatus("completed");

      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (active) {
          setError(err.message);
          setStatus("error");
        }
      }
    }

    startStream();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [endpoint, requestBody]);

  const handleEvent = (event: any) => {
    if (event.type === 'log') {
        const msg = typeof event.message === "string" ? event.message : "";

        // Special-case: model output deltas are streamed as log events with a prefix.
        // We append deltas into a single growing log line for a smooth "live output" experience.
        if (msg.startsWith(OUTPUT_DELTA_PREFIX)) {
          const delta = msg.slice(OUTPUT_DELTA_PREFIX.length);
          if (!delta) return;

          setLogs((prev) => {
            const next = [...prev];
            const ts =
              typeof event.timestamp === "number"
                ? event.timestamp
                : Date.now() / 1000;
            const level = typeof event.level === "string" ? event.level : "info";

            const idx = streamedOutputLogIndexRef.current;
            if (idx === null || !next[idx]) {
              streamedOutputLogIndexRef.current = next.length;
              next.push({
                type: "log",
                timestamp: ts,
                level,
                message: delta,
              });
              return next;
            }

            next[idx] = {
              ...next[idx],
              message: `${next[idx].message || ""}${delta}`,
            };
            return next;
          });
          return;
        }

        setLogs(prev => [...prev, event]);
    } else if (event.type === 'screenshot') {
        // Store both URL and base64 for fallback
        if (event.url) {
            setScreenshotUrl(event.url);
        }
        if (event.base64) {
            setScreenshotBase64(event.base64);
        }
        // Auto-switch to split view if a screenshot arrives and we are in terminal mode (optional UX choice)
        // setViewMode(prev => prev === 'terminal' ? 'split' : prev);
    } else if (event.type === 'complete') {
        setLogs(prev => [...prev, { 
            type: 'log', 
            timestamp: Date.now() / 1000, 
            level: 'info', 
            message: 'Stream completed.' 
        }]);
    } else if (event.type === 'error') {
        setError(event.message);
        setStatus("error");
    }
  };

  // Filter logs based on search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const query = searchQuery.toLowerCase();
    return logs.filter(log => 
      log.message.toLowerCase().includes(query) ||
      log.level.toLowerCase().includes(query) ||
      new Date(log.timestamp * 1000).toLocaleTimeString().toLowerCase().includes(query)
    );
  }, [logs, searchQuery]);

  // Find all matching log indices
  const matchingIndices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return logs
      .map((log, index) => ({ log, index }))
      .filter(({ log }) => 
        log.message.toLowerCase().includes(query) ||
        log.level.toLowerCase().includes(query) ||
        new Date(log.timestamp * 1000).toLocaleTimeString().toLowerCase().includes(query)
      )
      .map(({ index }) => index);
  }, [logs, searchQuery]);

  // Navigate to next/previous match
  const navigateMatch = useCallback((direction: 'next' | 'prev') => {
    if (matchingIndices.length === 0) return;
    setCurrentMatchIndex(prev => {
      if (direction === 'next') {
        return (prev + 1) % matchingIndices.length;
      } else {
        return (prev - 1 + matchingIndices.length) % matchingIndices.length;
      }
    });
  }, [matchingIndices.length]);

  // Reset current match index when search changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  // Scroll to current match
  useEffect(() => {
    if (searchQuery.trim() && matchingIndices.length > 0 && matchRefs.current[matchingIndices[currentMatchIndex]]) {
      matchRefs.current[matchingIndices[currentMatchIndex]]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentMatchIndex, matchingIndices, searchQuery]);

  // Auto-scroll logs (only if not searching)
  useEffect(() => {
    if (autoScroll && scrollRef.current && !searchQuery.trim()) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, searchQuery]);

  // Keyboard shortcuts for search navigation
  useEffect(() => {
    if (!searchQuery.trim()) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
      }
      if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        navigateMatch(e.shiftKey ? 'prev' : 'next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, navigateMatch]);

  const copyLogs = () => {
    const text = logs.map(l => `[${new Date(l.timestamp * 1000).toLocaleTimeString()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success("Logs copied");
  };

  const clearLogs = () => {
    setLogs([]);
    streamedOutputLogIndexRef.current = null;
    toast.success("Logs cleared");
  };

  const hasScreenshot = Boolean(screenshotUrl || screenshotBase64);
  const currentScreenshotSrc = screenshotUrl || (screenshotBase64 ? `data:image/jpeg;base64,${screenshotBase64}` : '');

  // Styling for maximized state
  const containerClasses = isMaximized
    ? "fixed inset-4 z-50 flex flex-col bg-white dark:bg-gray-950 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200"
    : "flex flex-col bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 h-[650px] shadow-sm overflow-hidden transition-all duration-200";

  return (
    <>
      <div className={containerClasses}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm select-none">
          <div className="flex items-center gap-4">
            <div className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border
              ${status === 'streaming' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' : ''}
              ${status === 'completed' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' : ''}
              ${status === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800' : ''}
              ${status === 'connecting' ? 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' : ''}
            `}>
              {status === 'streaming' && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  Running
                </>
              )}
              {status === 'completed' && <><FiCheckCircle /> Completed</>}
              {status === 'error' && <><FiAlertCircle /> Error</>}
              {status === 'connecting' && <span>Connecting...</span>}
            </div>
            
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
            
            <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {logs.length} events
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* View Switcher */}
            <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
               <button 
                 onClick={() => setViewMode('split')}
                 className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                   viewMode === 'split' 
                     ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-black/5' 
                     : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                 }`}
                 title="Split View"
               >
                 <FiLayout className="w-3.5 h-3.5" />
                 Split
               </button>
               <button 
                 onClick={() => setViewMode('terminal')}
                 className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                   viewMode === 'terminal'
                     ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-black/5' 
                     : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                 }`}
                 title="Terminal Only"
               >
                 <FiSidebar className="w-3.5 h-3.5" />
                 Console
               </button>
               <button 
                 onClick={() => setViewMode('preview')}
                 className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                   viewMode === 'preview'
                     ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-black/5' 
                     : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                 }`}
                 title="Preview Only"
               >
                 <FiImage className="w-3.5 h-3.5" />
                 Preview
               </button>
            </div>

            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
               <button
                 onClick={() => setIsMaximized(!isMaximized)}
                 className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                 title={isMaximized ? "Minimize" : "Maximize"}
               >
                 {isMaximized ? <FiMinimize2 className="w-4 h-4" /> : <FiMaximize2 className="w-4 h-4" />}
               </button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          {/* Logs Panel */}
          <div className={`flex flex-col min-w-0 transition-all duration-300 ease-in-out bg-[#0d1117] ${
              viewMode === 'split' ? 'w-1/2 border-r border-gray-800' : 
              viewMode === 'terminal' ? 'w-full' : 'hidden'
          }`}>
             {/* Console Toolbar */}
             <div className="flex flex-col gap-2 px-3 py-2 bg-[#161b22] border-b border-gray-800 text-xs select-none">
               <div className="flex items-center justify-between">
                 <span className="font-mono font-semibold text-gray-400 flex items-center gap-2">
                   <FiTerminal /> Console Output
                 </span>
                 <div className="flex items-center gap-1">
                   <button 
                      onClick={() => setAutoScroll(!autoScroll)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${autoScroll ? 'text-green-400 bg-green-900/20' : 'text-gray-500 hover:text-gray-300'}`}
                   >
                     {autoScroll ? <FiPlay className="w-3 h-3" /> : <FiPause className="w-3 h-3" />}
                     Auto-scroll
                   </button>
                   <div className="w-px h-3 bg-gray-700 mx-1" />
                   <button onClick={copyLogs} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Copy Logs">
                     <FiCopy className="w-3.5 h-3.5" />
                   </button>
                   <button onClick={clearLogs} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors" title="Clear Logs">
                     <FiTrash2 className="w-3.5 h-3.5" />
                   </button>
                 </div>
               </div>
               
               {/* Search Bar */}
               <div className="flex items-center gap-2">
                 <div className="relative flex-1">
                   <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                   <input
                     type="text"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     placeholder="Search logs..."
                     className="w-full pl-8 pr-8 py-1.5 bg-[#0d1117] border border-gray-700 rounded text-gray-200 placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                   />
                   {searchQuery && (
                     <button
                       onClick={() => setSearchQuery("")}
                       className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-300 rounded"
                       title="Clear search"
                     >
                       <FiX className="w-3.5 h-3.5" />
                     </button>
                   )}
                 </div>
                 {searchQuery.trim() && matchingIndices.length > 0 && (
                   <div className="flex items-center gap-1 text-gray-500">
                     <button
                       onClick={() => navigateMatch('prev')}
                       className="px-2 py-1 hover:bg-white/10 rounded transition-colors"
                       title="Previous match (Shift+Enter)"
                     >
                       ↑
                     </button>
                     <span className="text-[10px] min-w-[45px] text-center">
                       {currentMatchIndex + 1}/{matchingIndices.length}
                     </span>
                     <button
                       onClick={() => navigateMatch('next')}
                       className="px-2 py-1 hover:bg-white/10 rounded transition-colors"
                       title="Next match (Enter)"
                     >
                       ↓
                     </button>
                   </div>
                 )}
                 {searchQuery.trim() && matchingIndices.length === 0 && (
                   <span className="text-[10px] text-gray-500">No matches</span>
                 )}
               </div>
             </div>
             
             <div 
               ref={scrollRef}
               className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
             >
               <div className="space-y-0.5">
                 {(searchQuery.trim() ? filteredLogs : logs).map((log, i) => {
                   const originalIndex = logs.indexOf(log);
                   const isMatch = searchQuery.trim() ? matchingIndices.includes(originalIndex) : false;
                   const isCurrentMatch = isMatch && matchingIndices[currentMatchIndex] === originalIndex;
                   
                   return (
                     <LogLine 
                       key={originalIndex} 
                       log={log} 
                       searchQuery={searchQuery}
                       isMatch={isMatch}
                       isCurrentMatch={isCurrentMatch}
                       index={originalIndex}
                       onRef={(el) => {
                         matchRefs.current[originalIndex] = el;
                       }}
                     />
                   );
                 })}
                 {logs.length === 0 && (
                   <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
                     <FiTerminal className="w-8 h-8 opacity-20" />
                     <span className="text-sm">Ready to connect...</span>
                   </div>
                 )}
                {logs.length > 0 && searchQuery.trim() && filteredLogs.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
                    <FiSearch className="w-8 h-8 opacity-20" />
                    <span className="text-sm">No logs match &quot;{searchQuery}&quot;</span>
                  </div>
                )}
               </div>
             </div>
             
             {error && (
               <div className="p-3 bg-red-900/20 border-t border-red-900/50 text-red-400 text-xs flex items-start gap-2 animate-in slide-in-from-bottom-2">
                 <FiAlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                 <span className="font-medium">{error}</span>
               </div>
             )}
          </div>

          {/* Screenshot Panel */}
          <div className={`flex flex-col transition-all duration-300 ease-in-out bg-gray-100 dark:bg-gray-900/50 ${
              viewMode === 'split' ? 'w-1/2' : 
              viewMode === 'preview' ? 'w-full' : 'hidden'
          }`}>
             <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs shadow-sm z-10">
               <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                 <FiImage className="text-gray-400" /> 
                 Latest Screenshot
               </div>
               {hasScreenshot && (
                 <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsPreviewOpen(true)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="Full Screen Preview"
                    >
                      <FiMaximize2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-1" />
                    <a 
                      href={currentScreenshotSrc}
                      download={`screenshot-${Date.now()}.jpg`}
                      className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Download"
                    >
                      <FiDownload className="w-3.5 h-3.5" />
                    </a>
                    <a 
                      href={currentScreenshotSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Open in new tab"
                    >
                      <FiExternalLink className="w-3.5 h-3.5" />
                    </a>
                 </div>
               )}
             </div>
             
             <div className="flex-1 flex items-center justify-center p-6 overflow-hidden relative group bg-gray-50/50 dark:bg-black/20">
               {hasScreenshot ? (
                 <div 
                    className="relative w-full h-full flex items-center justify-center cursor-zoom-in"
                    onClick={() => setIsPreviewOpen(true)}
                  >
                    <div className="absolute inset-0 pattern-dots opacity-5 pointer-events-none" />
                    <img 
                      src={currentScreenshotSrc}
                      alt="Screenshot" 
                      className="max-w-full max-h-full object-contain shadow-xl rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all hover:scale-[1.01]"
                    />
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                      <div className="bg-black/75 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm transform translate-y-2 group-hover:translate-y-0 transition-transform">
                        Click to enlarge
                      </div>
                    </div>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-4 select-none">
                   <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center border border-dashed border-gray-200 dark:border-gray-700">
                      <FiImage className="w-8 h-8 opacity-50" />
                   </div>
                   <div className="text-center">
                     <p className="text-sm font-medium text-gray-500 dark:text-gray-500">No screenshot yet</p>
                     <p className="text-xs text-gray-400 mt-1">Screenshots will appear here during execution</p>
                   </div>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
      
      {/* Backdrop for Maximized Mode */}
      {isMaximized && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setIsMaximized(false)}
        />
      )}

      {/* Full Screen Image Preview */}
      <FullScreenPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        objectUrl={currentScreenshotSrc || undefined}
        fileName={`Screenshot-${new Date().toLocaleTimeString()}`}
        contentType="image/jpeg"
      />
    </>
  );
}
