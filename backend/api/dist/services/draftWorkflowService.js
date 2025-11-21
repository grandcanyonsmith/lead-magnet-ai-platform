"use strict";
/**
 * Draft Workflow Service
 * Handles saving AI-generated workflows as drafts
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveDraftWorkflow = saveDraftWorkflow;
const ulid_1 = require("ulid");
const db_1 = require("../utils/db");
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
const formService_1 = require("./formService");
const workflowMigration_1 = require("../utils/workflowMigration");
const WORKFLOWS_TABLE = env_1.env.workflowsTable;
const formService = new formService_1.FormService();
/**
 * Save a generated workflow as a draft
 */
async function saveDraftWorkflow(tenantId, draftData, templateHtml, templateName, templateDescription) {
    if (!WORKFLOWS_TABLE) {
        throw new Error('WORKFLOWS_TABLE environment variable is not configured');
    }
    logger_1.logger.info('[Draft Workflow Service] Saving draft workflow', {
        tenantId,
        workflowName: draftData.workflow_name,
        stepsCount: draftData.steps?.length || 0,
    });
    // Ensure step_order is set for each step
    const workflowData = {
        ...draftData,
        steps: (0, workflowMigration_1.ensureStepDefaults)(draftData.steps || []),
    };
    const workflowId = `wf_${(0, ulid_1.ulid)()}`;
    const workflow = {
        workflow_id: workflowId,
        tenant_id: tenantId,
        workflow_name: workflowData.workflow_name,
        workflow_description: workflowData.workflow_description || '',
        steps: workflowData.steps,
        template_id: workflowData.template_id,
        template_version: workflowData.template_version || 0,
        status: 'draft', // Save as draft
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    await db_1.db.put(WORKFLOWS_TABLE, workflow);
    logger_1.logger.info('[Draft Workflow Service] Draft workflow saved', { workflowId });
    // Create template if HTML content is provided
    let templateId = null;
    if (templateHtml && templateHtml.trim()) {
        try {
            const { templatesController } = await Promise.resolve().then(() => __importStar(require('../controllers/templates')));
            const templateResult = await templatesController.create(tenantId, {
                template_name: templateName || `${workflowData.workflow_name} Template`,
                template_description: templateDescription || '',
                html_content: templateHtml,
                workflow_id: workflowId,
            });
            if (templateResult.body && templateResult.body.template_id) {
                templateId = templateResult.body.template_id;
                // Update workflow with template_id
                await db_1.db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
                    template_id: templateId,
                });
                logger_1.logger.info('[Draft Workflow Service] Template created and linked', {
                    workflowId,
                    templateId,
                });
            }
        }
        catch (error) {
            logger_1.logger.error('[Draft Workflow Service] Error creating template', {
                workflowId,
                error: error.message,
            });
            // Continue even if template creation fails
        }
    }
    // Auto-create form for the workflow if form fields are provided
    let formId = null;
    if (workflowData.form_fields_schema?.fields && workflowData.form_fields_schema.fields.length > 0) {
        try {
            formId = await formService.createFormForWorkflow(tenantId, workflowId, workflowData.workflow_name, workflowData.form_fields_schema.fields);
            // Update workflow with form_id
            await db_1.db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
                form_id: formId,
            });
            logger_1.logger.info('[Draft Workflow Service] Form created and linked', {
                workflowId,
                formId,
            });
        }
        catch (error) {
            logger_1.logger.error('[Draft Workflow Service] Error creating form', {
                workflowId,
                error: error.message,
            });
            // Continue even if form creation fails
        }
    }
    return {
        workflow_id: workflowId,
        form_id: formId,
    };
}
//# sourceMappingURL=draftWorkflowService.js.map