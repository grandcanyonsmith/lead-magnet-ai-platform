import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { LogEntry, LogLevelFilter, getLogLevelBucket, matchesLevel, matchesSearch, stripShellPrefix, extractHtmlFromMessage } from "./utils";
import { buildHtmlSrcDoc } from "@/app/dashboard/workflows/components/step-editor/LogFormatter";

interface UseStreamViewerProps {
  logs: LogEntry[];
  screenshotUrl?: string | null;
  screenshotBase64?: string | null;
  hasComputerUse?: boolean;
}

export function useStreamViewer({
  logs,
  screenshotUrl,
  screenshotBase64,
  hasComputerUse = false,
}: UseStreamViewerProps) {
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
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const matchRefs = useRef<(HTMLDivElement | null)[]>([]);

  const levelFilteredLogs = useMemo(() => {
    if (filterLevel === "all") return logs;
    return logs.filter((log) => matchesLevel(log, filterLevel));
  }, [logs, filterLevel]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return levelFilteredLogs;
    const query = searchQuery.toLowerCase();
    return levelFilteredLogs.filter((log) => matchesSearch(log, query));
  }, [levelFilteredLogs, searchQuery]);

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

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery, filterLevel]);

  useEffect(() => {
    if (searchQuery.trim() && matchingIndices.length > 0 && matchRefs.current[matchingIndices[currentMatchIndex]]) {
      matchRefs.current[matchingIndices[currentMatchIndex]]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentMatchIndex, matchingIndices, searchQuery]);

  useEffect(() => {
    if (autoScroll && scrollRef.current && !searchQuery.trim()) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, searchQuery]);

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

  const hasScreenshot = Boolean(screenshotUrl || screenshotBase64);
  const currentScreenshotSrc =
    screenshotUrl || (screenshotBase64 ? `data:image/jpeg;base64,${screenshotBase64}` : "");
  
  const htmlPreview = useMemo(() => {
    for (let i = logs.length - 1; i >= 0; i -= 1) {
      const candidate = extractHtmlFromMessage(stripShellPrefix(logs[i].message || ""));
      if (candidate) return candidate;
    }
    return null;
  }, [logs]);

  const showHtmlPreview = Boolean(htmlPreview) && !hasScreenshot && !hasComputerUse;
  
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
  const previewObjectUrl = showHtmlPreview ? htmlObjectUrl : currentScreenshotSrc;
  const previewFileName = showHtmlPreview
    ? "log-preview.html"
    : `screenshot-${Date.now()}.jpg`;
  const previewContentType = showHtmlPreview ? "text/html" : "image/jpeg";

  const hasPreview = hasScreenshot || showHtmlPreview;

  useEffect(() => {
    if (!hasPreview && viewMode !== "terminal") {
      setViewMode("terminal");
    }
  }, [hasPreview, viewMode]);

  return {
    viewMode,
    setViewMode,
    autoScroll,
    isMaximized,
    setIsMaximized,
    isPreviewOpen,
    setIsPreviewOpen,
    searchQuery,
    setSearchQuery,
    currentMatchIndex,
    filterLevel,
    setFilterLevel,
    showLineNumbers,
    setShowLineNumbers,
    showTimestamps,
    setShowTimestamps,
    wrapLines,
    setWrapLines,
    expandedLogs,
    toggleExpandLog,
    scrollRef,
    matchRefs,
    filteredLogs,
    matchingIndices,
    navigateMatch,
    handleScroll,
    hasScreenshot,
    currentScreenshotSrc,
    showHtmlPreview,
    htmlSrcDoc,
    previewLabel,
    previewObjectUrl,
    previewFileName,
    previewContentType,
  };
}
