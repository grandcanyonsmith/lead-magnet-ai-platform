"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiArrowDown, FiCopy, FiLoader, FiPause, FiPlay } from "react-icons/fi";
import { toast } from "sonner";
import { LiveOutputRenderer } from "./LiveOutputRenderer";

interface LiveOutputConsoleProps {
  value: string;
  statusLabel?: string | null;
  updatedAtLabel?: string | null;
  isStreaming?: boolean;
  truncated?: boolean;
  error?: string | null;
  emptyMessage?: string;
  className?: string;
  bodyHeightClassName?: string;
}

export function LiveOutputConsole({
  value,
  statusLabel,
  updatedAtLabel,
  isStreaming = true,
  truncated = false,
  error,
  emptyMessage,
  className,
  bodyHeightClassName = "max-h-80",
}: LiveOutputConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  const [hasUnseenUpdate, setHasUnseenUpdate] = useState(false);

  const hasValue = value.trim().length > 0;
  const lineCount = useMemo(() => {
    if (!hasValue) return 0;
    return value.split(/\r?\n/).length;
  }, [hasValue, value]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
    setIsFollowing(true);
    setHasUnseenUpdate(false);
  }, []);

  useEffect(() => {
    if (!hasValue) return;

    if (!isFollowing) {
      setHasUnseenUpdate(true);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom("auto");
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [hasValue, isFollowing, scrollToBottom, value]);

  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;

    const distanceFromBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight;
    const atBottom = distanceFromBottom <= 20;

    if (atBottom) {
      setIsFollowing(true);
      setHasUnseenUpdate(false);
      return;
    }

    if (isFollowing) {
      setIsFollowing(false);
    }
  }, [isFollowing]);

  const handleFollowToggle = useCallback(() => {
    if (isFollowing) {
      setIsFollowing(false);
      return;
    }

    scrollToBottom("smooth");
  }, [isFollowing, scrollToBottom]);

  const handleCopy = useCallback(async () => {
    if (!hasValue) {
      toast.error("No live output to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success("Live output copied");
    } catch {
      toast.error("Unable to copy live output");
    }
  }, [hasValue, value]);

  const emptyStateMessage =
    emptyMessage ||
    (isStreaming
      ? "Waiting for the first streamed event. Search, tool activity, and model output will appear here as they arrive."
      : "No live output was captured for this step.");

  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 ${className || ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-800/70 dark:bg-sky-900/30 dark:text-sky-200">
            {isStreaming ? (
              <FiLoader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            )}
            Live tail
          </span>
          {statusLabel && (
            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium capitalize text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {statusLabel}
            </span>
          )}
          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {hasValue ? `${lineCount} ${lineCount === 1 ? "line" : "lines"}` : "Awaiting output"}
          </span>
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-medium ${
              isFollowing
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
            }`}
          >
            {isFollowing ? "Following" : "Paused"}
          </span>
          {truncated && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
              Output truncated
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {updatedAtLabel && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Updated {updatedAtLabel}
            </span>
          )}
          <button
            type="button"
            onClick={handleFollowToggle}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {isFollowing ? (
              <FiPause className="h-3.5 w-3.5" />
            ) : (
              <FiPlay className="h-3.5 w-3.5" />
            )}
            {isFollowing ? "Pause tail" : "Follow tail"}
          </button>
          <button
            type="button"
            onClick={() => setWrapLines((current) => !current)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {wrapLines ? "No wrap" : "Wrap"}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <FiCopy className="h-3.5 w-3.5" />
            Copy
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={`relative min-h-[220px] overflow-auto bg-[#0b1020] ${bodyHeightClassName} scrollbar-hide-until-hover`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[#0b1020] to-transparent" />
          <div className="px-3 py-3">
            {hasValue ? (
              <LiveOutputRenderer
                value={value}
                className="space-y-3 text-[13px] leading-6 text-slate-100"
                textClassName={
                  wrapLines
                    ? "m-0 whitespace-pre-wrap break-words text-slate-100"
                    : "m-0 whitespace-pre text-slate-100"
                }
                ariaLive={isFollowing ? "polite" : "off"}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-4 py-6 text-sm leading-6 text-slate-400">
                {emptyStateMessage}
              </div>
            )}
          </div>
        </div>

        {hasUnseenUpdate && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-950/30 transition-transform hover:scale-[1.02] hover:bg-sky-400"
          >
            <FiArrowDown className="h-3.5 w-3.5" />
            Jump to latest
          </button>
        )}
      </div>

      {error && (
        <div className="border-t border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
}
