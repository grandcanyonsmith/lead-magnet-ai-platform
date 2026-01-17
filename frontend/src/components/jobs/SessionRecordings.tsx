"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiActivity, FiClock, FiFilm, FiRefreshCw } from "react-icons/fi";
import {
  getJobRecordings,
  RecordingSession,
} from "@/lib/api/tracking.client";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";

interface SessionRecordingsProps {
  jobId: string;
  onSessionsLoaded?: (count: number) => void;
  onSessionsLoadingChange?: (loading: boolean) => void;
}

export function SessionRecordings({
  jobId,
  onSessionsLoaded,
  onSessionsLoadingChange,
}: SessionRecordingsProps) {
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const selectedSession = useMemo(
    () => sessions.find((s) => s.session_id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [loadingReplay, setLoadingReplay] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [replayEvents, setReplayEvents] = useState<any[]>([]);

  const playerRootRef = useRef<HTMLDivElement | null>(null);

  async function loadStyleOnce(href: string) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  async function loadScriptOnce(src: string) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  useEffect(() => {
    let mounted = true;

    async function fetchSessions() {
      try {
        setLoadingSessions(true);
        onSessionsLoadingChange?.(true);
        const data = await getJobRecordings(jobId);
        if (!mounted) return;
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
        setSessionsError(null);
        onSessionsLoaded?.(Array.isArray(data.sessions) ? data.sessions.length : 0);

        // Auto-select the newest session
        const newest = data.sessions?.[0]?.session_id;
        setSelectedSessionId((prev) => prev || newest || null);
      } catch (err) {
        console.error("Failed to load session recordings:", err);
        if (!mounted) return;
        setSessionsError("Failed to load session recordings");
        onSessionsLoaded?.(0);
      } finally {
        if (mounted) {
          setLoadingSessions(false);
          onSessionsLoadingChange?.(false);
        }
      }
    }

    if (jobId) fetchSessions();
    return () => {
      mounted = false;
    };
  }, [jobId, onSessionsLoaded, onSessionsLoadingChange]);

  useEffect(() => {
    let cancelled = false;
    async function loadPlayer() {
      try {
        // rrweb-player provides playback UI around rrweb Replayer
        await loadStyleOnce(
          "https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/style.css",
        );
        await loadScriptOnce(
          "https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/index.js",
        );
        if (!cancelled) {
          setPlayerReady(true);
          setPlayerError(null);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setPlayerReady(false);
          setPlayerError("Failed to load replay player library");
        }
      }
    }
    loadPlayer();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadReplayEvents() {
      if (!selectedSession) return;
      try {
        setLoadingReplay(true);
        setReplayError(null);
        setReplayEvents([]);

        const parts = selectedSession.parts || [];
        const batches = await Promise.all(
          parts.map(async (p) => {
            const res = await fetch(p.recording_url);
            if (!res.ok) {
              throw new Error(`Failed to fetch recording part: ${res.status}`);
            }
            return await res.json();
          }),
        );

        const events = batches.flatMap((b) =>
          Array.isArray(b?.events) ? b.events : [],
        );

        // rrweb events include timestamp (ms). Sort to reconstruct the session.
        events.sort((a: any, b: any) => {
          const ta = typeof a?.timestamp === "number" ? a.timestamp : 0;
          const tb = typeof b?.timestamp === "number" ? b.timestamp : 0;
          return ta - tb;
        });

        if (!cancelled) setReplayEvents(events);
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setReplayError(
            err?.message || "Failed to load replay data for this session",
          );
        }
      } finally {
        if (!cancelled) setLoadingReplay(false);
      }
    }

    loadReplayEvents();
    return () => {
      cancelled = true;
    };
  }, [selectedSessionId, selectedSession]);

  useEffect(() => {
    if (!playerReady) return;
    if (!playerRootRef.current) return;
    if (!replayEvents || replayEvents.length === 0) return;

    const w = window as any;
    if (!w.rrwebPlayer) {
      setReplayError("Replay player not available in this environment");
      return;
    }

    // Reset and mount a fresh player instance
    playerRootRef.current.innerHTML = "";
    try {
      // eslint-disable-next-line no-new
      new w.rrwebPlayer({
        target: playerRootRef.current,
        props: {
          events: replayEvents,
          autoPlay: true,
        },
      });
    } catch (err: any) {
      console.error(err);
      setReplayError("Failed to initialize replay player");
    }
  }, [playerReady, replayEvents]);

  return (
    <SectionCard
      title="Session replay"
      description="Watch how visitors interacted with the published lead magnet."
      icon={<FiFilm className="h-5 w-5" />}
      actions={
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <FiRefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      }
    >
      {playerError && (
        <div className="p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
          {playerError}
        </div>
      )}

      {loadingSessions ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted-foreground mr-3"></div>
          Loading sessions...
        </div>
      ) : sessionsError ? (
        <div className="p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
          {sessionsError}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No session recordings yet"
          message="Session recordings are captured via rrweb in the published lead magnet. Once visitors interact with the page, you’ll see sessions here to replay."
          icon={<FiActivity className="h-6 w-6 text-gray-400" />}
          className="rounded-xl border border-dashed border-border bg-muted/30"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-2">
            {sessions.map((s) => {
              const selected = s.session_id === selectedSessionId;
              return (
                <button
                  key={s.session_id}
                  type="button"
                  onClick={() => setSelectedSessionId(s.session_id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selected
                      ? "border-primary-500 bg-primary/10"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs text-muted-foreground">
                      {s.session_id.slice(0, 14)}…
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {Array.isArray(s.parts) ? s.parts.length : 0} parts
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <FiClock className="w-3 h-3" />
                    {new Date(s.last_created_at).toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-2">
            {selectedSession ? (
              <div className="rounded-lg border border-border bg-card p-3">
                {loadingReplay ? (
                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted-foreground mr-3"></div>
                    Loading replay…
                  </div>
                ) : replayError ? (
                  <div className="p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                    {replayError}
                  </div>
                ) : replayEvents.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No replay events found for this session.
                  </div>
                ) : (
                  <div ref={playerRootRef} />
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground rounded-lg border border-dashed border-border">
                Select a session to replay.
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
