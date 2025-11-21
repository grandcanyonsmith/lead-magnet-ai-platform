/**
 * Generate a URL-friendly slug from a workflow name
 */
export declare function generateSlug(name: string): string;
/**
 * Ensure name, email, and phone fields are always present in form fields
 */
export declare function ensureRequiredFields(fields: any[]): any[];
export declare class FormService {
    /**
     * Create a form for a workflow
     */
    createFormForWorkflow(tenantId: string, workflowId: string, workflowName: string, formFields?: any[]): Promise<string>;
    /**
     * Get the active form for a workflow
     */
    getFormForWorkflow(workflowId: string): Promise<any | null>;
    /**
     * Update form name when workflow name changes
     */
    updateFormName(workflowId: string, newWorkflowName: string): Promise<void>;
    /**
     * Soft delete all forms associated with a workflow
     */
    deleteFormsForWorkflow(workflowId: string): Promise<void>;
}
export declare const formService: FormService;
//# sourceMappingURL=formService.d.ts.map