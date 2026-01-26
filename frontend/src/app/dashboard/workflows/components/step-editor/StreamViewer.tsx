"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { authService } from "@/lib/auth";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import {
  buildHtmlSrcDoc,
  extractHtmlFromMessage,
  formatDuration,
  formatElapsed,
  formatLogLine,
  formatTimestamp,
  getLogLevelBucket,
  LogEntry,
  LogLevelFilter,
  matchesLevel,
  matchesSearch,
  OUTPUT_DELTA_PREFIX,
  stripShellPrefix,
} from "./stream/utils";
import { StreamHeader } from "./stream/StreamHeader";
import { StreamConsole } from "./stream/StreamConsole";
import { StreamPreview } from "./stream/StreamPreview";
import { MergedStep } from "@/types/job";
import toast from "react-hot-toast";

interface StreamViewerProps {
  endpoint: string;
  requestBody: any;
  onClose: () => void;
  onUpdateSettings?: (updates: any) => void;
}

export default function StreamViewer({
  endpoint,
  requestBody,
  onClose,
  onUpdateSettings,
}: StreamViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "connecting" | "streaming" | "completed" | "error"
  >("connecting");
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [viewMode, setViewMode] = useState<"split" | "terminal" | "preview">(
    "split",
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [filterLevel, setFilterLevel] = useState<LogLevelFilter>("all");
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [elapsedMs, setElapsedMs] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const matchRefs = useRef<(HTMLDivElement | null)[]>([]);
  const streamedOutputLogIndexRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevStatusRef = useRef<typeof status>(status);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 640px)");
    if (media.matches) {
      setShowLineNumbers(false);
      setShowTimestamps(false);
      setWrapLines(true);
    }
  }, []);

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
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
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
        if (err.name === "AbortError") return;
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
    if (event.type === "log") {
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

      setLogs((prev) => [...prev, event]);
    } else if (event.type === "screenshot") {
      // Store both URL and base64 for fallback
      if (event.url) {
        setScreenshotUrl(event.url);
      }
      if (event.base64) {
        setScreenshotBase64(event.base64);
      }
      // Auto-switch to split view if a screenshot arrives and we are in terminal mode (optional UX choice)
      // setViewMode(prev => prev === 'terminal' ? 'split' : prev);
    } else if (event.type === "complete") {
      setLogs((prev) => [
        ...prev,
        {
          type: "log",
          timestamp: Date.now() / 1000,
          level: "info",
          message: "Stream completed.",
        },
      ]);
    } else if (event.type === "error") {
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
      { all: 0, info: 0, warn: 0, error: 0 },
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
  const navigateMatch = useCallback(
    (direction: "next" | "prev") => {
      if (matchingIndices.length === 0) return;
      setCurrentMatchIndex((prev) => {
        if (direction === "next") {
          return (prev + 1) % matchingIndices.length;
        } else {
          return (prev - 1 + matchingIndices.length) % matchingIndices.length;
        }
      });
    },
    [matchingIndices.length],
  );

  // Reset current match index when search or filters change
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery, filterLevel]);

  // Scroll to current match
  useEffect(() => {
    if (
      searchQuery.trim() &&
      matchingIndices.length > 0 &&
      matchRefs.current[matchingIndices[currentMatchIndex]]
    ) {
      matchRefs.current[matchingIndices[currentMatchIndex]]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
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

  const toggleExpandLog = useCallback((logIndex: number) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logIndex)) {
        next.delete(logIndex);
      } else {
        next.add(logIndex);
      }
      return next;
    });
  }, []);

  // Keyboard shortcuts for search navigation
  useEffect(() => {
    if (!searchQuery.trim()) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === "Enter" && (e.shiftKey || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        navigateMatch(e.shiftKey ? "prev" : "next");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, navigateMatch]);

  const copyLogs = () => {
    if (!filteredLogs.length) {
      toast.error("No logs to copy");
      return;
    }
    const text = filteredLogs.map(formatLogLine).join("\n");
    navigator.clipboard.writeText(text);
    toast.success(
      `Copied ${filteredLogs.length} log${filteredLogs.length === 1 ? "" : "s"}`,
    );
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

  const hasComputerUse = useMemo(() => {
    const tools = requestBody?.tools;
    if (!Array.isArray(tools)) return false;
    return tools.some(
      (tool: any) =>
        (typeof tool === "string" && tool === "computer_use_preview") ||
        (tool &&
          typeof tool === "object" &&
          tool.type === "computer_use_preview"),
    );
  }, [requestBody]);

  const hasScreenshot = Boolean(screenshotUrl || screenshotBase64);
  const currentScreenshotSrc =
    screenshotUrl ||
    (screenshotBase64 ? `data:image/jpeg;base64,${screenshotBase64}` : "");
  const htmlPreview = useMemo(() => {
    for (let i = logs.length - 1; i >= 0; i -= 1) {
      const candidate = extractHtmlFromMessage(
        stripShellPrefix(logs[i].message || ""),
      );
      if (candidate) return candidate;
    }
    return null;
  }, [logs]);
  const showHtmlPreview =
    Boolean(htmlPreview) && !hasScreenshot && !hasComputerUse;
  const htmlSrcDoc = useMemo(() => {
    if (!showHtmlPreview || !htmlPreview) return "";
    return buildHtmlSrcDoc(htmlPreview);
  }, [showHtmlPreview, htmlPreview]);
  const htmlObjectUrl = useMemo(() => {
    if (!showHtmlPreview || !htmlSrcDoc) return null;
    const blob = new Blob([htmlSrcDoc], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [showHtmlPreview, htmlSrcDoc]);
  useEffect(() => {
    if (!htmlObjectUrl) return;
    return () => {
      URL.revokeObjectURL(htmlObjectUrl);
    };
  }, [htmlObjectUrl]);
  const previewLabel = showHtmlPreview ? "HTML Preview" : "Latest Screenshot";
  const previewObjectUrl = showHtmlPreview
    ? htmlObjectUrl
    : currentScreenshotSrc;
  const previewFileName = showHtmlPreview
    ? "log-preview.html"
    : `screenshot-${Date.now()}.jpg`;
  const previewContentType = showHtmlPreview ? "text/html" : "image/jpeg";
  const elapsedLabel = useMemo(() => formatElapsed(elapsedMs), [elapsedMs]);
  const summaryMeta = useMemo(() => {
    if (!logs.length) {
      return {
        base: "No events yet",
        details: elapsedLabel ? `Elapsed ${elapsedLabel}` : "",
      };
    }
    const base =
      filterLevel === "all" && !searchQuery.trim()
        ? `${logs.length} events`
        : `Showing ${filteredLogs.length} of ${logs.length}`;
    const lastLog = logs[logs.length - 1];
    const spanLabel =
      logs.length > 1
        ? `Span ${formatDuration(lastLog.timestamp - logs[0].timestamp)}`
        : null;
    const lastLabel = lastLog
      ? `Last ${formatTimestamp(lastLog.timestamp)}`
      : null;
    const elapsedMeta = elapsedLabel ? `Elapsed ${elapsedLabel}` : null;
    const details = [elapsedMeta, spanLabel, lastLabel]
      .filter(Boolean)
      .join(" | ");
    return { base, details };
  }, [logs, filterLevel, searchQuery, filteredLogs.length, elapsedLabel]);

  const fakeStep: MergedStep = useMemo(
    () =>
      ({
        step_order: 1,
        step_type: "ai_generation",
        _status:
          status === "streaming"
            ? "in_progress"
            : status === "completed"
              ? "completed"
              : status === "error"
                ? "failed"
                : "pending",
        model: requestBody?.model,
        tools: requestBody?.tools,
        tool_choice: requestBody?.tool_choice,
        instructions: requestBody?.instructions,
        service_tier: requestBody?.service_tier,
        reasoning_effort: requestBody?.reasoning_effort,
        input: {
          ...requestBody?.params,
          input_text: requestBody?.input_text,
        },
      }) as unknown as MergedStep,
    [requestBody, status],
  );

  const isRunning = status === "connecting" || status === "streaming";

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;
    if (
      (status === "connecting" || status === "streaming") &&
      (prevStatus === "completed" || prevStatus === "error")
    ) {
      startTimeRef.current = Date.now();
      setElapsedMs(0);
    }
  }, [status]);

  useEffect(() => {
    if (requestBody?.job_id) {
      startTimeRef.current = null;
      setElapsedMs(0);
    }
  }, [requestBody?.job_id]);

  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
        setElapsedMs(0);
      }
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          if (startTimeRef.current) {
            setElapsedMs(Date.now() - startTimeRef.current);
          }
        }, 1000);
      }
      return;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (startTimeRef.current) {
      setElapsedMs(Date.now() - startTimeRef.current);
    }
  }, [isRunning]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Styling for maximized state
  const containerClasses = isMaximized
    ? "fixed inset-4 z-50 flex flex-col bg-white dark:bg-gray-950 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200"
    : "flex flex-col bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 h-[650px] shadow-sm overflow-hidden transition-all duration-200";

  return (
    <>
      <div className={containerClasses}>
        <StreamHeader
          status={status}
          logCount={logs.length}
          elapsedLabel={elapsedLabel}
          fakeStep={fakeStep}
          onUpdateSettings={onUpdateSettings}
          isMaximized={isMaximized}
          setIsMaximized={setIsMaximized}
        />

        <div className="flex flex-1 overflow-hidden relative">
          <StreamConsole
            viewMode={viewMode}
            setViewMode={setViewMode}
            summaryMeta={summaryMeta}
            autoScroll={autoScroll}
            setAutoScroll={setAutoScroll}
            scrollToBottom={scrollToBottom}
            copyLogs={copyLogs}
            downloadLogs={downloadLogs}
            clearLogs={clearLogs}
            filterLevel={filterLevel}
            setFilterLevel={setFilterLevel}
            logCounts={logCounts}
            wrapLines={wrapLines}
            setWrapLines={setWrapLines}
            showTimestamps={showTimestamps}
            setShowTimestamps={setShowTimestamps}
            showLineNumbers={showLineNumbers}
            setShowLineNumbers={setShowLineNumbers}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchInputRef={searchInputRef}
            matchingIndices={matchingIndices}
            currentMatchIndex={currentMatchIndex}
            navigateMatch={navigateMatch}
            scrollRef={scrollRef}
            handleScroll={handleScroll}
            filteredLogs={filteredLogs}
            logs={logs}
            error={error}
            toggleExpandLog={toggleExpandLog}
            expandedLogs={expandedLogs}
            matchRefs={matchRefs}
          />

          <StreamPreview
            viewMode={viewMode}
            setViewMode={setViewMode}
            previewLabel={previewLabel}
            previewObjectUrl={previewObjectUrl}
            setIsPreviewOpen={setIsPreviewOpen}
            previewFileName={previewFileName}
            showHtmlPreview={showHtmlPreview}
            htmlSrcDoc={htmlSrcDoc}
            hasScreenshot={hasScreenshot}
            currentScreenshotSrc={currentScreenshotSrc}
            hasComputerUse={hasComputerUse}
          />
        </div>
      </div>

      {/* Backdrop for Maximized Mode */}
      {isMaximized && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setIsMaximized(false)}
        />
      )}

      {/* Full Screen Preview */}
      <FullScreenPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        objectUrl={previewObjectUrl || undefined}
        fileName={previewFileName}
        contentType={previewContentType}
      />
    </>
  );
}
