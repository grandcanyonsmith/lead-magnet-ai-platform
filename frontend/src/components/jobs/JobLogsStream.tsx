"use client";

import { useEffect, useState, useRef } from "react";
import { jobLogsClient, type LogEntry } from "@/lib/api/jobLogs.client";
import { FiTerminal, FiX, FiCopy, FiTrash2, FiPlay, FiPause } from "react-icons/fi";
import toast from "react-hot-toast";

interface JobLogsStreamProps {
  jobId: string;
  enabled: boolean;
  onClose?: () => void;
}

/**
 * Component that streams shell executor logs for a job
 * Polls CloudWatch Logs and displays them in real-time
 */
export function JobLogsStream({
  jobId,
  enabled,
  onClose,
}: JobLogsStreamProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<number>(Date.now() - 300000);

  useEffect(() => {
    if (!enabled || !jobId) {
      setIsStreaming(false);
      return;
    }

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    // Start streaming logs
    jobLogsClient
      .streamLogs(
        jobId,
        {
          onLog: (log) => {
            setLogs((prev) => {
              // Avoid duplicates
              const exists = prev.some(
                (l) =>
                  l.timestamp === log.timestamp &&
                  l.message === log.message
              );
              if (exists) return prev;
              return [...prev, log];
            });
            lastTimestampRef.current = log.timestamp * 1000;
          },
          onError: (error) => {
            console.error("[JobLogsStream] Error:", error);
            toast.error(`Log streaming error: ${error}`);
          },
          onComplete: () => {
            setIsStreaming(false);
          },
        },
        abortControllerRef.current.signal
      )
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("[JobLogsStream] Stream error:", error);
        }
      });

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsStreaming(false);
    };
  }, [enabled, jobId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const copyLogs = () => {
    const text = logs
      .map((l) => `[${new Date(l.timestamp * 1000).toLocaleTimeString()}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Logs copied to clipboard");
  };

  const clearLogs = () => {
    setLogs([]);
    toast.success("Logs cleared");
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              isStreaming
                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
            }`}
          >
            {isStreaming && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Streaming
              </>
            )}
            {!isStreaming && "Stopped"}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
            {logs.length} log{logs.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-xs ${
              autoScroll
                ? "text-green-600 dark:text-green-400"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll disabled"}
          >
            {autoScroll ? <FiPlay className="w-3 h-3" /> : <FiPause className="w-3 h-3" />}
            Auto-scroll
          </button>
          <button
            onClick={copyLogs}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="Copy logs"
          >
            <FiCopy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={clearLogs}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Clear logs"
          >
            <FiTrash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              title="Close"
            >
              <FiX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Logs */}
      <div
        ref={scrollRef}
        className="h-[400px] overflow-y-auto bg-[#0d1117] font-mono text-sm p-4 space-y-1"
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
            <FiTerminal className="w-8 h-8 opacity-20" />
            <span className="text-sm">Waiting for logs...</span>
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              className={`flex items-start gap-3 py-0.5 px-2 hover:bg-white/5 transition-colors ${
                log.level === "error"
                  ? "bg-red-500/10 text-red-300"
                  : log.level === "warn"
                  ? "bg-yellow-500/10 text-yellow-300"
                  : "text-gray-300"
              }`}
            >
              <div className="flex select-none text-gray-600 text-right w-[24px] shrink-0 opacity-50 text-xs">
                {index + 1}
              </div>
              <div className="flex gap-3 w-full">
                <span className="text-gray-500 select-none shrink-0 w-[60px] opacity-70 text-xs">
                  {new Date(log.timestamp * 1000).toLocaleTimeString([], {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <div className="break-all whitespace-pre-wrap w-full border-l border-gray-800 pl-3 min-h-[1.5em] text-xs">
                  {log.message}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
