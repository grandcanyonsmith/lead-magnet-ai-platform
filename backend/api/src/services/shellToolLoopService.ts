import OpenAI from "openai";
import { getOpenAIClient } from "./openaiService";
import { callResponsesWithTimeout } from "../utils/openaiHelpers";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/errors";
import { env } from "../utils/env";
import { runShellExecutorJob } from "./shellExecutorService";

type ShellCall = {
  call_id: string;
  action: {
    commands: string[];
    timeout_ms?: number;
    max_output_length?: number;
  };
};

function extractShellCalls(response: any): ShellCall[] {
  const output = (response as any)?.output;
  if (!Array.isArray(output)) return [];

  const calls: ShellCall[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    if (item.type === "shell_call" && item.call_id && item.action?.commands) {
      calls.push({
        call_id: String(item.call_id),
        action: {
          commands: Array.isArray(item.action.commands)
            ? item.action.commands.map(String)
            : [],
          timeout_ms: item.action.timeout_ms,
          max_output_length: item.action.max_output_length,
        },
      });
      continue;
    }

    // Some SDK versions represent tools as {type:"tool_call", tool_name:"shell", ...}
    if (item.type === "tool_call" && item.tool_name === "shell") {
      const action = item.action || item.arguments || item.data?.action;
      const commands = action?.commands;
      if (item.call_id && Array.isArray(commands)) {
        calls.push({
          call_id: String(item.call_id),
          action: {
            commands: commands.map(String),
            timeout_ms: action?.timeout_ms,
            max_output_length: action?.max_output_length,
          },
        });
      }
    }
  }
  return calls;
}

export type RunShellToolLoopArgs = {
  model?: string;
  instructions?: string;
  input: string;
  maxSteps?: number;
};

export type RunShellToolLoopResult = {
  responseId: string;
  outputText: string;
};

/**
 * Runs an OpenAI Responses tool loop with the `shell` tool enabled.
 * When the model emits `shell_call`, we execute via ECS Fargate and feed outputs back
 * via `shell_call_output` items until the model returns final text.
 */
export async function runShellToolLoop(
  args: RunShellToolLoopArgs,
): Promise<RunShellToolLoopResult> {
  if (!env.shellToolEnabled) {
    throw new ApiError("Shell tool is disabled", 404);
  }

  const model = (args.model || "gpt-5.1").trim() || "gpt-5.1";
  const maxSteps = Number.isFinite(args.maxSteps)
    ? Math.max(1, Math.min(25, Math.floor(args.maxSteps!)))
    : 10;
  const instructions =
    args.instructions ||
    "You may run shell commands to inspect the environment and gather information. Keep commands concise.";

  const openai: OpenAI = await getOpenAIClient();

  let response = await callResponsesWithTimeout(
    () =>
      openai.responses.create({
        model: model, // Explicitly pass the model variable
        instructions,
        input: args.input,
        tools: [{ type: "shell" }],
      } as any),
    "shell tool initial response",
  );

  for (let step = 0; step < maxSteps; step++) {
    const shellCalls = extractShellCalls(response);
    if (shellCalls.length === 0) {
      const outputText = (response as any).output_text || "";
      return {
        responseId: (response as any).id,
        outputText: String(outputText),
      };
    }

    logger.info("[ShellToolLoop] Executing shell calls", {
      step,
      callCount: shellCalls.length,
      responseId: (response as any).id,
    });

    const toolOutputs: any[] = [];
    for (const call of shellCalls) {
      const commands = call.action.commands || [];
      if (commands.length === 0) {
        toolOutputs.push({
          type: "shell_call_output",
          call_id: call.call_id,
          max_output_length: call.action.max_output_length,
          output: [
            {
              stdout: "",
              stderr: "No commands provided",
              outcome: { type: "exit", exit_code: 1 },
            },
          ],
        });
        continue;
      }

      // Execute via ECS and map result to OpenAI tool output format.
      // eslint-disable-next-line no-await-in-loop
      const result = await runShellExecutorJob({
        commands,
        timeoutMs: call.action.timeout_ms || 120000,
        maxOutputLength: call.action.max_output_length || 4096,
      });

      toolOutputs.push({
        type: "shell_call_output",
        call_id: call.call_id,
        max_output_length:
          result.max_output_length ?? call.action.max_output_length,
        output: result.output,
      });
    }

    response = await callResponsesWithTimeout(
      () =>
        openai.responses.create({
          previous_response_id: (response as any).id,
          input: toolOutputs,
        } as any),
      "shell tool follow-up response",
    );
  }

  throw new ApiError("Shell tool loop exceeded max steps", 500);
}
