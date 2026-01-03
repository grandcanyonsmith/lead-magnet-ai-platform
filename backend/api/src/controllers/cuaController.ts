import {
  LambdaClient,
  InvokeWithResponseStreamCommand,
} from "@aws-sdk/client-lambda";
import { spawn } from "child_process";
import * as path from "path";
import { env } from "../utils/env";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/errors";

// Initialize Lambda Client
const lambdaClient = new LambdaClient({ region: env.awsRegion });

export class CUAController {
  /**
   * Execute CUA loop and stream results.
   */
  async execute(
    tenantId: string,
    body: any,
    res?: any, // Express response object for streaming
  ): Promise<any> {
    const {
      job_id,
      model,
      instructions,
      input_text,
      tools,
      tool_choice,
      params,
    } = body;

    logger.info("[CUAController] Starting CUA execution", {
      tenantId,
      jobId: job_id,
    });

    const payload = {
      tenant_id: tenantId,
      job_id,
      model,
      instructions,
      input_text,
      tools,
      tool_choice,
      params,
    };

    // If local dev, spawn the python worker directly
    if (env.isLocal) {
        if (!res) {
            throw new Error("Local execution requires response object for streaming");
        }
        
        // Resolve script path relative to CWD.
        // If CWD is backend/api (dev), go up to backend, then into worker.
        // If CWD is root (docker/prod), go into backend/worker.
        const isApiDir = process.cwd().endsWith('api');
        const workerScriptRelPath = isApiDir ? '../worker/run_cua_local.py' : 'backend/worker/run_cua_local.py';
        const scriptPath = path.resolve(process.cwd(), workerScriptRelPath);

        const pythonProcess = spawn('python3', [scriptPath], {
            cwd: process.cwd(), 
            env: { 
                ...process.env, 
                // Adjust PYTHONPATH based on CWD
                PYTHONPATH: isApiDir ? '../worker' : 'backend/worker' 
            }
        });

        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        // Write payload to stdin
        pythonProcess.stdin.write(JSON.stringify(payload));
        pythonProcess.stdin.end();

        // Pipe stdout to response
        pythonProcess.stdout.on('data', (data: any) => {
            res.write(data);
        });

        pythonProcess.stderr.on('data', (data: any) => {
            logger.error(`[CUA Local] Stderr: ${data}`);
        });

        // Register event handlers inside Promise executor to ensure they're set up immediately
        // Use a flag to prevent double resolution if both events fire
        await new Promise<void>((resolve) => {
            let resolved = false;
            const resolveOnce = () => {
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            };

            pythonProcess.on('close', (code: number) => {
                logger.info(`[CUA Local] Process exited with code ${code}`);
                if (!res.writableEnded) {
                    res.end();
                }
                resolveOnce();
            });

            pythonProcess.on('error', (err: any) => {
                logger.error(`[CUA Local] Process error: ${err}`);
                // If we haven't closed the stream yet, try to send error event
                try {
                    if (!res.writableEnded) {
                        res.write(JSON.stringify({ type: 'error', message: `Spawn error: ${err.message}` }) + "\n");
                        res.end();
                    }
                } catch (e) {
                    logger.error(`[CUA Local] Failed to write error to stream: ${e}`);
                }
                resolveOnce(); // Resolve promise to prevent server-local.js from catching and trying to send 500 response
            });
        });
        return;
    }

    // Remote execution (AWS Lambda)
    try {
      // Determine function name
      // TODO: Add CUA_LAMBDA_FUNCTION_NAME to env config
      const functionName = process.env.CUA_LAMBDA_FUNCTION_NAME || "leadmagnet-cua-worker";

      const command = new InvokeWithResponseStreamCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(payload),
      });

      const response = await lambdaClient.send(command);

      // Handle stream
      if (response.EventStream) {
        if (res) {
          // If we have Express response, pipe to it
          res.setHeader("Content-Type", "application/x-ndjson");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.flushHeaders();

          for await (const event of response.EventStream) {
            if (event.PayloadChunk) {
              const payload = event.PayloadChunk.Payload;
              if (payload) {
                const chunk = Buffer.from(payload).toString("utf-8");
                res.write(chunk);
              }
            }
            if (event.InvokeComplete) {
                // End of stream
            }
          }
          res.end();
          return; // Response handled
        } else {
            // If called internally without res, return full result (buffer)
            // This defeats the purpose of streaming but handles the call.
            let fullBody = "";
            for await (const event of response.EventStream) {
                 if (event.PayloadChunk) {
                     const payload = event.PayloadChunk.Payload;
                     if (payload) {
                         fullBody += Buffer.from(payload).toString("utf-8");
                     }
                 }
            }
            return JSON.parse(fullBody.split("\n").filter(Boolean).map(l => JSON.parse(l)).pop() || "{}"); // Crude approximation
        }
      } else {
          // Fallback if no stream
          logger.warn("[CUAController] No EventStream returned");
          return { error: "No stream returned" };
      }

    } catch (error: any) {
      logger.error("[CUAController] Execution failed", { error: error.message });
      throw new ApiError(`CUA Execution failed: ${error.message}`, 500);
    }
  }
}

export const cuaController = new CUAController();

