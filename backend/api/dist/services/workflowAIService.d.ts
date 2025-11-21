import OpenAI from 'openai';
import { WorkflowStep } from '../utils/workflowMigration';
export interface WorkflowAIEditRequest {
    userPrompt: string;
    workflowContext: {
        workflow_id: string;
        workflow_name: string;
        workflow_description: string;
        template_id?: string;
        current_steps: WorkflowStep[];
    };
}
export interface WorkflowAIEditResponse {
    workflow_name?: string;
    workflow_description?: string;
    steps: WorkflowStep[];
    changes_summary: string;
}
export declare class WorkflowAIService {
    private openaiClient;
    constructor(openaiClient: OpenAI);
    editWorkflow(request: WorkflowAIEditRequest): Promise<WorkflowAIEditResponse>;
}
//# sourceMappingURL=workflowAIService.d.ts.map