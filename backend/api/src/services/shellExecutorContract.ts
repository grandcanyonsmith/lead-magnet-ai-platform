import { z } from "zod";

/**
 * Shell Executor Contract (Orchestrator <-> Fargate runner)
 *
 * This defines the *internal* JSON payloads exchanged between the API (orchestrator)
 * and the ECS task (executor) as described in the attached plan.
 *
 * Design goals:
 * - Executor does NOT require AWS credentials: it receives a presigned `result_put_url`
 *   and uploads the result JSON via HTTPS PUT.
 * - Output `output[]` mirrors OpenAI's `shell_call_output.output[]` shape so the
 *   orchestrator can forward it directly back to OpenAI.
 */

export const SHELL_EXECUTOR_CONTRACT_VERSION = "2025-12-18" as const;

/**
 * Output outcome matches OpenAI shell tool expectations.
 * - `exit`: command completed (exit_code may be non-zero)
 * - `timeout`: command exceeded its timeout budget
 */
export const shellCommandOutcomeSchema = z.union([
  z.object({
    type: z.literal("exit"),
    exit_code: z.number().int(),
  }),
  z.object({
    type: z.literal("timeout"),
  }),
]);

export type ShellCommandOutcome = z.infer<typeof shellCommandOutcomeSchema>;

/**
 * Single command output item. Mirrors OpenAI `shell_call_output.output[]`.
 */
export const shellCommandOutputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  outcome: shellCommandOutcomeSchema,
});

export type ShellCommandOutput = z.infer<typeof shellCommandOutputSchema>;

/**
 * Request payload passed to the executor task.
 *
 * Notes:
 * - `timeout_ms` applies per command (executor will enforce a hard cap internally).
 * - `max_output_length` is echoed back so the orchestrator can comply with the
 *   Responses API requirement to include it in `shell_call_output` when provided.
 */
export const shellExecutorJobRequestSchema = z.object({
  version: z.literal(SHELL_EXECUTOR_CONTRACT_VERSION),
  job_id: z.string().min(1),
  commands: z.array(z.string().min(1)).min(1),
  timeout_ms: z.number().int().positive().optional(),
  max_output_length: z.number().int().positive().optional(),
  result_put_url: z.string().url(),
  result_content_type: z.string().optional(),
});

export type ShellExecutorJobRequest = z.infer<
  typeof shellExecutorJobRequestSchema
>;

/**
 * Result JSON uploaded by the executor via presigned PUT.
 *
 * `output[]` is intentionally compatible with OpenAI `shell_call_output.output[]`.
 */
export const shellExecutorJobResultSchema = z.object({
  version: z.literal(SHELL_EXECUTOR_CONTRACT_VERSION),
  job_id: z.string().min(1),
  commands: z.array(z.string().min(1)).min(1).optional(),
  max_output_length: z.number().int().positive().optional(),
  output: z.array(shellCommandOutputSchema),
  meta: z
    .object({
      started_at: z.string().datetime().optional(),
      finished_at: z.string().datetime().optional(),
      duration_ms: z.number().int().nonnegative().optional(),
      runner: z.string().optional(),
    })
    .optional(),
});

export type ShellExecutorJobResult = z.infer<
  typeof shellExecutorJobResultSchema
>;
