import { authService } from "@/lib/auth";

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
      `${process.env.NEXT_PUBLIC_API_URL}/api/admin/jobs/${jobId}/logs?${params}`,
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
   * Stream logs via Server-Sent Events (SSE)
   * Polls the stream endpoint and calls callbacks for each log entry
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

    // Poll for logs every 1 second
    const pollInterval = setInterval(async () => {
      if (!isActive || signal?.aborted) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.append("since", lastTimestamp.toString());

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/jobs/${jobId}/logs/stream?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to stream logs: ${response.status}`);
        }

        const text = await response.text();
        if (!text.trim()) return;

        // Parse SSE format: "data: {...}\n\n"
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6)); // Remove "data: " prefix

            if (data.type === "log") {
              callbacks.onLog({
                timestamp: data.timestamp,
                level: data.level,
                message: data.message,
              });
              // Update last timestamp
              if (data.timestamp * 1000 > lastTimestamp) {
                lastTimestamp = data.timestamp * 1000;
              }
            } else if (data.type === "error") {
              callbacks.onError?.(data.message);
            } else if (data.type === "complete") {
              callbacks.onComplete?.();
              clearInterval(pollInterval);
              return;
            }
          } catch (e) {
            console.warn("Failed to parse SSE data:", line);
          }
        }
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
