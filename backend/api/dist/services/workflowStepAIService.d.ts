import OpenAI from 'openai';
import { WorkflowStep } from '../utils/workflowMigration';
export interface AIStepGenerationRequest {
    userPrompt: string;
    action?: 'update' | 'add';
    workflowContext: {
        workflow_id: string;
        workflow_name: string;
        workflow_description: string;
        current_steps: Array<{
            step_name: string;
            step_description?: string;
            model: string;
            tools?: any[];
        }>;
    };
    currentStep?: WorkflowStep;
    currentStepIndex?: number;
}
export interface AIStepGenerationResponse {
    action: 'update' | 'add';
    step_index?: number;
    step: WorkflowStep;
}
export declare class WorkflowStepAIService {
    private openaiClient;
    constructor(openaiClient: OpenAI);
    generateStep(request: AIStepGenerationRequest): Promise<AIStepGenerationResponse>;
}
//# sourceMappingURL=workflowStepAIService.d.ts.map