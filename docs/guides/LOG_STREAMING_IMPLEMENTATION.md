# Live Log Streaming Implementation

## Overview
Implemented real-time log streaming for shell executor commands. When a job is processing, users can see shell executor logs appear in real-time in the frontend.

## Architecture

### Backend (API)
- **Endpoint**: `GET /api/admin/jobs/:id/logs`
  - Returns recent logs as JSON
  - Supports `since` (timestamp) and `limit` query parameters
  - Filters logs by job ID from CloudWatch Logs

- **Endpoint**: `GET /api/admin/jobs/:id/logs/stream`
  - Returns logs in SSE (Server-Sent Events) format
  - Used for streaming (though API Gateway doesn't support true streaming, frontend polls this)

### Frontend
- **Component**: `JobLogsStream` (`frontend/src/components/jobs/JobLogsStream.tsx`)
  - Displays logs in a terminal-like interface
  - Auto-scrolls to show latest logs
  - Copy and clear functionality
  - Shows streaming status indicator

- **Client**: `JobLogsClient` (`frontend/src/lib/api/jobLogs.client.ts`)
  - Polls `/api/admin/jobs/:id/logs` every 1 second
  - Tracks seen logs to avoid duplicates
  - Updates timestamp to fetch only new logs

## How It Works

1. **Job starts processing** → Frontend detects `job.status === "processing"`
2. **JobLogsStream component mounts** → Starts polling for logs
3. **Backend queries CloudWatch Logs** → Filters logs containing job ID
4. **Logs stream to frontend** → Appear in real-time (1-2 second delay)
5. **Job completes** → Streaming stops automatically

## Files Created/Modified

### Backend
- ✅ `backend/api/src/controllers/jobLogsController.ts` - New controller
- ✅ `backend/api/src/routes/jobRoutes.ts` - Added log routes
- ✅ `backend/api/package.json` - Added `@aws-sdk/client-cloudwatch-logs`
- ✅ `infrastructure/lib/api-stack.ts` - Added CloudWatch Logs permissions

### Frontend
- ✅ `frontend/src/components/jobs/JobLogsStream.tsx` - New streaming component
- ✅ `frontend/src/lib/api/jobLogs.client.ts` - New API client
- ✅ `frontend/src/components/jobs/detail/JobExecutionTab.tsx` - Integrated streaming

## Log Filtering

The backend filters CloudWatch Logs by:
1. **Filter Pattern**: `"${jobId}"` (tries CloudWatch filter first)
2. **Client-side fallback**: If filter fails, fetches all logs and filters by:
   - `message.includes(jobId)`
   - `message.includes("job_id: ${jobId}")`
   - `message.includes("JOB_ID: ${jobId}")`

## Usage

When viewing a job detail page:
1. Navigate to a job with status "processing"
2. Go to the "Execution" tab
3. "Live Execution Logs" section appears automatically
4. Logs stream in real-time as shell commands execute
5. Logs stop when job completes

## Testing

1. Start a job that uses shell executor
2. Open job detail page
3. Navigate to Execution tab
4. Verify logs appear in "Live Execution Logs" section
5. Check that logs update every 1-2 seconds
6. Verify logs stop when job completes

## Notes

- **Latency**: 1-2 second delay due to CloudWatch Logs API + polling interval
- **Filtering**: Logs must contain job ID in the message (shell executor includes this)
- **Auto-stop**: Streaming stops when job status changes from "processing"
- **Permissions**: API Lambda needs CloudWatch Logs read permissions (already added)

## Future Improvements

1. **True SSE Streaming**: Use API Gateway HTTP API with response streaming
2. **WebSocket**: For even lower latency (< 100ms)
3. **Log Search**: Add search/filter functionality in the UI
4. **Log Export**: Export logs to file
5. **Log Levels**: Filter by error/warn/info levels
