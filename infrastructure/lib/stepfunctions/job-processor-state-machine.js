"use strict";
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
exports.createJobProcessorStateMachine = createJobProcessorStateMachine;
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const tasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const error_handlers_1 = require("./error-handlers");
/**
 * Creates the Step Functions state machine definition for job processing
 *
 * This state machine orchestrates the execution of workflow jobs, handling:
 * - Multi-step workflows with dependency resolution
 * - HTML generation for templates
 * - Error handling and job status updates
 *
 * Note: Legacy format is no longer supported. All workflows must use steps format.
 */
function createJobProcessorStateMachine(scope, props) {
    const { jobsTable, workflowsTable, jobProcessorLambda } = props;
    // Update job status to processing
    const updateJobStatus = new tasks.DynamoUpdateItem(scope, 'UpdateJobStatus', {
        table: jobsTable,
        key: {
            job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.job_id')),
        },
        updateExpression: 'SET #status = :status, updated_at = :updated_at',
        expressionAttributeNames: {
            '#status': 'status',
        },
        expressionAttributeValues: {
            ':status': tasks.DynamoAttributeValue.fromString('processing'),
            ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
        },
        resultPath: '$.updateResult',
    });
    // Create error handlers using helper functions
    const handleHtmlGenerationFailure = (0, error_handlers_1.createHtmlGenerationFailureHandler)(scope, jobsTable);
    const parseErrorLegacy = (0, error_handlers_1.createExceptionHandlerChain)(scope, 'ParseErrorLegacy', jobsTable, false);
    const parseErrorStep = (0, error_handlers_1.createExceptionHandlerChain)(scope, 'ParseErrorStep', jobsTable, true);
    // Initialize steps: Load workflow and get step count
    const initializeSteps = new tasks.DynamoGetItem(scope, 'InitializeSteps', {
        table: workflowsTable,
        key: {
            workflow_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.workflow_id')),
        },
        resultPath: '$.workflowData',
    });
    // Process a single step using Lambda function (declared early for use in setupStepLoop)
    const processStep = new tasks.LambdaInvoke(scope, 'ProcessStep', {
        lambdaFunction: jobProcessorLambda,
        payload: sfn.TaskInput.fromObject({
            'job_id': sfn.JsonPath.stringAt('$.job_id'),
            'step_index': sfn.JsonPath.numberAt('$.step_index'),
            'step_type': 'workflow_step',
        }),
        resultPath: '$.processResult',
        retryOnServiceExceptions: false,
    });
    // Add error handling for Lambda failures
    processStep.addCatch(parseErrorStep, {
        resultPath: '$.error',
        errors: ['States.ALL'],
    });
    // Process a single step for rerun (separate state to avoid "already has next" error)
    const processStepSingle = new tasks.LambdaInvoke(scope, 'ProcessStepSingle', {
        lambdaFunction: jobProcessorLambda,
        payload: sfn.TaskInput.fromObject({
            'job_id': sfn.JsonPath.stringAt('$.job_id'),
            'step_index': sfn.JsonPath.numberAt('$.step_index'),
            'step_type': 'workflow_step',
        }),
        resultPath: '$.processResult',
        retryOnServiceExceptions: false,
    });
    // Add error handling for Lambda failures
    processStepSingle.addCatch(parseErrorStep, {
        resultPath: '$.error',
        errors: ['States.ALL'],
    });
    // Process HTML generation step
    const processHtmlGeneration = new tasks.LambdaInvoke(scope, 'ProcessHtmlGeneration', {
        lambdaFunction: jobProcessorLambda,
        payload: sfn.TaskInput.fromObject({
            'job_id': sfn.JsonPath.stringAt('$.job_id'),
            'step_type': 'html_generation',
        }),
        resultPath: '$.htmlResult',
        retryOnServiceExceptions: false,
    });
    // Add error handling for HTML generation failures
    // Note: Use parseErrorLegacy (not parseErrorStep) because HTML generation
    // runs after all workflow steps are complete, so step_index is not in context
    processHtmlGeneration.addCatch(parseErrorLegacy, {
        resultPath: '$.error',
        errors: ['States.ALL'],
    });
    // Create reusable finalize job task using helper
    const finalizeJob = (0, error_handlers_1.createJobFinalizer)(scope, 'FinalizeJob', jobsTable);
    // Check HTML generation result
    const checkHtmlResult = new sfn.Choice(scope, 'CheckHtmlResult')
        .when(sfn.Condition.booleanEquals('$.htmlResult.Payload.success', false), handleHtmlGenerationFailure)
        .otherwise(finalizeJob);
    // Check if more steps remain - loops back to processStep if more steps (declared before incrementStep)
    const checkMoreSteps = new sfn.Choice(scope, 'CheckMoreSteps')
        .when(sfn.Condition.numberLessThanJsonPath('$.step_index', '$.total_steps'), processStep // Loop back to process next step
    )
        .otherwise(
    // All workflow steps complete - check if HTML generation is needed
    new sfn.Choice(scope, 'CheckIfHtmlNeeded')
        .when(sfn.Condition.booleanEquals('$.has_template', true), processHtmlGeneration.next(checkHtmlResult))
        .otherwise(finalizeJob));
    // Check if step succeeded - connects to incrementStep which connects to checkMoreSteps
    const incrementStep = new sfn.Pass(scope, 'IncrementStep', {
        parameters: {
            'job_id.$': '$.job_id',
            'workflow_id.$': '$.workflow_id',
            'submission_id.$': '$.submission_id',
            'tenant_id.$': '$.tenant_id',
            'step_index.$': 'States.MathAdd($.step_index, 1)',
            'total_steps.$': '$.total_steps',
            'has_template.$': '$.has_template',
            'template_id.$': '$.template_id',
        },
        resultPath: '$',
    }).next(checkMoreSteps);
    const checkStepResult = new sfn.Choice(scope, 'CheckStepResult')
        .when(sfn.Condition.booleanEquals('$.processResult.Payload.success', false), incrementStep)
        .otherwise(incrementStep);
    // Check step result for single-step rerun (kept for backward compatibility; always finalize)
    const checkStepResultSingleStep = new sfn.Choice(scope, 'CheckStepResultSingleStep')
        .when(sfn.Condition.booleanEquals('$.processResult.Payload.success', false), finalizeJob)
        .otherwise(finalizeJob);
    // Resolve step dependencies - calls Lambda to build execution plan
    const resolveDependencies = new tasks.LambdaInvoke(scope, 'ResolveDependencies', {
        lambdaFunction: jobProcessorLambda,
        payload: sfn.TaskInput.fromObject({
            'job_id': sfn.JsonPath.stringAt('$.job_id'),
            'workflow_id': sfn.JsonPath.stringAt('$.workflow_id'),
            'action': 'resolve_dependencies',
        }),
        resultPath: '$.executionPlan',
        retryOnServiceExceptions: false,
    });
    // Setup step loop for multi-step workflows
    const setupStepLoop = new sfn.Pass(scope, 'SetupStepLoop', {
        parameters: {
            'job_id.$': '$.job_id',
            'workflow_id.$': '$.workflow_id',
            'submission_id.$': '$.submission_id',
            'tenant_id.$': '$.tenant_id',
            'step_index': 0,
            'total_steps.$': '$.steps_length',
            'has_template.$': '$.has_template',
            'template_id.$': '$.template_id',
            'execution_plan.$': '$.executionPlan.Payload',
        },
        resultPath: '$',
    }).next(processStep).next(checkStepResult);
    // All workflows must use steps format - route directly to dependency resolution
    // If workflow has no steps, the Lambda will throw an error
    const checkWorkflowType = resolveDependencies.next(setupStepLoop);
    // Set has_template to true when template exists
    const setHasTemplateTrue = new sfn.Pass(scope, 'SetHasTemplateTrue', {
        parameters: {
            'job_id.$': '$.job_id',
            'workflow_id.$': '$.workflow_id',
            'submission_id.$': '$.submission_id',
            'tenant_id.$': '$.tenant_id',
            'workflowData.$': '$.workflowData',
            'steps_length.$': '$.steps_length',
            'has_template': true,
            'template_id.$': '$.workflowData.Item.template_id.S',
        },
        resultPath: '$',
    }).next(checkWorkflowType);
    // Set has_template to false when template doesn't exist
    const setHasTemplateFalse = new sfn.Pass(scope, 'SetHasTemplateFalse', {
        parameters: {
            'job_id.$': '$.job_id',
            'workflow_id.$': '$.workflow_id',
            'submission_id.$': '$.submission_id',
            'tenant_id.$': '$.tenant_id',
            'workflowData.$': '$.workflowData',
            'steps_length.$': '$.steps_length',
            'has_template': false,
            'template_id': '',
        },
        resultPath: '$',
    }).next(checkWorkflowType);
    // Check if template exists and set has_template boolean
    const checkTemplateExists = new sfn.Choice(scope, 'CheckTemplateExists')
        .when(sfn.Condition.isPresent('$.workflowData.Item.template_id.S'), setHasTemplateTrue)
        .otherwise(setHasTemplateFalse);
    // Compute steps length - handle both new (with steps) and legacy (without steps) workflows
    // All workflows must have steps - compute steps length directly
    const computeStepsLength = new sfn.Pass(scope, 'ComputeStepsLength', {
        parameters: {
            'job_id.$': '$.job_id',
            'workflow_id.$': '$.workflow_id',
            'submission_id.$': '$.submission_id',
            'tenant_id.$': '$.tenant_id',
            'workflowData.$': '$.workflowData',
            'steps_length.$': 'States.ArrayLength($.workflowData.Item.steps.L)',
        },
        resultPath: '$',
    }).next(checkTemplateExists);
    // Load workflow data for continue path (needed when continuing after rerun)
    const loadWorkflowForContinue = new tasks.DynamoGetItem(scope, 'LoadWorkflowForContinue', {
        table: workflowsTable,
        key: {
            workflow_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.workflow_id')),
        },
        resultPath: '$.workflowData',
    });
    // Set has_template for continue path when template exists
    const setHasTemplateTrueContinue = new sfn.Pass(scope, 'SetHasTemplateTrueContinue', {
        parameters: {
            'job_id.$': '$.job_id',
            'workflow_id.$': '$.workflow_id',
            'submission_id.$': '$.submission_id',
            'tenant_id.$': '$.tenant_id',
            'step_index.$': 'States.MathAdd($.step_index, 1)',
            'total_steps.$': 'States.ArrayLength($.workflowData.Item.steps.L)',
            'has_template': true,
            'template_id.$': '$.workflowData.Item.template_id.S',
            'workflowData.$': '$.workflowData',
        },
        resultPath: '$',
    });
    // Set has_template for continue path when template doesn't exist
    const setHasTemplateFalseContinue = new sfn.Pass(scope, 'SetHasTemplateFalseContinue', {
        parameters: {
            'job_id.$': '$.job_id',
            'workflow_id.$': '$.workflow_id',
            'submission_id.$': '$.submission_id',
            'tenant_id.$': '$.tenant_id',
            'step_index.$': 'States.MathAdd($.step_index, 1)',
            'total_steps.$': 'States.ArrayLength($.workflowData.Item.steps.L)',
            'has_template': false,
            'template_id': '',
            'workflowData.$': '$.workflowData',
        },
        resultPath: '$',
    });
    // Check if template exists for continue path
    const checkTemplateExistsContinue = new sfn.Choice(scope, 'CheckTemplateExistsContinue')
        .when(sfn.Condition.isPresent('$.workflowData.Item.template_id.S'), setHasTemplateTrueContinue)
        .otherwise(setHasTemplateFalseContinue);
    // Setup continue path after single step rerun
    const setupContinuePath = new sfn.Pass(scope, 'SetupContinuePath', {
        parameters: {
            'job_id.$': '$.job_id',
            'workflow_id.$': '$.workflow_id',
            'submission_id.$': '$.submission_id',
            'tenant_id.$': '$.tenant_id',
            'step_index.$': 'States.MathAdd($.step_index, 1)',
            'total_steps.$': 'States.ArrayLength($.workflowData.Item.steps.L)',
            'workflowData.$': '$.workflowData',
        },
        resultPath: '$',
    }).next(checkTemplateExistsContinue);
    // Check if more steps remain after rerun (for continue path)
    // After setupContinuePath, we route to incrementStep which will handle the normal workflow loop
    const checkMoreStepsAfterRerun = new sfn.Choice(scope, 'CheckMoreStepsAfterRerun')
        .when(sfn.Condition.numberLessThanJsonPath('$.step_index', '$.total_steps'), processStep.next(checkStepResult) // Continue with next step, then incrementStep will handle the loop
    )
        .otherwise(
    // All steps complete - check if HTML generation is needed
    new sfn.Choice(scope, 'CheckIfHtmlNeededAfterRerun')
        .when(sfn.Condition.booleanEquals('$.has_template', true), processHtmlGeneration.next(checkHtmlResult))
        .otherwise(finalizeJob));
    // Decide whether to continue after single-step rerun, regardless of step success
    const checkContinueAfterRerun = new sfn.Choice(scope, 'CheckContinueAfterRerun')
        .when(sfn.Condition.booleanEquals('$.continue_after', true), 
    // Load workflow data and continue with remaining steps
    loadWorkflowForContinue.next(setupContinuePath).next(checkMoreStepsAfterRerun))
        .otherwise(finalizeJob); // Just finalize if not continuing
    const checkStepResultSingleStepContinue = new sfn.Pass(scope, 'CheckStepResultSingleStepContinue')
        .next(checkContinueAfterRerun);
    // Check if this is a single-step rerun (action === 'process_single_step' or 'process_single_step_and_continue')
    // If yes, route directly to processStepSingle with the provided step_index
    // If no, continue with normal workflow initialization flow
    const checkAction = new sfn.Choice(scope, 'CheckAction')
        .when(sfn.Condition.or(sfn.Condition.stringEquals('$.action', 'process_single_step'), sfn.Condition.stringEquals('$.action', 'process_single_step_and_continue')), 
    // Single-step rerun path: processStepSingle -> checkStepResultSingleStepContinue
    processStepSingle.next(checkStepResultSingleStepContinue))
        .otherwise(
    // Normal workflow path: initializeSteps -> computeStepsLength -> ...
    initializeSteps.next(computeStepsLength));
    // Define workflow: Update status -> Check action -> Route accordingly
    // All workflows must use steps format - legacy format is no longer supported
    return updateJobStatus.next(checkAction);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNEJBLHdFQStWQztBQXpYRCxtRUFBcUQ7QUFDckQsMkVBQTZEO0FBRTdELHFEQUswQjtBQVExQjs7Ozs7Ozs7O0dBU0c7QUFDSCxTQUFnQiw4QkFBOEIsQ0FDNUMsS0FBZ0IsRUFDaEIsS0FBb0M7SUFFcEMsTUFBTSxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxLQUFLLENBQUM7SUFFaEUsa0NBQWtDO0lBQ2xDLE1BQU0sZUFBZSxHQUFHLElBQUksS0FBSyxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxpQkFBaUIsRUFBRTtRQUMzRSxLQUFLLEVBQUUsU0FBUztRQUNoQixHQUFHLEVBQUU7WUFDSCxNQUFNLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNqRjtRQUNELGdCQUFnQixFQUFFLGlEQUFpRDtRQUNuRSx3QkFBd0IsRUFBRTtZQUN4QixTQUFTLEVBQUUsUUFBUTtTQUNwQjtRQUNELHlCQUF5QixFQUFFO1lBQ3pCLFNBQVMsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQztZQUM5RCxhQUFhLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1NBQ3BHO1FBQ0QsVUFBVSxFQUFFLGdCQUFnQjtLQUM3QixDQUFDLENBQUM7SUFFSCwrQ0FBK0M7SUFDL0MsTUFBTSxpQkFBaUIsR0FBRyxJQUFBLHlDQUF3QixFQUFD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QUN0RSw2RUFBNkU7SUFDN0UsT0FBTyxlQUFlLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQzNDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgc2ZuIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zJztcbmltcG9ydCAqIGFzIHRhc2tzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHtcbiAgY3JlYXRlU3RlcEZhaWx1cmVIYW5kbGVyLFxuICBjcmVhdGVIdG1sR2VuZXJhdGlvbkZhaWx1cmVIYW5kbGVyLFxuICBjcmVhdGVFeGNlcHRpb25IYW5kbGVyQ2hhaW4sXG4gIGNyZWF0ZUpvYkZpbmFsaXplcixcbn0gZnJvbSAnLi9lcnJvci1oYW5kbGVycyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSm9iUHJvY2Vzc29yU3RhdGVNYWNoaW5lUHJvcHMge1xuICBqb2JzVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgd29ya2Zsb3dzVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgam9iUHJvY2Vzc29yTGFtYmRhOiBsYW1iZGEuSUZ1bmN0aW9uO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgdGhlIFN0ZXAgRnVuY3Rpb25zIHN0YXRlIG1hY2hpbmUgZGVmaW5pdGlvbiBmb3Igam9iIHByb2Nlc3NpbmdcbiAqIFxuICogVGhpcyBzdGF0ZSBtYWNoaW5lIG9yY2hlc3RyYXRlcyB0aGUgZXhlY3V0aW9uIG9mIHdvcmtmbG93IGpvYnMsIGhhbmRsaW5nOlxuICogLSBNdWx0aS1zdGVwIHdvcmtmbG93cyB3aXRoIGRlcGVuZGVuY3kgcmVzb2x1dGlvblxuICogLSBIVE1MIGdlbmVyYXRpb24gZm9yIHRlbXBsYXRlc1xuICogLSBFcnJvciBoYW5kbGluZyBhbmQgam9iIHN0YXR1cyB1cGRhdGVzXG4gKiBcbiAqIE5vdGU6IExlZ2FjeSBmb3JtYXQgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZC4gQWxsIHdvcmtmbG93cyBtdXN0IHVzZSBzdGVwcyBmb3JtYXQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVKb2JQcm9jZXNzb3JTdGF0ZU1hY2hpbmUoXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIHByb3BzOiBKb2JQcm9jZXNzb3JTdGF0ZU1hY2hpbmVQcm9wc1xuKTogc2ZuLklDaGFpbmFibGUge1xuICBjb25zdCB7IGpvYnNUYWJsZSwgd29ya2Zsb3dzVGFibGUsIGpvYlByb2Nlc3NvckxhbWJkYSB9ID0gcHJvcHM7XG5cbiAgLy8gVXBkYXRlIGpvYiBzdGF0dXMgdG8gcHJvY2Vzc2luZ1xuICBjb25zdCB1cGRhdGVKb2JTdGF0dXMgPSBuZXcgdGFza3MuRHluYW1vVXBkYXRlSXRlbShzY29wZSwgJ1VwZGF0ZUpvYlN0YXR1cycsIHtcbiAgICB0YWJsZTogam9ic1RhYmxlLFxuICAgIGtleToge1xuICAgICAgam9iX2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSksXG4gICAgfSxcbiAgICB1cGRhdGVFeHByZXNzaW9uOiAnU0VUICNzdGF0dXMgPSA6c3RhdHVzLCB1cGRhdGVkX2F0ID0gOnVwZGF0ZWRfYXQnLFxuICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICB9LFxuICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygncHJvY2Vzc2luZycpLFxuICAgICAgJzp1cGRhdGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQudXBkYXRlUmVzdWx0JyxcbiAgfSk7XG5cbiAgLy8gQ3JlYXRlIGVycm9yIGhhbmRsZXJzIHVzaW5nIGhlbHBlciBmdW5jdGlvbnNcbiAgY29uc3QgaGFuZGxlU3RlcEZhaWx1cmUgPSBjcmVhdGVTdGVwRmFpbHVyZUhhbmRsZXIoc2NvcGUsIGpvYnNUYWJsZSk7XG4gIGNvbnN0IGhhbmRsZUh0bWxHZW5lcmF0aW9uRmFpbHVyZSA9IGNyZWF0ZUh0bWxHZW5lcmF0aW9uRmFpbHVyZUhhbmRsZXIoc2NvcGUsIGpvYnNUYWJsZSk7XG4gIGNvbnN0IHBhcnNlRXJyb3JMZWdhY3kgPSBjcmVhdGVFeGNlcHRpb25IYW5kbGVyQ2hhaW4oc2NvcGUsICdQYXJzZUVycm9yTGVnYWN5Jywgam9ic1RhYmxlLCBmYWxzZSk7XG4gIGNvbnN0IHBhcnNlRXJyb3JTdGVwID0gY3JlYXRlRXhjZXB0aW9uSGFuZGxlckNoYWluKHNjb3BlLCAnUGFyc2VFcnJvclN0ZXAnLCBqb2JzVGFibGUsIHRydWUpO1xuXG4gIC8vIEluaXRpYWxpemUgc3RlcHM6IExvYWQgd29ya2Zsb3cgYW5kIGdldCBzdGVwIGNvdW50XG4gIGNvbnN0IGluaXRpYWxpemVTdGVwcyA9IG5ldyB0YXNrcy5EeW5hbW9HZXRJdGVtKHNjb3BlLCAnSW5pdGlhbGl6ZVN0ZXBzJywge1xuICAgIHRhYmxlOiB3b3JrZmxvd3NUYWJsZSxcbiAgICBrZXk6IHtcbiAgICAgIHdvcmtmbG93X2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC53b3JrZmxvd19pZCcpKSxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckLndvcmtmbG93RGF0YScsXG4gIH0pO1xuXG4gIC8vIFByb2Nlc3MgYSBzaW5nbGUgc3RlcCB1c2luZyBMYW1iZGEgZnVuY3Rpb24gKGRlY2xhcmVkIGVhcmx5IGZvciB1c2UgaW4gc2V0dXBTdGVwTG9vcClcbiAgY29uc3QgcHJvY2Vzc1N0ZXAgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHNjb3BlLCAnUHJvY2Vzc1N0ZXAnLCB7XG4gICAgbGFtYmRhRnVuY3Rpb246IGpvYlByb2Nlc3NvckxhbWJkYSxcbiAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgJ2pvYl9pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgICdzdGVwX2luZGV4Jzogc2ZuLkpzb25QYXRoLm51bWJlckF0KCckLnN0ZXBfaW5kZXgnKSxcbiAgICAgICdzdGVwX3R5cGUnOiAnd29ya2Zsb3dfc3RlcCcsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQucHJvY2Vzc1Jlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBMYW1iZGEgZmFpbHVyZXNcbiAgcHJvY2Vzc1N0ZXAuYWRkQ2F0Y2gocGFyc2VFcnJvclN0ZXAsIHtcbiAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgZXJyb3JzOiBbJ1N0YXRlcy5BTEwnXSxcbiAgfSk7XG5cbiAgLy8gUHJvY2VzcyBhIHNpbmdsZSBzdGVwIGZvciByZXJ1biAoc2VwYXJhdGUgc3RhdGUgdG8gYXZvaWQgXCJhbHJlYWR5IGhhcyBuZXh0XCIgZXJyb3IpXG4gIGNvbnN0IHByb2Nlc3NTdGVwU2luZ2xlID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZShzY29wZSwgJ1Byb2Nlc3NTdGVwU2luZ2xlJywge1xuICAgIGxhbWJkYUZ1bmN0aW9uOiBqb2JQcm9jZXNzb3JMYW1iZGEsXG4gICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICdqb2JfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJyksXG4gICAgICAnc3RlcF9pbmRleCc6IHNmbi5Kc29uUGF0aC5udW1iZXJBdCgnJC5zdGVwX2luZGV4JyksXG4gICAgICAnc3RlcF90eXBlJzogJ3dvcmtmbG93X3N0ZXAnLFxuICAgIH0pLFxuICAgIHJlc3VsdFBhdGg6ICckLnByb2Nlc3NSZXN1bHQnLFxuICAgIHJldHJ5T25TZXJ2aWNlRXhjZXB0aW9uczogZmFsc2UsXG4gIH0pO1xuXG4gIC8vIEFkZCBlcnJvciBoYW5kbGluZyBmb3IgTGFtYmRhIGZhaWx1cmVzXG4gIHByb2Nlc3NTdGVwU2luZ2xlLmFkZENhdGNoKHBhcnNlRXJyb3JTdGVwLCB7XG4gICAgcmVzdWx0UGF0aDogJyQuZXJyb3InLFxuICAgIGVycm9yczogWydTdGF0ZXMuQUxMJ10sXG4gIH0pO1xuXG4gIC8vIFByb2Nlc3MgSFRNTCBnZW5lcmF0aW9uIHN0ZXBcbiAgY29uc3QgcHJvY2Vzc0h0bWxHZW5lcmF0aW9uID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZShzY29wZSwgJ1Byb2Nlc3NIdG1sR2VuZXJhdGlvbicsIHtcbiAgICBsYW1iZGFGdW5jdGlvbjogam9iUHJvY2Vzc29yTGFtYmRhLFxuICAgIHBheWxvYWQ6IHNmbi5UYXNrSW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAnam9iX2lkJzogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpLFxuICAgICAgJ3N0ZXBfdHlwZSc6ICdodG1sX2dlbmVyYXRpb24nLFxuICAgIH0pLFxuICAgIHJlc3VsdFBhdGg6ICckLmh0bWxSZXN1bHQnLFxuICAgIHJldHJ5T25TZXJ2aWNlRXhjZXB0aW9uczogZmFsc2UsXG4gIH0pO1xuXG4gIC8vIEFkZCBlcnJvciBoYW5kbGluZyBmb3IgSFRNTCBnZW5lcmF0aW9uIGZhaWx1cmVzXG4gIC8vIE5vdGU6IFVzZSBwYXJzZUVycm9yTGVnYWN5IChub3QgcGFyc2VFcnJvclN0ZXApIGJlY2F1c2UgSFRNTCBnZW5lcmF0aW9uXG4gIC8vIHJ1bnMgYWZ0ZXIgYWxsIHdvcmtmbG93IHN0ZXBzIGFyZSBjb21wbGV0ZSwgc28gc3RlcF9pbmRleCBpcyBub3QgaW4gY29udGV4dFxuICBwcm9jZXNzSHRtbEdlbmVyYXRpb24uYWRkQ2F0Y2gocGFyc2VFcnJvckxlZ2FjeSwge1xuICAgIHJlc3VsdFBhdGg6ICckLmVycm9yJyxcbiAgICBlcnJvcnM6IFsnU3RhdGVzLkFMTCddLFxuICB9KTtcblxuICAvLyBDcmVhdGUgcmV1c2FibGUgZmluYWxpemUgam9iIHRhc2sgdXNpbmcgaGVscGVyXG4gIGNvbnN0IGZpbmFsaXplSm9iID0gY3JlYXRlSm9iRmluYWxpemVyKHNjb3BlLCAnRmluYWxpemVKb2InLCBqb2JzVGFibGUpO1xuXG4gIC8vIENoZWNrIEhUTUwgZ2VuZXJhdGlvbiByZXN1bHRcbiAgY29uc3QgY2hlY2tIdG1sUmVzdWx0ID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja0h0bWxSZXN1bHQnKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5ib29sZWFuRXF1YWxzKCckLmh0bWxSZXN1bHQuUGF5bG9hZC5zdWNjZXNzJywgZmFsc2UpLFxuICAgICAgaGFuZGxlSHRtbEdlbmVyYXRpb25GYWlsdXJlXG4gICAgKVxuICAgIC5vdGhlcndpc2UoZmluYWxpemVKb2IpO1xuXG4gIC8vIENoZWNrIGlmIG1vcmUgc3RlcHMgcmVtYWluIC0gbG9vcHMgYmFjayB0byBwcm9jZXNzU3RlcCBpZiBtb3JlIHN0ZXBzIChkZWNsYXJlZCBiZWZvcmUgaW5jcmVtZW50U3RlcClcbiAgY29uc3QgY2hlY2tNb3JlU3RlcHMgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrTW9yZVN0ZXBzJylcbiAgICAud2hlbihcbiAgICAgIHNmbi5Db25kaXRpb24ubnVtYmVyTGVzc1RoYW5Kc29uUGF0aCgnJC5zdGVwX2luZGV4JywgJyQudG90YWxfc3RlcHMnKSxcbiAgICAgIHByb2Nlc3NTdGVwICAvLyBMb29wIGJhY2sgdG8gcHJvY2VzcyBuZXh0IHN0ZXBcbiAgICApXG4gICAgLm90aGVyd2lzZShcbiAgICAgIC8vIEFsbCB3b3JrZmxvdyBzdGVwcyBjb21wbGV0ZSAtIGNoZWNrIGlmIEhUTUwgZ2VuZXJhdGlvbiBpcyBuZWVkZWRcbiAgICAgIG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tJZkh0bWxOZWVkZWQnKVxuICAgICAgICAud2hlbihcbiAgICAgICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQuaGFzX3RlbXBsYXRlJywgdHJ1ZSksXG4gICAgICAgICAgcHJvY2Vzc0h0bWxHZW5lcmF0aW9uLm5leHQoY2hlY2tIdG1sUmVzdWx0KVxuICAgICAgICApXG4gICAgICAgIC5vdGhlcndpc2UoZmluYWxpemVKb2IpXG4gICAgKTtcblxuICAvLyBDaGVjayBpZiBzdGVwIHN1Y2NlZWRlZCAtIGNvbm5lY3RzIHRvIGluY3JlbWVudFN0ZXAgd2hpY2ggY29ubmVjdHMgdG8gY2hlY2tNb3JlU3RlcHNcbiAgY29uc3QgaW5jcmVtZW50U3RlcCA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ0luY3JlbWVudFN0ZXAnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICdzdGVwX2luZGV4LiQnOiAnU3RhdGVzLk1hdGhBZGQoJC5zdGVwX2luZGV4LCAxKScsXG4gICAgICAndG90YWxfc3RlcHMuJCc6ICckLnRvdGFsX3N0ZXBzJyxcbiAgICAgICdoYXNfdGVtcGxhdGUuJCc6ICckLmhhc190ZW1wbGF0ZScsXG4gICAgICAndGVtcGxhdGVfaWQuJCc6ICckLnRlbXBsYXRlX2lkJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChjaGVja01vcmVTdGVwcyk7XG5cbiAgY29uc3QgY2hlY2tTdGVwUmVzdWx0ID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja1N0ZXBSZXN1bHQnKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5ib29sZWFuRXF1YWxzKCckLnByb2Nlc3NSZXN1bHQuUGF5bG9hZC5zdWNjZXNzJywgZmFsc2UpLFxuICAgICAgaGFuZGxlU3RlcEZhaWx1cmVcbiAgICApXG4gICAgLm90aGVyd2lzZShpbmNyZW1lbnRTdGVwKTtcblxuICAvLyBDaGVjayBzdGVwIHJlc3VsdCBmb3Igc2luZ2xlLXN0ZXAgcmVydW4gKGdvZXMgZGlyZWN0bHkgdG8gZmluYWxpemVKb2IgaW5zdGVhZCBvZiBpbmNyZW1lbnRpbmcpXG4gIGNvbnN0IGNoZWNrU3RlcFJlc3VsdFNpbmdsZVN0ZXAgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrU3RlcFJlc3VsdFNpbmdsZVN0ZXAnKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5ib29sZWFuRXF1YWxzKCckLnByb2Nlc3NSZXN1bHQuUGF5bG9hZC5zdWNjZXNzJywgZmFsc2UpLFxuICAgICAgaGFuZGxlU3RlcEZhaWx1cmVcbiAgICApXG4gICAgLm90aGVyd2lzZShmaW5hbGl6ZUpvYik7XG5cbiAgLy8gUmVzb2x2ZSBzdGVwIGRlcGVuZGVuY2llcyAtIGNhbGxzIExhbWJkYSB0byBidWlsZCBleGVjdXRpb24gcGxhblxuICBjb25zdCByZXNvbHZlRGVwZW5kZW5jaWVzID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZShzY29wZSwgJ1Jlc29sdmVEZXBlbmRlbmNpZXMnLCB7XG4gICAgbGFtYmRhRnVuY3Rpb246IGpvYlByb2Nlc3NvckxhbWJkYSxcbiAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgJ2pvYl9pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgICd3b3JrZmxvd19pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC53b3JrZmxvd19pZCcpLFxuICAgICAgJ2FjdGlvbic6ICdyZXNvbHZlX2RlcGVuZGVuY2llcycsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQuZXhlY3V0aW9uUGxhbicsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gU2V0dXAgc3RlcCBsb29wIGZvciBtdWx0aS1zdGVwIHdvcmtmbG93c1xuICBjb25zdCBzZXR1cFN0ZXBMb29wID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnU2V0dXBTdGVwTG9vcCcsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3N0ZXBfaW5kZXgnOiAwLFxuICAgICAgJ3RvdGFsX3N0ZXBzLiQnOiAnJC5zdGVwc19sZW5ndGgnLFxuICAgICAgJ2hhc190ZW1wbGF0ZS4kJzogJyQuaGFzX3RlbXBsYXRlJyxcbiAgICAgICd0ZW1wbGF0ZV9pZC4kJzogJyQudGVtcGxhdGVfaWQnLFxuICAgICAgJ2V4ZWN1dGlvbl9wbGFuLiQnOiAnJC5leGVjdXRpb25QbGFuLlBheWxvYWQnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KHByb2Nlc3NTdGVwKS5uZXh0KGNoZWNrU3RlcFJlc3VsdCk7XG5cbiAgLy8gQWxsIHdvcmtmbG93cyBtdXN0IHVzZSBzdGVwcyBmb3JtYXQgLSByb3V0ZSBkaXJlY3RseSB0byBkZXBlbmRlbmN5IHJlc29sdXRpb25cbiAgLy8gSWYgd29ya2Zsb3cgaGFzIG5vIHN0ZXBzLCB0aGUgTGFtYmRhIHdpbGwgdGhyb3cgYW4gZXJyb3JcbiAgY29uc3QgY2hlY2tXb3JrZmxvd1R5cGUgPSByZXNvbHZlRGVwZW5kZW5jaWVzLm5leHQoc2V0dXBTdGVwTG9vcCk7XG5cbiAgLy8gU2V0IGhhc190ZW1wbGF0ZSB0byB0cnVlIHdoZW4gdGVtcGxhdGUgZXhpc3RzXG4gIGNvbnN0IHNldEhhc1RlbXBsYXRlVHJ1ZSA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ1NldEhhc1RlbXBsYXRlVHJ1ZScsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3dvcmtmbG93RGF0YS4kJzogJyQud29ya2Zsb3dEYXRhJyxcbiAgICAgICdzdGVwc19sZW5ndGguJCc6ICckLnN0ZXBzX2xlbmd0aCcsXG4gICAgICAnaGFzX3RlbXBsYXRlJzogdHJ1ZSxcbiAgICAgICd0ZW1wbGF0ZV9pZC4kJzogJyQud29ya2Zsb3dEYXRhLkl0ZW0udGVtcGxhdGVfaWQuUycsXG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJCcsXG4gIH0pLm5leHQoY2hlY2tXb3JrZmxvd1R5cGUpO1xuXG4gIC8vIFNldCBoYXNfdGVtcGxhdGUgdG8gZmFsc2Ugd2hlbiB0ZW1wbGF0ZSBkb2Vzbid0IGV4aXN0XG4gIGNvbnN0IHNldEhhc1RlbXBsYXRlRmFsc2UgPSBuZXcgc2ZuLlBhc3Moc2NvcGUsICdTZXRIYXNUZW1wbGF0ZUZhbHNlJywge1xuICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICdqb2JfaWQuJCc6ICckLmpvYl9pZCcsXG4gICAgICAnd29ya2Zsb3dfaWQuJCc6ICckLndvcmtmbG93X2lkJyxcbiAgICAgICdzdWJtaXNzaW9uX2lkLiQnOiAnJC5zdWJtaXNzaW9uX2lkJyxcbiAgICAgICd0ZW5hbnRfaWQuJCc6ICckLnRlbmFudF9pZCcsXG4gICAgICAnd29ya2Zsb3dEYXRhLiQnOiAnJC53b3JrZmxvd0RhdGEnLFxuICAgICAgJ3N0ZXBzX2xlbmd0aC4kJzogJyQuc3RlcHNfbGVuZ3RoJyxcbiAgICAgICdoYXNfdGVtcGxhdGUnOiBmYWxzZSxcbiAgICAgICd0ZW1wbGF0ZV9pZCc6ICcnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrV29ya2Zsb3dUeXBlKTtcblxuICAvLyBDaGVjayBpZiB0ZW1wbGF0ZSBleGlzdHMgYW5kIHNldCBoYXNfdGVtcGxhdGUgYm9vbGVhblxuICBjb25zdCBjaGVja1RlbXBsYXRlRXhpc3RzID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja1RlbXBsYXRlRXhpc3RzJylcbiAgICAud2hlbihcbiAgICAgIHNmbi5Db25kaXRpb24uaXNQcmVzZW50KCckLndvcmtmbG93RGF0YS5JdGVtLnRlbXBsYXRlX2lkLlMnKSxcbiAgICAgIHNldEhhc1RlbXBsYXRlVHJ1ZVxuICAgIClcbiAgICAub3RoZXJ3aXNlKHNldEhhc1RlbXBsYXRlRmFsc2UpO1xuXG4gIC8vIENvbXB1dGUgc3RlcHMgbGVuZ3RoIC0gaGFuZGxlIGJvdGggbmV3ICh3aXRoIHN0ZXBzKSBhbmQgbGVnYWN5ICh3aXRob3V0IHN0ZXBzKSB3b3JrZmxvd3NcbiAgLy8gQWxsIHdvcmtmbG93cyBtdXN0IGhhdmUgc3RlcHMgLSBjb21wdXRlIHN0ZXBzIGxlbmd0aCBkaXJlY3RseVxuICBjb25zdCBjb21wdXRlU3RlcHNMZW5ndGggPSBuZXcgc2ZuLlBhc3Moc2NvcGUsICdDb21wdXRlU3RlcHNMZW5ndGgnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICd3b3JrZmxvd0RhdGEuJCc6ICckLndvcmtmbG93RGF0YScsXG4gICAgICAnc3RlcHNfbGVuZ3RoLiQnOiAnU3RhdGVzLkFycmF5TGVuZ3RoKCQud29ya2Zsb3dEYXRhLkl0ZW0uc3RlcHMuTCknLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrVGVtcGxhdGVFeGlzdHMpO1xuXG4gIC8vIExvYWQgd29ya2Zsb3cgZGF0YSBmb3IgY29udGludWUgcGF0aCAobmVlZGVkIHdoZW4gY29udGludWluZyBhZnRlciByZXJ1bilcbiAgY29uc3QgbG9hZFdvcmtmbG93Rm9yQ29udGludWUgPSBuZXcgdGFza3MuRHluYW1vR2V0SXRlbShzY29wZSwgJ0xvYWRXb3JrZmxvd0ZvckNvbnRpbnVlJywge1xuICAgIHRhYmxlOiB3b3JrZmxvd3NUYWJsZSxcbiAgICBrZXk6IHtcbiAgICAgIHdvcmtmbG93X2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC53b3JrZmxvd19pZCcpKSxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckLndvcmtmbG93RGF0YScsXG4gIH0pO1xuXG4gIC8vIFNldCBoYXNfdGVtcGxhdGUgZm9yIGNvbnRpbnVlIHBhdGggd2hlbiB0ZW1wbGF0ZSBleGlzdHNcbiAgY29uc3Qgc2V0SGFzVGVtcGxhdGVUcnVlQ29udGludWUgPSBuZXcgc2ZuLlBhc3Moc2NvcGUsICdTZXRIYXNUZW1wbGF0ZVRydWVDb250aW51ZScsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3N0ZXBfaW5kZXguJCc6ICdTdGF0ZXMuTWF0aEFkZCgkLnN0ZXBfaW5kZXgsIDEpJyxcbiAgICAgICd0b3RhbF9zdGVwcy4kJzogJ1N0YXRlcy5BcnJheUxlbmd0aCgkLndvcmtmbG93RGF0YS5JdGVtLnN0ZXBzLkwpJyxcbiAgICAgICdoYXNfdGVtcGxhdGUnOiB0cnVlLFxuICAgICAgJ3RlbXBsYXRlX2lkLiQnOiAnJC53b3JrZmxvd0RhdGEuSXRlbS50ZW1wbGF0ZV9pZC5TJyxcbiAgICAgICd3b3JrZmxvd0RhdGEuJCc6ICckLndvcmtmbG93RGF0YScsXG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJCcsXG4gIH0pO1xuXG4gIC8vIFNldCBoYXNfdGVtcGxhdGUgZm9yIGNvbnRpbnVlIHBhdGggd2hlbiB0ZW1wbGF0ZSBkb2Vzbid0IGV4aXN0XG4gIGNvbnN0IHNldEhhc1RlbXBsYXRlRmFsc2VDb250aW51ZSA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ1NldEhhc1RlbXBsYXRlRmFsc2VDb250aW51ZScsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3N0ZXBfaW5kZXguJCc6ICdTdGF0ZXMuTWF0aEFkZCgkLnN0ZXBfaW5kZXgsIDEpJyxcbiAgICAgICd0b3RhbF9zdGVwcy4kJzogJ1N0YXRlcy5BcnJheUxlbmd0aCgkLndvcmtmbG93RGF0YS5JdGVtLnN0ZXBzLkwpJyxcbiAgICAgICdoYXNfdGVtcGxhdGUnOiBmYWxzZSxcbiAgICAgICd0ZW1wbGF0ZV9pZCc6ICcnLFxuICAgICAgJ3dvcmtmbG93RGF0YS4kJzogJyQud29ya2Zsb3dEYXRhJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSk7XG5cbiAgLy8gQ2hlY2sgaWYgdGVtcGxhdGUgZXhpc3RzIGZvciBjb250aW51ZSBwYXRoXG4gIGNvbnN0IGNoZWNrVGVtcGxhdGVFeGlzdHNDb250aW51ZSA9IG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tUZW1wbGF0ZUV4aXN0c0NvbnRpbnVlJylcbiAgICAud2hlbihcbiAgICAgIHNmbi5Db25kaXRpb24uaXNQcmVzZW50KCckLndvcmtmbG93RGF0YS5JdGVtLnRlbXBsYXRlX2lkLlMnKSxcbiAgICAgIHNldEhhc1RlbXBsYXRlVHJ1ZUNvbnRpbnVlXG4gICAgKVxuICAgIC5vdGhlcndpc2Uoc2V0SGFzVGVtcGxhdGVGYWxzZUNvbnRpbnVlKTtcblxuICAvLyBTZXR1cCBjb250aW51ZSBwYXRoIGFmdGVyIHNpbmdsZSBzdGVwIHJlcnVuXG4gIGNvbnN0IHNldHVwQ29udGludWVQYXRoID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnU2V0dXBDb250aW51ZVBhdGgnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICdzdGVwX2luZGV4LiQnOiAnU3RhdGVzLk1hdGhBZGQoJC5zdGVwX2luZGV4LCAxKScsXG4gICAgICAndG90YWxfc3RlcHMuJCc6ICdTdGF0ZXMuQXJyYXlMZW5ndGgoJC53b3JrZmxvd0RhdGEuSXRlbS5zdGVwcy5MKScsXG4gICAgICAnd29ya2Zsb3dEYXRhLiQnOiAnJC53b3JrZmxvd0RhdGEnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrVGVtcGxhdGVFeGlzdHNDb250aW51ZSk7XG5cbiAgLy8gQ2hlY2sgaWYgbW9yZSBzdGVwcyByZW1haW4gYWZ0ZXIgcmVydW4gKGZvciBjb250aW51ZSBwYXRoKVxuICAvLyBBZnRlciBzZXR1cENvbnRpbnVlUGF0aCwgd2Ugcm91dGUgdG8gaW5jcmVtZW50U3RlcCB3aGljaCB3aWxsIGhhbmRsZSB0aGUgbm9ybWFsIHdvcmtmbG93IGxvb3BcbiAgY29uc3QgY2hlY2tNb3JlU3RlcHNBZnRlclJlcnVuID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja01vcmVTdGVwc0FmdGVyUmVydW4nKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5udW1iZXJMZXNzVGhhbkpzb25QYXRoKCckLnN0ZXBfaW5kZXgnLCAnJC50b3RhbF9zdGVwcycpLFxuICAgICAgcHJvY2Vzc1N0ZXAubmV4dChjaGVja1N0ZXBSZXN1bHQpICAvLyBDb250aW51ZSB3aXRoIG5leHQgc3RlcCwgdGhlbiBpbmNyZW1lbnRTdGVwIHdpbGwgaGFuZGxlIHRoZSBsb29wXG4gICAgKVxuICAgIC5vdGhlcndpc2UoXG4gICAgICAvLyBBbGwgc3RlcHMgY29tcGxldGUgLSBjaGVjayBpZiBIVE1MIGdlbmVyYXRpb24gaXMgbmVlZGVkXG4gICAgICBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrSWZIdG1sTmVlZGVkQWZ0ZXJSZXJ1bicpXG4gICAgICAgIC53aGVuKFxuICAgICAgICAgIHNmbi5Db25kaXRpb24uYm9vbGVhbkVxdWFscygnJC5oYXNfdGVtcGxhdGUnLCB0cnVlKSxcbiAgICAgICAgICBwcm9jZXNzSHRtbEdlbmVyYXRpb24ubmV4dChjaGVja0h0bWxSZXN1bHQpXG4gICAgICAgIClcbiAgICAgICAgLm90aGVyd2lzZShmaW5hbGl6ZUpvYilcbiAgICApO1xuXG4gIC8vIENoZWNrIHN0ZXAgcmVzdWx0IGZvciBzaW5nbGUtc3RlcCByZXJ1biB3aXRoIGNvbnRpbnVlIG9wdGlvblxuICBjb25zdCBjaGVja1N0ZXBSZXN1bHRTaW5nbGVTdGVwQ29udGludWUgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrU3RlcFJlc3VsdFNpbmdsZVN0ZXBDb250aW51ZScpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQucHJvY2Vzc1Jlc3VsdC5QYXlsb2FkLnN1Y2Nlc3MnLCBmYWxzZSksXG4gICAgICBoYW5kbGVTdGVwRmFpbHVyZVxuICAgIClcbiAgICAub3RoZXJ3aXNlKFxuICAgICAgLy8gU3RlcCBzdWNjZWVkZWQgLSBjaGVjayBpZiB3ZSBzaG91bGQgY29udGludWVcbiAgICAgIG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tDb250aW51ZUFmdGVyUmVydW4nKVxuICAgICAgICAud2hlbihcbiAgICAgICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQuY29udGludWVfYWZ0ZXInLCB0cnVlKSxcbiAgICAgICAgICAvLyBMb2FkIHdvcmtmbG93IGRhdGEgYW5kIGNvbnRpbnVlIHdpdGggcmVtYWluaW5nIHN0ZXBzXG4gICAgICAgICAgbG9hZFdvcmtmbG93Rm9yQ29udGludWUubmV4dChzZXR1cENvbnRpbnVlUGF0aCkubmV4dChjaGVja01vcmVTdGVwc0FmdGVyUmVydW4pXG4gICAgICAgIClcbiAgICAgICAgLm90aGVyd2lzZShmaW5hbGl6ZUpvYikgIC8vIEp1c3QgZmluYWxpemUgaWYgbm90IGNvbnRpbnVpbmdcbiAgICApO1xuXG4gIC8vIENoZWNrIGlmIHRoaXMgaXMgYSBzaW5nbGUtc3RlcCByZXJ1biAoYWN0aW9uID09PSAncHJvY2Vzc19zaW5nbGVfc3RlcCcgb3IgJ3Byb2Nlc3Nfc2luZ2xlX3N0ZXBfYW5kX2NvbnRpbnVlJylcbiAgLy8gSWYgeWVzLCByb3V0ZSBkaXJlY3RseSB0byBwcm9jZXNzU3RlcFNpbmdsZSB3aXRoIHRoZSBwcm92aWRlZCBzdGVwX2luZGV4XG4gIC8vIElmIG5vLCBjb250aW51ZSB3aXRoIG5vcm1hbCB3b3JrZmxvdyBpbml0aWFsaXphdGlvbiBmbG93XG4gIGNvbnN0IGNoZWNrQWN0aW9uID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja0FjdGlvbicpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLm9yKFxuICAgICAgICBzZm4uQ29uZGl0aW9uLnN0cmluZ0VxdWFscygnJC5hY3Rpb24nLCAncHJvY2Vzc19zaW5nbGVfc3RlcCcpLFxuICAgICAgICBzZm4uQ29uZGl0aW9uLnN0cmluZ0VxdWFscygnJC5hY3Rpb24nLCAncHJvY2Vzc19zaW5nbGVfc3RlcF9hbmRfY29udGludWUnKVxuICAgICAgKSxcbiAgICAgIC8vIFNpbmdsZS1zdGVwIHJlcnVuIHBhdGg6IHByb2Nlc3NTdGVwU2luZ2xlIC0+IGNoZWNrU3RlcFJlc3VsdFNpbmdsZVN0ZXBDb250aW51ZVxuICAgICAgcHJvY2Vzc1N0ZXBTaW5nbGUubmV4dChjaGVja1N0ZXBSZXN1bHRTaW5nbGVTdGVwQ29udGludWUpXG4gICAgKVxuICAgIC5vdGhlcndpc2UoXG4gICAgICAvLyBOb3JtYWwgd29ya2Zsb3cgcGF0aDogaW5pdGlhbGl6ZVN0ZXBzIC0+IGNvbXB1dGVTdGVwc0xlbmd0aCAtPiAuLi5cbiAgICAgIGluaXRpYWxpemVTdGVwcy5uZXh0KGNvbXB1dGVTdGVwc0xlbmd0aClcbiAgICApO1xuXG4gIC8vIERlZmluZSB3b3JrZmxvdzogVXBkYXRlIHN0YXR1cyAtPiBDaGVjayBhY3Rpb24gLT4gUm91dGUgYWNjb3JkaW5nbHlcbiAgLy8gQWxsIHdvcmtmbG93cyBtdXN0IHVzZSBzdGVwcyBmb3JtYXQgLSBsZWdhY3kgZm9ybWF0IGlzIG5vIGxvbmdlciBzdXBwb3J0ZWRcbiAgcmV0dXJuIHVwZGF0ZUpvYlN0YXR1cy5uZXh0KGNoZWNrQWN0aW9uKTtcbn1cblxuIl19