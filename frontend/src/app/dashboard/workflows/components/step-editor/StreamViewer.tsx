"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  FiTerminal,
  FiImage,
  FiCheckCircle,
  FiAlertCircle,
  FiMaximize2,
  FiMinimize2,
  FiCopy,
  FiExternalLink,
  FiDownload,
  FiTrash2,
  FiPlay,
  FiPause,
  FiSearch,
  FiX,
  FiArrowDown
} from "react-icons/fi";
import { authService } from "@/lib/auth";
import toast from "react-hot-toast";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import { PanelHeader } from "@/components/ui/PanelHeader";

import { StepMetaRow } from "@/components/jobs/StepMetaRow";
import { MergedStep } from "@/types/job";

interface StreamViewerProps {
  endpoint: string;
  requestBody: any;
  onClose: () => void;
  onUpdateSettings?: (updates: any) => void;
}

interface LogEntry {
  timestamp: number;
  message: string;
  level: string;
  type: string;
}

const OUTPUT_DELTA_PREFIX = "__OUTPUT_DELTA__";

type LogLevelFilter = "all" | "info" | "warn" | "error";

const formatTimestamp = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0s";
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};

const ERROR_TOKENS = [
  "error",
  "failed",
  "exception",
  "traceback",
  "fatal",
  "panic",
  "stderr",
];
const WARN_TOKENS = ["warn", "warning", "⚠️"];

const getLogLevelBucket = (
  log: Pick<LogEntry, "level" | "message">,
): Exclude<LogLevelFilter, "all"> => {
  const levelText = (log.level || "").toLowerCase();
  const messageText = (log.message || "").toLowerCase();

  if (ERROR_TOKENS.some((token) => messageText.includes(token))) return "error";
  if (WARN_TOKENS.some((token) => messageText.includes(token))) return "warn";
  if (levelText.includes("error")) return "error";
  if (levelText.includes("warn")) return "warn";
  return "info";
};

const matchesLevel = (log: LogEntry, filterLevel: LogLevelFilter) => {
  if (filterLevel === "all") return true;
  return getLogLevelBucket(log) === filterLevel;
};

const matchesSearch = (log: LogEntry, query: string) => {
  const timestamp = formatTimestamp(log.timestamp).toLowerCase();
  return (
    log.message.toLowerCase().includes(query) ||
    log.level.toLowerCase().includes(query) ||
    timestamp.includes(query)
  );
};

const formatLogLine = (log: LogEntry) =>
  `[${formatTimestamp(log.timestamp)}] [${getLogLevelBucket(log).toUpperCase()}] ${log.message}`;

// -----------------------------------------------------------------------------
// Log Line Component
// -----------------------------------------------------------------------------

import { formatLogMessage } from "./LogFormatter";

function LogLine({
  log,
  searchQuery,
  isMatch,
  isCurrentMatch,
  index,
  onRef,
  showLineNumbers,
  showTimestamps,
  wrapLines,
}: { 
  log: LogEntry; 
  searchQuery: string;
  isMatch: boolean;
  isCurrentMatch: boolean;
  index: number;
  onRef: (el: HTMLDivElement | null) => void;
  showLineNumbers: boolean;
  showTimestamps: boolean;
  wrapLines: boolean;
}) {
  const levelBucket = getLogLevelBucket(log);
  const levelTextClass =
    levelBucket === "error"
      ? "text-red-300"
      : levelBucket === "warn"
      ? "text-yellow-300"
      : "text-gray-300";
  const levelBadgeClass =
    levelBucket === "error"
      ? "border-red-700/70 text-red-200 bg-red-900/30"
      : levelBucket === "warn"
      ? "border-yellow-700/70 text-yellow-200 bg-yellow-900/20"
      : "border-gray-700 text-gray-300 bg-white/5";
  const levelLabel = levelBucket === "error" ? "ERR" : levelBucket === "warn" ? "WRN" : "INF";

  // Detect Shell Input/Output
  const isShellInput = log.message.startsWith("💻");
  const isShellOutput = log.message.startsWith("📤");
  const isShellError = log.message.startsWith("⚠️");

  // Strip prefixes for display if it's shell input/output
  const displayMessage = (isShellInput || isShellOutput || isShellError) 
    ? log.message.substring(2).trim() 
    : log.message;

  // If searching, use the highlighter logic
  const content = useMemo(() => {
    if (searchQuery && isMatch) {
      const parts = displayMessage.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      return (
        <span className={levelTextClass}>
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
      <div className={levelTextClass}>
        {formatLogMessage(displayMessage)}
      </div>
    );
  }, [displayMessage, searchQuery, isMatch, isCurrentMatch, levelTextClass]);

  // Determine background class based on type
  let bgClass = "";
  if (log.level === 'error') bgClass = "bg-red-500/10";
  else if (log.level === 'warn') bgClass = "bg-yellow-500/10";
  else if (isShellInput) bgClass = "bg-blue-900/20 border-l-2 border-blue-500/50";
  else if (isShellOutput) bgClass = "bg-emerald-900/10 border-l-2 border-emerald-500/30";
  else if (isShellError) bgClass = "bg-red-900/10 border-l-2 border-red-500/30";
  
  if (isCurrentMatch) bgClass = "bg-blue-500/40";
  else if (isMatch && !isCurrentMatch) bgClass = "bg-yellow-500/20";

  return (
    <div 
      ref={onRef}
      className={`
        flex items-start gap-3 py-0.5 px-4 hover:bg-white/5 transition-colors font-mono text-[13px] leading-6 group
        ${bgClass}
      `}
    >
      <div className="flex gap-3 w-full">
        <div className="flex items-start gap-3 shrink-0">
          {showLineNumbers && (
            <div className="flex select-none text-gray-600 text-right w-[28px] opacity-50 group-hover:opacity-100 transition-opacity">
              {index + 1}
            </div>
          )}
          {showTimestamps && (
            <span className="text-gray-500 select-none shrink-0 w-[64px] opacity-70">
              {formatTimestamp(log.timestamp)}
            </span>
          )}
          <span className={`text-[10px] uppercase tracking-[0.1em] border px-1.5 py-0.5 rounded ${levelBadgeClass}`}>
            {levelLabel}
          </span>
        </div>
        <div
          className={`w-full border-l border-gray-800 pl-3 min-h-[1.5em] ${
            wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
          }`}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function StreamViewer({ endpoint, requestBody, onClose, onUpdateSettings }: StreamViewerProps) {
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
  const [filterLevel, setFilterLevel] = useState<LogLevelFilter>("all");
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const matchRefs = useRef<(HTMLDivElement | null)[]>([]);
  const streamedOutputLogIndexRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const logCounts = useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        acc.all += 1;
        const bucket = getLogLevelBucket(log);
        acc[bucket] += 1;
        return acc;
      },
      { all: 0, info: 0, warn: 0, error: 0 }
    );
  }, [logs]);

  const levelFilteredLogs = useMemo(() => {
    if (filterLevel === "all") return logs;
    return logs.filter((log) => matchesLevel(log, filterLevel));
  }, [logs, filterLevel]);

  // Filter logs based on level + search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return levelFilteredLogs;
    const query = searchQuery.toLowerCase();
    return levelFilteredLogs.filter((log) => matchesSearch(log, query));
  }, [levelFilteredLogs, searchQuery]);

  // Find all matching log indices
  const matchingIndices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return logs
      .map((log, index) => ({ log, index }))
      .filter(({ log }) => 
        matchesLevel(log, filterLevel) && matchesSearch(log, query)
      )
      .map(({ index }) => index);
  }, [logs, filterLevel, searchQuery]);

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

  // Reset current match index when search or filters change
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery, filterLevel]);

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

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    setAutoScroll(true);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceFromBottom <= 12;

    if (atBottom && !autoScroll) {
      setAutoScroll(true);
      return;
    }

    if (!atBottom && autoScroll) {
      setAutoScroll(false);
    }
  }, [autoScroll]);

  // Keyboard shortcuts for search navigation
  useEffect(() => {
    if (!searchQuery.trim()) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
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
    if (!filteredLogs.length) {
      toast.error("No logs to copy");
      return;
    }
    const text = filteredLogs.map(formatLogLine).join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${filteredLogs.length} log${filteredLogs.length === 1 ? "" : "s"}`);
  };

  const downloadLogs = (format: "txt" | "json") => {
    if (!filteredLogs.length) {
      toast.error("No logs to download");
      return;
    }
    const content =
      format === "json"
        ? JSON.stringify(filteredLogs, null, 2)
        : filteredLogs.map(formatLogLine).join("\n");
    const blob = new Blob([content], {
      type: format === "json" ? "application/json" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `stream-logs-${timestamp}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    setLogs([]);
    streamedOutputLogIndexRef.current = null;
    toast.success("Logs cleared");
  };

  const hasScreenshot = Boolean(screenshotUrl || screenshotBase64);
  const currentScreenshotSrc = screenshotUrl || (screenshotBase64 ? `data:image/jpeg;base64,${screenshotBase64}` : '');
  const summaryText = useMemo(() => {
    if (!logs.length) return "No events yet";
    const base =
      filterLevel === "all" && !searchQuery.trim()
        ? `${logs.length} events`
        : `Showing ${filteredLogs.length} of ${logs.length}`;
    const lastLog = logs[logs.length - 1];
    const spanLabel =
      logs.length > 1
        ? `Span ${formatDuration(lastLog.timestamp - logs[0].timestamp)}`
        : null;
    const lastLabel = lastLog ? `Last ${formatTimestamp(lastLog.timestamp)}` : null;
    return [base, spanLabel, lastLabel].filter(Boolean).join(" | ");
  }, [logs, filterLevel, searchQuery, filteredLogs.length]);

  const fakeStep: MergedStep = useMemo(() => ({
    step_order: 1,
    step_type: "ai_generation",
    _status: status === "streaming" ? "in_progress" : status === "completed" ? "completed" : status === "error" ? "failed" : "pending",
    model: requestBody?.model,
    tools: requestBody?.tools,
    tool_choice: requestBody?.tool_choice,
    instructions: requestBody?.instructions,
    service_tier: requestBody?.service_tier,
    reasoning_effort: requestBody?.reasoning_effort,
    input: {
      ...requestBody?.params,
      input_text: requestBody?.input_text
    }
  } as unknown as MergedStep), [requestBody, status]);

  // Styling for maximized state
  const containerClasses = isMaximized
    ? "fixed inset-4 z-50 flex flex-col bg-white dark:bg-gray-950 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200"
    : "flex flex-col bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 h-[650px] shadow-sm overflow-hidden transition-all duration-200";

  return (
    <>
      <div className={containerClasses}>
        {/* Header */}
        <PanelHeader className="backdrop-blur-sm select-none">
          <div className="flex flex-col gap-2">
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
            <div className="w-full max-w-3xl">
              <StepMetaRow 
                step={fakeStep} 
                status={fakeStep._status} 
                canEdit={!!onUpdateSettings}
                onQuickUpdateStep={async (_, update) => {
                  if (onUpdateSettings) {
                    onUpdateSettings(update);
                  }
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
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
        </PanelHeader>

        <div className="flex flex-1 overflow-hidden relative">
          {/* Logs Panel */}
          <div className={`flex flex-col min-w-0 transition-all duration-300 ease-in-out bg-[#0d1117] ${
              viewMode === 'split' ? 'w-1/2 border-r border-gray-800' : 
              viewMode === 'terminal' ? 'w-full' : 'hidden'
          }`}>
             {/* Console Toolbar */}
             <div className="flex flex-col gap-3 px-3 py-2 bg-[#161b22] border-b border-gray-800 text-xs select-none">
               <div className="flex flex-wrap items-center justify-between gap-2">
                 <div className="flex items-center gap-3">
                   <span className="font-mono font-semibold text-gray-300 flex items-center gap-2">
                     <FiTerminal /> Console Output
                   </span>
                   <span className="text-[11px] text-gray-500">{summaryText}</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <button
                      onClick={() => setViewMode(viewMode === 'terminal' ? 'split' : 'terminal')}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                      title={viewMode === 'terminal' ? "Minimize Console" : "Maximize Console"}
                   >
                      {viewMode === 'terminal' ? <FiMinimize2 className="w-3.5 h-3.5" /> : <FiMaximize2 className="w-3.5 h-3.5" />}
                   </button>
                   <div className="w-px h-3 bg-gray-700 mx-1" />
                   <button 
                      onClick={() => setAutoScroll(!autoScroll)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${
                        autoScroll
                          ? "text-emerald-300 bg-emerald-900/20 border-emerald-800/70"
                          : "text-gray-400 border-gray-700 hover:text-gray-200 hover:border-gray-600"
                      }`}
                      title={autoScroll ? "Stick to bottom" : "Manual scroll"}
                   >
                     {autoScroll ? <FiPlay className="w-3 h-3" /> : <FiPause className="w-3 h-3" />}
                     {autoScroll ? "Stick to bottom" : "Manual scroll"}
                   </button>
                  {!autoScroll && (
                    <button
                      onClick={scrollToBottom}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
                      title="Jump to latest"
                    >
                      <FiArrowDown className="w-3 h-3" />
                      Jump to latest
                    </button>
                  )}
                   <div className="flex items-center gap-1 rounded-md border border-gray-700/70 bg-[#0d1117] px-1 py-0.5">
                     <button onClick={copyLogs} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Copy visible logs">
                       <FiCopy className="w-3.5 h-3.5" />
                     </button>
                     <button onClick={() => downloadLogs("txt")} className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Download visible logs (.txt)">
                       <FiDownload className="w-3.5 h-3.5" />
                       TXT
                     </button>
                     <button onClick={() => downloadLogs("json")} className="px-2 py-1 text-[11px] font-mono text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Download visible logs (.json)">
                       JSON
                     </button>
                     <button onClick={clearLogs} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors" title="Clear Logs">
                       <FiTrash2 className="w-3.5 h-3.5" />
                     </button>
                   </div>
                 </div>
               </div>
               
               <div className="flex flex-wrap items-center gap-2">
                 <div className="flex items-center gap-1">
                   {[
                     { value: "all", label: "All", count: logCounts.all, accent: "text-gray-300" },
                     { value: "info", label: "Info", count: logCounts.info, accent: "text-blue-300" },
                     { value: "warn", label: "Warn", count: logCounts.warn, accent: "text-yellow-300" },
                     { value: "error", label: "Error", count: logCounts.error, accent: "text-red-300" },
                   ].map((option) => (
                     <button
                       key={option.value}
                       onClick={() => setFilterLevel(option.value as LogLevelFilter)}
                       className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors ${
                         filterLevel === option.value
                           ? "border-blue-500/70 text-blue-200 bg-blue-500/10"
                           : "border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
                       }`}
                       title={`Show ${option.label.toLowerCase()} logs`}
                     >
                       <span className={option.accent}>{option.label}</span>
                       <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-300">
                         {option.count}
                       </span>
                     </button>
                   ))}
                 </div>

                 {/* Search Bar */}
                <div className="flex items-center gap-2 ml-auto">
                  <div className="flex items-center gap-1 rounded-md border border-gray-700 bg-[#0d1117] px-1 py-0.5 text-[11px] text-gray-400">
                    <span className="px-1 text-gray-500">View</span>
                    <button
                      onClick={() => setWrapLines((prev) => !prev)}
                      aria-pressed={wrapLines}
                      className={`px-2 py-1 rounded transition-colors ${
                        wrapLines ? "text-blue-200 bg-blue-500/10" : "text-gray-400 hover:text-gray-200"
                      }`}
                      title={wrapLines ? "Disable line wrapping" : "Enable line wrapping"}
                    >
                      Wrap
                    </button>
                    <button
                      onClick={() => setShowTimestamps((prev) => !prev)}
                      aria-pressed={showTimestamps}
                      className={`px-2 py-1 rounded transition-colors ${
                        showTimestamps ? "text-blue-200 bg-blue-500/10" : "text-gray-400 hover:text-gray-200"
                      }`}
                      title={showTimestamps ? "Hide timestamps" : "Show timestamps"}
                    >
                      Time
                    </button>
                    <button
                      onClick={() => setShowLineNumbers((prev) => !prev)}
                      aria-pressed={showLineNumbers}
                      className={`px-2 py-1 rounded transition-colors ${
                        showLineNumbers ? "text-blue-200 bg-blue-500/10" : "text-gray-400 hover:text-gray-200"
                      }`}
                      title={showLineNumbers ? "Hide line numbers" : "Show line numbers"}
                    >
                      Line #
                    </button>
                  </div>
                  <div className="relative min-w-[220px]">
                     <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                     <input
                      ref={searchInputRef}
                       type="text"
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       placeholder="Search logs, levels, timestamps..."
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
             </div>
             
             <div 
               ref={scrollRef}
              onScroll={handleScroll}
               className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
             >
               <div className="space-y-0.5">
                {filteredLogs.map((log) => {
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
                       showLineNumbers={showLineNumbers}
                       showTimestamps={showTimestamps}
                       wrapLines={wrapLines}
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
                {logs.length > 0 && filteredLogs.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
                    <FiSearch className="w-8 h-8 opacity-20" />
                    {searchQuery.trim() ? (
                      <span className="text-sm">No logs match &quot;{searchQuery}&quot;</span>
                    ) : (
                      <span className="text-sm">No {filterLevel === "all" ? "" : `${filterLevel} `}logs in view</span>
                    )}
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
                      onClick={() => setViewMode(viewMode === 'preview' ? 'split' : 'preview')}
                      className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title={viewMode === 'preview' ? "Split View" : "Expand Preview"}
                    >
                      {viewMode === 'preview' ? <FiMinimize2 className="w-3.5 h-3.5" /> : <FiMaximize2 className="w-3.5 h-3.5" />}
                    </button>
                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-1" />
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
                    <Image
                      src={currentScreenshotSrc}
                      alt="Screenshot"
                      fill
                      sizes="(min-width: 1024px) 70vw, 100vw"
                      className="object-contain shadow-xl rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all hover:scale-[1.01]"
                      unoptimized
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
