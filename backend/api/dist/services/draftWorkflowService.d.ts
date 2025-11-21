/**
 * Draft Workflow Service
 * Handles saving AI-generated workflows as drafts
 */
import { WorkflowStep } from '../utils/workflowMigration';
export interface DraftWorkflowData {
    workflow_name: string;
    workflow_description?: string;
    steps: WorkflowStep[];
    template_id?: string;
    template_version?: number;
    form_fields_schema?: {
        fields: any[];
    };
}
/**
 * Save a generated workflow as a draft
 */
export declare function saveDraftWorkflow(tenantId: string, draftData: DraftWorkflowData, templateHtml?: string, templateName?: string, templateDescription?: string): Promise<{
    workflow_id: string;
    form_id: string | null;
}>;
//# sourceMappingURL=draftWorkflowService.d.ts.map