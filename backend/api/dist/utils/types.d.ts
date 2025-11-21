/**
 * Shared utility types and interfaces.
 * Consolidates type definitions used across multiple utility modules.
 */
import { WorkflowStep as ResourceWorkflowStep, FormField as ResourceFormField } from '../types/resources';
/**
 * Re-export WorkflowStep from resources as the canonical definition.
 * This ensures consistency across all utility modules.
 */
export type WorkflowStep = ResourceWorkflowStep;
/**
 * Re-export FormField from resources as the canonical definition.
 */
export type FormField = ResourceFormField;
/**
 * Tool configuration for workflow steps.
 * Can be a simple string or a detailed configuration object.
 */
export type ToolConfig = string | {
    type: string;
    display_width?: number;
    display_height?: number;
    environment?: 'browser' | 'mac' | 'windows' | 'ubuntu';
    [key: string]: unknown;
};
/**
 * Tool choice options for workflow steps.
 */
export type ToolChoice = 'auto' | 'required' | 'none';
/**
 * Step type options for workflow steps.
 */
export type StepType = 'ai_generation' | 'webhook';
/**
 * Dependency graph structure for workflow execution planning.
 */
export interface DependencyGraph {
    steps: WorkflowStep[];
    dependencies: Map<number, number[]>;
    dependents: Map<number, number[]>;
}
/**
 * Execution group for parallel workflow step execution.
 */
export interface ExecutionGroup {
    groupIndex: number;
    stepIndices: number[];
    canRunInParallel: boolean;
}
/**
 * Execution plan containing grouped workflow steps.
 */
export interface ExecutionPlan {
    executionGroups: ExecutionGroup[];
    totalSteps: number;
}
/**
 * Step status for workflow execution tracking.
 */
export type StepStatus = 'completed' | 'running' | 'waiting' | 'ready';
/**
 * Validation result for workflow steps.
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
/**
 * Settings object structure for brand context building.
 */
export interface BrandSettings {
    organization_name?: string;
    industry?: string;
    company_size?: string;
    brand_description?: string;
    brand_voice?: string;
    target_audience?: string;
    company_values?: string;
    brand_messaging_guidelines?: string;
    website_url?: string;
    [key: string]: unknown;
}
/**
 * Retry configuration options.
 */
export interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryableErrors?: (error: unknown) => boolean;
}
/**
 * Timeout configuration options.
 */
export interface TimeoutOptions {
    timeoutMs: number;
    errorMessage?: string;
}
/**
 * Async operation result wrapper.
 */
export interface AsyncResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
}
//# sourceMappingURL=types.d.ts.map