import { authService } from "@/lib/auth";

// Use same API URL pattern as other clients
const API_URL = (() => {
  const envUrl = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (envUrl) return envUrl;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      // Typical local setup: Next.js on :3000, API on :3001.
      const origin = window.location.origin || "http://localhost:3000";
      return origin.replace(/:\d+$/, ":3001");
    }
  }

  return "https://czp5b77azd.execute-api.us-east-1.amazonaws.com";
})();

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
}

export interface LogsResponse {
  logs: LogEntry[];
  nextToken?: string;
  hasMore: boolean;
}

export class JobLogsClient {
  /**
   * Get recent logs for a job
   */
  async getLogs(
    jobId: string,
    since?: number,
    limit: number = 100
  ): Promise<LogsResponse> {
    const token = await authService.getIdToken();
    const params = new URLSearchParams();
    if (since) params.append("since", since.toString());
    if (limit) params.append("limit", limit.toString());

    const response = await fetch(
      `${API_URL}/api/admin/jobs/${jobId}/logs?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Stream logs via polling
   * Polls the logs endpoint every second and calls callbacks for new log entries
   */
  async streamLogs(
    jobId: string,
    callbacks: {
      onLog: (log: LogEntry) => void;
      onError?: (error: string) => void;
      onComplete?: () => void;
    },
    signal?: AbortSignal
  ): Promise<void> {
    const token = await authService.getIdToken();
    let lastTimestamp = Date.now() - 300000; // Start from 5 minutes ago
    let isActive = true;
    let seenLogIds = new Set<string>(); // Track seen logs to avoid duplicates

    // Poll for logs every 1 second
    const pollInterval = setInterval(async () => {
      if (!isActive || signal?.aborted) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.append("since", lastTimestamp.toString());
        params.append("limit", "100");

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const response = await fetch(
          `${apiUrl}/api/admin/jobs/${jobId}/logs?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch logs: ${response.status}`);
        }

        const data: LogsResponse = await response.json();

        // Process new logs
        for (const log of data.logs) {
          // Create unique ID for log entry
          const logId = `${log.timestamp}-${log.message.substring(0, 50)}`;
          
          if (!seenLogIds.has(logId)) {
            seenLogIds.add(logId);
            callbacks.onLog(log);
            
            // Update last timestamp
            if (log.timestamp * 1000 > lastTimestamp) {
              lastTimestamp = log.timestamp * 1000;
            }
          }
        }

        // If no more logs and job might be complete, check completion
        // (This would require checking job status separately)
        
      } catch (error: any) {
        if (error.name === "AbortError") {
          clearInterval(pollInterval);
          return;
        }
        callbacks.onError?.(error.message || "Failed to fetch logs");
      }
    }, 1000); // Poll every 1 second

    // Cleanup on abort
    signal?.addEventListener("abort", () => {
      isActive = false;
      clearInterval(pollInterval);
    });
  }
}

export const jobLogsClient = new JobLogsClient();
