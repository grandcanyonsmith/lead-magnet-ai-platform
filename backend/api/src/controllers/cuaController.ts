import {
  LambdaClient,
  InvokeCommand,
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
      // Determine function name (can be overridden via env var)
      const functionNameRaw = env.cuaLambdaFunctionName;
      // `$LATEST` is the implicit default; stripping avoids "Function not found" when users
      // mistakenly configure `...:function:NAME:$LATEST` as the function identifier.
      const functionName = functionNameRaw.replace(/:\\$LATEST$/, "");

      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(payload),
      });

      const response = await lambdaClient.send(command);

      const rawPayload = response.Payload
        ? Buffer.from(response.Payload).toString("utf-8")
        : "";

      if (response.FunctionError) {
        throw new Error(
          rawPayload || `Lambda invocation error: ${response.FunctionError}`,
        );
      }

      // The worker returns an API Gateway-like response: { statusCode, headers, body }
      // where `body` is NDJSON. Parse and forward just the body to clients.
      let ndjsonBody = rawPayload;
      try {
        const parsed = rawPayload ? JSON.parse(rawPayload) : null;
        if (parsed && typeof parsed === "object" && typeof parsed.body === "string") {
          ndjsonBody = parsed.body;
        }
      } catch {
        // If payload isn't JSON, fall back to raw
      }

      if (res) {
        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
        res.write(ndjsonBody);
        res.end();
        return;
      }

      // If called internally without res, return the last NDJSON object (best-effort).
      try {
        return JSON.parse(
          ndjsonBody
            .split("\n")
            .filter(Boolean)
            .map((l) => JSON.parse(l))
            .pop() || "{}",
        );
      } catch {
        return { raw: ndjsonBody };
      }

    } catch (error: any) {
      logger.error("[CUAController] Execution failed", { error: error.message });
      throw new ApiError(`CUA Execution failed: ${error.message}`, 500);
    }
  }
}

export const cuaController = new CUAController();

