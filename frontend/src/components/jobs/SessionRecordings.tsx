"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiActivity, FiClock, FiFilm, FiRefreshCw } from "react-icons/fi";
import {
  getJobRecordings,
  RecordingSession,
} from "@/lib/api/tracking.client";

interface SessionRecordingsProps {
  jobId: string;
}

export function SessionRecordings({ jobId }: SessionRecordingsProps) {
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
        const data = await getJobRecordings(jobId);
        if (!mounted) return;
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
        setSessionsError(null);

        // Auto-select the newest session
        const newest = data.sessions?.[0]?.session_id;
        setSelectedSessionId((prev) => prev || newest || null);
      } catch (err) {
        console.error("Failed to load session recordings:", err);
        if (!mounted) return;
        setSessionsError("Failed to load session recordings");
      } finally {
        if (mounted) setLoadingSessions(false);
      }
    }

    if (jobId) fetchSessions();
    return () => {
      mounted = false;
    };
  }, [jobId]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FiFilm className="w-5 h-5" />
          Session Replay
        </h3>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <FiRefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {playerError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {playerError}
        </div>
      )}

      {loadingSessions ? (
        <div className="flex items-center justify-center p-8 text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mr-3"></div>
          Loading sessions...
        </div>
      ) : sessionsError ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {sessionsError}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <FiActivity className="w-12 h-12 mb-3 opacity-50" />
          <p className="font-medium">No session recordings yet.</p>
          <p className="text-sm mt-2 opacity-75 text-center max-w-xl">
            Session recordings are captured via rrweb in the published lead magnet. Once visitors interact with the page,
            you’ll see sessions here to replay.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Session list */}
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
                      ? "border-primary-500 bg-primary-50 dark:bg-primary/10"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                      {s.session_id.slice(0, 14)}…
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {Array.isArray(s.parts) ? s.parts.length : 0} parts
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <FiClock className="w-3 h-3" />
                    {new Date(s.last_created_at).toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Player */}
          <div className="lg:col-span-2">
            {selectedSession ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                {loadingReplay ? (
                  <div className="flex items-center justify-center p-8 text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mr-3"></div>
                    Loading replay…
                  </div>
                ) : replayError ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                    {replayError}
                  </div>
                ) : replayEvents.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No replay events found for this session.
                  </div>
                ) : (
                  <div ref={playerRootRef} />
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                Select a session to replay.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
