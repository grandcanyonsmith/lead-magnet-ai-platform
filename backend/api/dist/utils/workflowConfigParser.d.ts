/**
 * Workflow Config Parser
 * Parses and validates workflow configuration from AI responses.
 *
 * Handles parsing of AI-generated workflow configurations, supporting both:
 * - New format: JSON with steps array
 * - Legacy format: JSON with research_instructions field
 *
 * @module workflowConfigParser
 */
import { WorkflowStep } from './types';
/**
 * Parsed workflow configuration result.
 */
export interface ParsedWorkflowConfig {
    workflow_name: string;
    workflow_description: string;
    steps: WorkflowStep[];
}
/**
 * Parse workflow configuration from AI response.
 *
 * Handles both new format (with steps array) and legacy format (with research_instructions).
 * Provides sensible defaults for missing fields and validates the structure.
 *
 * @param content - Raw content string from AI response (may contain JSON)
 * @param description - Default workflow description if not provided in content
 * @returns Parsed workflow configuration with validated steps
 *
 * @example
 * ```typescript
 * const config = parseWorkflowConfig(aiResponse, 'My workflow');
 * // Returns: { workflow_name: '...', workflow_description: '...', steps: [...] }
 * ```
 */
export declare function parseWorkflowConfig(content: string, description: string): ParsedWorkflowConfig;
//# sourceMappingURL=workflowConfigParser.d.ts.map