import {
  LambdaClient,
  InvokeWithResponseStreamCommand,
} from "@aws-sdk/client-lambda";
import { env } from "../utils/env";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/errors";
import { Readable } from "stream";

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
        
        const { spawn } = require('child_process');
        const pythonProcess = spawn('python3', ['backend/worker/run_cua_local.py'], {
            cwd: process.cwd(), // Assumes running from root
            env: { ...process.env, PYTHONPATH: 'backend/worker' }
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
            // Optionally stream stderr as log event?
            // res.write(JSON.stringify({ type: 'log', level: 'error', message: data.toString(), timestamp: Date.now() / 1000 }) + "\n");
        });

        await new Promise<void>((resolve, reject) => {
            pythonProcess.on('close', (code: number) => {
                logger.info(`[CUA Local] Process exited with code ${code}`);
                res.end();
                resolve();
            });
            pythonProcess.on('error', (err: any) => {
                logger.error(`[CUA Local] Process error: ${err}`);
                res.end();
                reject(err);
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
              const chunk = Buffer.from(event.PayloadChunk.Payload).toString("utf-8");
              res.write(chunk);
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
                     fullBody += Buffer.from(event.PayloadChunk.Payload).toString("utf-8");
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

