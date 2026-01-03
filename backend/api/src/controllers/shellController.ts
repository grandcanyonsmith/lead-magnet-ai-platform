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

export class ShellController {
  /**
   * Execute Shell loop and stream results.
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

    logger.info("[ShellController] Starting Shell execution", {
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
        
        // Resolve script path relative to CWD (backend/api) to point to backend/worker/run_shell_local.py
        const scriptPath = path.resolve(process.cwd(), '../worker/run_shell_local.py');

        const pythonProcess = spawn('python3', [scriptPath], {
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
            logger.error(`[Shell Local] Stderr: ${data}`);
        });

        // Register event handlers inside Promise executor to ensure they're set up immediately
        await new Promise<void>((resolve) => {
            let resolved = false;
            const resolveOnce = () => {
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            };

            pythonProcess.on('close', (code: number) => {
                logger.info(`[Shell Local] Process exited with code ${code}`);
                if (!res.writableEnded) {
                    res.end();
                }
                resolveOnce();
            });

            pythonProcess.on('error', (err: any) => {
                logger.error(`[Shell Local] Process error: ${err}`);
                try {
                    if (!res.writableEnded) {
                        res.write(JSON.stringify({ type: 'error', message: `Spawn error: ${err.message}` }) + "\n");
                        res.end();
                    }
                } catch (e) {
                    logger.error(`[Shell Local] Failed to write error to stream: ${e}`);
                }
                resolveOnce();
            });
        });
        return;
    }

    // Remote execution (AWS Lambda)
    try {
      // Determine function name
      const functionNameRaw = env.shellLambdaFunctionName;
      // `$LATEST` is the implicit default; stripping avoids config mistakes like
      // `...:function:NAME:$LATEST` which can surface as "Function not found".
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

      // Worker returns { statusCode, headers, body } where body is NDJSON.
      let ndjsonBody = rawPayload;
      try {
        const parsed = rawPayload ? JSON.parse(rawPayload) : null;
        if (parsed && typeof parsed === "object" && typeof parsed.body === "string") {
          ndjsonBody = parsed.body;
        }
      } catch {
        // fall back to raw
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
      logger.error("[ShellController] Execution failed", { error: error.message });
      throw new ApiError(`Shell Execution failed: ${error.message}`, 500);
    }
  }
}

export const shellController = new ShellController();
