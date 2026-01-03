import React, { useEffect, useState } from "react";
import { FiVideo, FiClock, FiCalendar } from "react-icons/fi";
import { getJobRecordings, SessionRecording } from "@/lib/api/tracking.client";

interface SessionRecordingsProps {
  jobId: string;
}

export function SessionRecordings({ jobId }: SessionRecordingsProps) {
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchRecordings() {
      try {
        setLoading(true);
        const data = await getJobRecordings(jobId);
        if (mounted) {
          setRecordings(data.recordings);
          setError(null);
        }
      } catch (err: any) {
        console.error("Failed to load recordings:", err);
        if (mounted) {
          setError("Failed to load recordings");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (jobId) {
      fetchRecordings();
    }

    return () => {
      mounted = false;
    };
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mr-3"></div>
        Loading recordings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
        {error}
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
        <FiVideo className="w-12 h-12 mb-3 opacity-50" />
        <p>No session recordings found for this job.</p>
        <p className="text-sm mt-2 opacity-75">
          Recordings appear here after using the &quot;Record video&quot; feature in the editor overlay.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <FiVideo className="w-5 h-5" />
        Session Recordings
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recordings.map((recording) => (
          <div 
            key={recording.event_id} 
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="aspect-video bg-black relative">
              <video 
                src={recording.recording_url} 
                controls 
                className="w-full h-full"
                preload="metadata"
              />
            </div>
            
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <FiCalendar className="w-3 h-3" />
                    {new Date(recording.created_at).toLocaleDateString()}
                    <span className="mx-1">•</span>
                    <FiClock className="w-3 h-3" />
                    {new Date(recording.created_at).toLocaleTimeString()}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={recording.session_id}>
                    Session: {recording.session_id.slice(0, 8)}...
                  </div>
                </div>
              </div>
              
              {recording.page_url && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate border-t border-gray-100 dark:border-gray-700 pt-2">
                  <span className="font-semibold">Source:</span> {new URL(recording.page_url).pathname}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
