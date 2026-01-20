# Shell Executor Live Log Streaming

## Overview
Stream shell executor logs in real-time to the frontend when jobs are running. This enables users to see command output as it happens, similar to watching a terminal.

## Architecture Options

### Option 1: CloudWatch Logs Subscription Filter → Lambda → SSE API (Recommended)
**Best for:** Production, scalable, handles multiple concurrent streams

**Flow:**
1. CloudWatch Logs subscription filter watches `/aws/lambda/leadmagnet-shell-executor`
2. Logs are forwarded to a Lambda function
3. Lambda forwards to API Gateway SSE endpoint
4. Frontend connects via SSE (reuses existing `StreamViewer` component)

**Pros:**
- Real-time streaming (< 1 second latency)
- Handles multiple concurrent jobs
- Scales automatically
- No polling needed

**Cons:**
- Requires CloudWatch Logs subscription filter setup
- More complex infrastructure

### Option 2: API Endpoint with CloudWatch Logs Tail → SSE
**Best for:** Simpler setup, fewer moving parts

**Flow:**
1. API endpoint `/api/jobs/:jobId/logs/stream` tails CloudWatch Logs
2. Uses CloudWatch Logs `filter-log-events` with pagination
3. Streams logs via SSE to frontend
4. Frontend connects via existing `StreamViewer` component

**Pros:**
- Simpler setup
- Reuses existing API infrastructure
- Easy to test and debug

**Cons:**
- Slight delay (1-2 seconds) due to CloudWatch Logs API latency
- Requires polling CloudWatch Logs API

## Implementation: Option 2 (Simpler)

### Step 1: Create API Endpoint

Create `backend/api/src/controllers/jobLogsController.ts`:

```typescript
import { RouteResponse } from "../routes";
import { logger } from "../utils/logger";
import { env } from "../utils/env";
import { ApiError } from "../utils/errors";
import { CloudWatchLogsClient, FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";

const cloudwatchLogs = new CloudWatchLogsClient({ region: env.awsRegion });

export class JobLogsController {
  /**
   * Stream shell executor logs for a job via Server-Sent Events (SSE)
   */
  async streamLogs(
    tenantId: string,
    jobId: string,
    res: any // Express/API Gateway response object
  ): Promise<void> {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    const logGroupName = '/aws/lambda/leadmagnet-shell-executor';
    let nextToken: string | undefined;
    let lastSeenTimestamp = Date.now() - 60000; // Start from 1 minute ago
    let isActive = true;

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Streaming logs...' })}\n\n`);

    // Stream logs every 1 second
    const streamInterval = setInterval(async () => {
      if (!isActive) {
        clearInterval(streamInterval);
        return;
      }

      try {
        const command = new FilterLogEventsCommand({
          logGroupName,
          startTime: lastSeenTimestamp,
          filterPattern: `"${jobId}"`, // Filter logs containing job ID
          nextToken,
          limit: 100,
        });

        const response = await cloudwatchLogs.send(command);

        if (response.events && response.events.length > 0) {
          for (const event of response.events) {
            // Parse log message
            const logMessage = event.message || '';
            
            // Send log event to client
            res.write(`data: ${JSON.stringify({
              type: 'log',
              timestamp: event.timestamp ? event.timestamp / 1000 : Date.now() / 1000,
              level: this._parseLogLevel(logMessage),
              message: logMessage,
            })}\n\n`);

            // Update last seen timestamp
            if (event.timestamp && event.timestamp > lastSeenTimestamp) {
              lastSeenTimestamp = event.timestamp;
            }
          }

          nextToken = response.nextToken;
        }

        // Check if job is still running (you'd query DynamoDB here)
        // If job completed, send completion event and close stream
        // const job = await db.get(JOBS_TABLE, { job_id: jobId });
        // if (job && job.status !== 'processing') {
        //   res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        //   clearInterval(streamInterval);
        //   res.end();
        //   return;
        // }

      } catch (error: any) {
        logger.error('[JobLogsController] Error streaming logs', { error, jobId });
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: error.message || 'Failed to fetch logs',
        })}\n\n`);
      }
    }, 1000); // Poll every 1 second

    // Cleanup on client disconnect
    res.on('close', () => {
      isActive = false;
      clearInterval(streamInterval);
      res.end();
    });
  }

  private _parseLogLevel(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('error') || lower.includes('exception')) return 'error';
    if (lower.includes('warn') || lower.includes('warning')) return 'warn';
    return 'info';
  }
}

export const jobLogsController = new JobLogsController();
```

### Step 2: Add Route

Add to `backend/api/src/routes/jobRoutes.ts`:

```typescript
import { jobLogsController } from "../controllers/jobLogsController";

// Add route
router.get(
  "/jobs/:jobId/logs/stream",
  authenticate,
  async (req, res) => {
    const tenantId = req.user.tenant_id;
    const jobId = req.params.jobId;
    
    // Verify job belongs to tenant
    const job = await jobService.getJob(tenantId, jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    await jobLogsController.streamLogs(tenantId, jobId, res);
  }
);
```

### Step 3: Update Frontend to Use Streaming

Create `frontend/src/lib/api/jobLogs.client.ts`:

```typescript
import { authService } from "@/lib/auth";

export class JobLogsClient {
  async streamLogs(
    jobId: string,
    callbacks: {
      onLog: (log: { timestamp: number; level: string; message: string }) => void;
      onError?: (error: string) => void;
      onComplete?: () => void;
    },
    signal?: AbortSignal
  ): Promise<void> {
    const token = await authService.getIdToken();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}/logs/stream`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to stream logs: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is not readable");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim() || !line.startsWith("data: ")) continue;
        
        try {
          const data = JSON.parse(line.slice(6)); // Remove "data: " prefix
          
          if (data.type === 'log') {
            callbacks.onLog({
              timestamp: data.timestamp,
              level: data.level,
              message: data.message,
            });
          } else if (data.type === 'error') {
            callbacks.onError?.(data.message);
          } else if (data.type === 'complete') {
            callbacks.onComplete?.();
            return;
          }
        } catch (e) {
          console.warn("Failed to parse SSE data:", line);
        }
      }
    }
  }
}

export const jobLogsClient = new JobLogsClient();
```

### Step 4: Integrate into Job Detail Page

Update `frontend/src/components/jobs/detail/JobExecutionTab.tsx`:

```typescript
import { jobLogsClient } from "@/lib/api/jobLogs.client";
import StreamViewer from "@/app/dashboard/workflows/components/step-editor/StreamViewer";

// Add state for streaming
const [isStreaming, setIsStreaming] = useState(false);
const [streamEndpoint, setStreamEndpoint] = useState<string | null>(null);

// When job is processing, start streaming
useEffect(() => {
  if (job.status === 'processing' && !isStreaming) {
    setIsStreaming(true);
    setStreamEndpoint(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${job.job_id}/logs/stream`);
  } else if (job.status !== 'processing' && isStreaming) {
    setIsStreaming(false);
    setStreamEndpoint(null);
  }
}, [job.status, job.job_id, isStreaming]);

// Render StreamViewer when streaming
{isStreaming && streamEndpoint && (
  <StreamViewer
    endpoint={streamEndpoint}
    requestBody={{}}
    onClose={() => {
      setIsStreaming(false);
      setStreamEndpoint(null);
    }}
  />
)}
```

## Alternative: Option 1 (CloudWatch Subscription Filter)

For true real-time streaming with < 1 second latency:

1. Create Lambda function that receives CloudWatch Logs events
2. Forward logs to API Gateway WebSocket or SSE endpoint
3. Frontend connects to WebSocket/SSE endpoint

This requires:
- CloudWatch Logs subscription filter
- Lambda function to forward logs
- WebSocket API or SSE endpoint
- Connection management (tracking active streams)

## Testing

1. Start a job that uses shell executor
2. Open job detail page
3. Logs should stream in real-time
4. Verify logs appear as commands execute

## Notes

- CloudWatch Logs may have 1-2 second delay
- Logs are filtered by job ID (must be present in log message)
- Stream automatically closes when job completes
- Handles client disconnects gracefully
