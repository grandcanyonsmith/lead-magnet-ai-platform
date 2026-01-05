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
    // Process step for continue-after-rerun path (separate state to avoid "already has next" error)
    // This is needed because processStep is already chained in setupStepLoop
    const processStepContinue = new tasks.LambdaInvoke(scope, 'ProcessStepContinue', {
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
    processStepContinue.addCatch(parseErrorStep, {
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
    // Process HTML generation step for continue-after-rerun path (separate state to avoid "already has next" error)
    const processHtmlGenerationContinue = new tasks.LambdaInvoke(scope, 'ProcessHtmlGenerationContinue', {
        lambdaFunction: jobProcessorLambda,
        payload: sfn.TaskInput.fromObject({
            'job_id': sfn.JsonPath.stringAt('$.job_id'),
            'step_type': 'html_generation',
        }),
        resultPath: '$.htmlResult',
        retryOnServiceExceptions: false,
    });
    // Add error handling for HTML generation failures
    processHtmlGenerationContinue.addCatch(parseErrorLegacy, {
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
    // Check if more steps remain after rerun (for continue path)
    // After setupContinuePath, we route to incrementStep which will handle the normal workflow loop
    // Defined before setHasTemplateTrueContinue/setHasTemplateFalseContinue because it's referenced there
    const checkMoreStepsAfterRerun = new sfn.Choice(scope, 'CheckMoreStepsAfterRerun')
        .when(sfn.Condition.numberLessThanJsonPath('$.step_index', '$.total_steps'), processStepContinue.next(checkStepResult) // Continue with next step, then incrementStep will handle the loop
    )
        .otherwise(
    // All steps complete - check if HTML generation is needed
    new sfn.Choice(scope, 'CheckIfHtmlNeededAfterRerun')
        .when(sfn.Condition.booleanEquals('$.has_template', true), processHtmlGenerationContinue.next(checkHtmlResult))
        .otherwise(finalizeJob));
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
    }).next(checkMoreStepsAfterRerun);
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
    }).next(checkMoreStepsAfterRerun);
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
    // Decide whether to continue after single-step rerun, regardless of step success
    const checkContinueAfterRerun = new sfn.Choice(scope, 'CheckContinueAfterRerun')
        .when(sfn.Condition.booleanEquals('$.continue_after', true), 
    // Load workflow data and continue with remaining steps
    loadWorkflowForContinue.next(setupContinuePath))
        .otherwise(finalizeJob); // Just finalize if not continuing
    const checkStepResultSingleStepContinue = new sfn.Pass(scope, 'CheckStepResultSingleStepContinue')
        .next(checkContinueAfterRerun);
    // Check if this is a single-step rerun (action === 'process_single_step' or 'process_single_step_and_continue')
    // If yes, route directly to processStepSingle with the provided step_index
    // If no, continue with normal workflow initialization flow
    // Note: Check if action field exists first to avoid runtime errors when field is missing
    const checkAction = new sfn.Choice(scope, 'CheckAction')
        .when(sfn.Condition.and(sfn.Condition.isPresent('$.action'), sfn.Condition.or(sfn.Condition.stringEquals('$.action', 'process_single_step'), sfn.Condition.stringEquals('$.action', 'process_single_step_and_continue'))), 
    // Single-step rerun path: processStepSingle -> checkStepResultSingleStepContinue
    processStepSingle.next(checkStepResultSingleStepContinue))
        .otherwise(
    // Normal workflow path: initializeSteps -> computeStepsLength -> ...
    initializeSteps.next(computeStepsLength));
    // Define workflow: Update status -> Check action -> Route accordingly
    // All workflows must use steps format - legacy format is no longer supported
    return updateJobStatus.next(checkAction);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBMkJBLHdFQTBYQztBQW5aRCxtRUFBcUQ7QUFDckQsMkVBQTZEO0FBRTdELHFEQUkwQjtBQVExQjs7Ozs7Ozs7O0dBU0c7QUFDSCxTQUFnQiw4QkFBOEIsQ0FDNUMsS0FBZ0IsRUFDaEIsS0FBb0M7SUFFcEMsTUFBTSxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxLQUFLLENBQUM7SUFFaEUsa0NBQWtDO0lBQ2xDLE1BQU0sZUFBZSxHQUFHLElBQUksS0FBSyxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxpQkFBaUIsRUFBRTtRQUMzRSxLQUFLLEVBQUUsU0FBUztRQUNoQixHQUFHLEVBQUU7WUFDSCxNQUFNLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNqRjtRQUNELGdCQUFnQixFQUFFLGlEQUFpRDtRQUNuRSx3QkFBd0IsRUFBRTtZQUN4QixTQUFTLEVBQUUsUUFBUTtTQUNwQjtRQUNELHlCQUF5QixFQUFFO1lBQ3pCLFNBQVMsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQztZQUM5RCxhQUFhLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1NBQ3BHO1FBQ0QsVUFBVSxFQUFFLGdCQUFnQjtLQUM3QixDQUFDLENBQUM7SUFFSCwrQ0FBK0M7SUFDL0MsTUFBTSwyQkFBMkIsR0FBRyxJQUFBLG1EQUFrQyxFQUFD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LENBQUM7SUFDckQsdURBQXVEO0lBQ3ZELHVCQUF1QixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUNoRDtTQUNBLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFFLGtDQUFrQztJQUU5RCxNQUFNLGlDQUFpQyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsbUNBQW1DLENBQUM7U0FDL0YsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFFakMsZ0hBQWdIO0lBQ2hILDJFQUEyRTtJQUMzRSwyREFBMkQ7SUFDM0QseUZBQXlGO0lBQ3pGLE1BQU0sV0FBVyxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsYUFBYSxDQUFDO1NBQ3JELElBQUksQ0FDSCxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FDZixHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFDbkMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQ2QsR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLHFCQUFxQixDQUFDLEVBQzdELEdBQUcsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFVBQVUsRUFBRSxrQ0FBa0MsQ0FBQyxDQUMzRSxDQUNGO0lBQ0QsaUZBQWlGO0lBQ2pGLGlCQUFpQixDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUMxRDtTQUNBLFNBQVM7SUFDUixxRUFBcUU7SUFDckUsZUFBZSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUN6QyxDQUFDO0lBRUosc0VBQXNFO0lBQ3RFLDZFQUE2RTtJQUM3RSxPQUFPLGVBQWUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDM0MsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgdGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQge1xuICBjcmVhdGVIdG1sR2VuZXJhdGlvbkZhaWx1cmVIYW5kbGVyLFxuICBjcmVhdGVFeGNlcHRpb25IYW5kbGVyQ2hhaW4sXG4gIGNyZWF0ZUpvYkZpbmFsaXplcixcbn0gZnJvbSAnLi9lcnJvci1oYW5kbGVycyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSm9iUHJvY2Vzc29yU3RhdGVNYWNoaW5lUHJvcHMge1xuICBqb2JzVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgd29ya2Zsb3dzVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgam9iUHJvY2Vzc29yTGFtYmRhOiBsYW1iZGEuSUZ1bmN0aW9uO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgdGhlIFN0ZXAgRnVuY3Rpb25zIHN0YXRlIG1hY2hpbmUgZGVmaW5pdGlvbiBmb3Igam9iIHByb2Nlc3NpbmdcbiAqIFxuICogVGhpcyBzdGF0ZSBtYWNoaW5lIG9yY2hlc3RyYXRlcyB0aGUgZXhlY3V0aW9uIG9mIHdvcmtmbG93IGpvYnMsIGhhbmRsaW5nOlxuICogLSBNdWx0aS1zdGVwIHdvcmtmbG93cyB3aXRoIGRlcGVuZGVuY3kgcmVzb2x1dGlvblxuICogLSBIVE1MIGdlbmVyYXRpb24gZm9yIHRlbXBsYXRlc1xuICogLSBFcnJvciBoYW5kbGluZyBhbmQgam9iIHN0YXR1cyB1cGRhdGVzXG4gKiBcbiAqIE5vdGU6IExlZ2FjeSBmb3JtYXQgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZC4gQWxsIHdvcmtmbG93cyBtdXN0IHVzZSBzdGVwcyBmb3JtYXQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVKb2JQcm9jZXNzb3JTdGF0ZU1hY2hpbmUoXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIHByb3BzOiBKb2JQcm9jZXNzb3JTdGF0ZU1hY2hpbmVQcm9wc1xuKTogc2ZuLklDaGFpbmFibGUge1xuICBjb25zdCB7IGpvYnNUYWJsZSwgd29ya2Zsb3dzVGFibGUsIGpvYlByb2Nlc3NvckxhbWJkYSB9ID0gcHJvcHM7XG5cbiAgLy8gVXBkYXRlIGpvYiBzdGF0dXMgdG8gcHJvY2Vzc2luZ1xuICBjb25zdCB1cGRhdGVKb2JTdGF0dXMgPSBuZXcgdGFza3MuRHluYW1vVXBkYXRlSXRlbShzY29wZSwgJ1VwZGF0ZUpvYlN0YXR1cycsIHtcbiAgICB0YWJsZTogam9ic1RhYmxlLFxuICAgIGtleToge1xuICAgICAgam9iX2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSksXG4gICAgfSxcbiAgICB1cGRhdGVFeHByZXNzaW9uOiAnU0VUICNzdGF0dXMgPSA6c3RhdHVzLCB1cGRhdGVkX2F0ID0gOnVwZGF0ZWRfYXQnLFxuICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICB9LFxuICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygncHJvY2Vzc2luZycpLFxuICAgICAgJzp1cGRhdGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQudXBkYXRlUmVzdWx0JyxcbiAgfSk7XG5cbiAgLy8gQ3JlYXRlIGVycm9yIGhhbmRsZXJzIHVzaW5nIGhlbHBlciBmdW5jdGlvbnNcbiAgY29uc3QgaGFuZGxlSHRtbEdlbmVyYXRpb25GYWlsdXJlID0gY3JlYXRlSHRtbEdlbmVyYXRpb25GYWlsdXJlSGFuZGxlcihzY29wZSwgam9ic1RhYmxlKTtcbiAgY29uc3QgcGFyc2VFcnJvckxlZ2FjeSA9IGNyZWF0ZUV4Y2VwdGlvbkhhbmRsZXJDaGFpbihzY29wZSwgJ1BhcnNlRXJyb3JMZWdhY3knLCBqb2JzVGFibGUsIGZhbHNlKTtcbiAgY29uc3QgcGFyc2VFcnJvclN0ZXAgPSBjcmVhdGVFeGNlcHRpb25IYW5kbGVyQ2hhaW4oc2NvcGUsICdQYXJzZUVycm9yU3RlcCcsIGpvYnNUYWJsZSwgdHJ1ZSk7XG5cbiAgLy8gSW5pdGlhbGl6ZSBzdGVwczogTG9hZCB3b3JrZmxvdyBhbmQgZ2V0IHN0ZXAgY291bnRcbiAgY29uc3QgaW5pdGlhbGl6ZVN0ZXBzID0gbmV3IHRhc2tzLkR5bmFtb0dldEl0ZW0oc2NvcGUsICdJbml0aWFsaXplU3RlcHMnLCB7XG4gICAgdGFibGU6IHdvcmtmbG93c1RhYmxlLFxuICAgIGtleToge1xuICAgICAgd29ya2Zsb3dfaWQ6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLndvcmtmbG93X2lkJykpLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQud29ya2Zsb3dEYXRhJyxcbiAgfSk7XG5cbiAgLy8gUHJvY2VzcyBhIHNpbmdsZSBzdGVwIHVzaW5nIExhbWJkYSBmdW5jdGlvbiAoZGVjbGFyZWQgZWFybHkgZm9yIHVzZSBpbiBzZXR1cFN0ZXBMb29wKVxuICBjb25zdCBwcm9jZXNzU3RlcCA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2Uoc2NvcGUsICdQcm9jZXNzU3RlcCcsIHtcbiAgICBsYW1iZGFGdW5jdGlvbjogam9iUHJvY2Vzc29yTGFtYmRhLFxuICAgIHBheWxvYWQ6IHNmbi5UYXNrSW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAnam9iX2lkJzogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpLFxuICAgICAgJ3N0ZXBfaW5kZXgnOiBzZm4uSnNvblBhdGgubnVtYmVyQXQoJyQuc3RlcF9pbmRleCcpLFxuICAgICAgJ3N0ZXBfdHlwZSc6ICd3b3JrZmxvd19zdGVwJyxcbiAgICB9KSxcbiAgICByZXN1bHRQYXRoOiAnJC5wcm9jZXNzUmVzdWx0JyxcbiAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IGZhbHNlLFxuICB9KTtcblxuICAvLyBBZGQgZXJyb3IgaGFuZGxpbmcgZm9yIExhbWJkYSBmYWlsdXJlc1xuICBwcm9jZXNzU3RlcC5hZGRDYXRjaChwYXJzZUVycm9yU3RlcCwge1xuICAgIHJlc3VsdFBhdGg6ICckLmVycm9yJyxcbiAgICBlcnJvcnM6IFsnU3RhdGVzLkFMTCddLFxuICB9KTtcblxuICAvLyBQcm9jZXNzIGEgc2luZ2xlIHN0ZXAgZm9yIHJlcnVuIChzZXBhcmF0ZSBzdGF0ZSB0byBhdm9pZCBcImFscmVhZHkgaGFzIG5leHRcIiBlcnJvcilcbiAgY29uc3QgcHJvY2Vzc1N0ZXBTaW5nbGUgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHNjb3BlLCAnUHJvY2Vzc1N0ZXBTaW5nbGUnLCB7XG4gICAgbGFtYmRhRnVuY3Rpb246IGpvYlByb2Nlc3NvckxhbWJkYSxcbiAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgJ2pvYl9pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgICdzdGVwX2luZGV4Jzogc2ZuLkpzb25QYXRoLm51bWJlckF0KCckLnN0ZXBfaW5kZXgnKSxcbiAgICAgICdzdGVwX3R5cGUnOiAnd29ya2Zsb3dfc3RlcCcsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQucHJvY2Vzc1Jlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBMYW1iZGEgZmFpbHVyZXNcbiAgcHJvY2Vzc1N0ZXBTaW5nbGUuYWRkQ2F0Y2gocGFyc2VFcnJvclN0ZXAsIHtcbiAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgZXJyb3JzOiBbJ1N0YXRlcy5BTEwnXSxcbiAgfSk7XG5cbiAgLy8gUHJvY2VzcyBzdGVwIGZvciBjb250aW51ZS1hZnRlci1yZXJ1biBwYXRoIChzZXBhcmF0ZSBzdGF0ZSB0byBhdm9pZCBcImFscmVhZHkgaGFzIG5leHRcIiBlcnJvcilcbiAgLy8gVGhpcyBpcyBuZWVkZWQgYmVjYXVzZSBwcm9jZXNzU3RlcCBpcyBhbHJlYWR5IGNoYWluZWQgaW4gc2V0dXBTdGVwTG9vcFxuICBjb25zdCBwcm9jZXNzU3RlcENvbnRpbnVlID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZShzY29wZSwgJ1Byb2Nlc3NTdGVwQ29udGludWUnLCB7XG4gICAgbGFtYmRhRnVuY3Rpb246IGpvYlByb2Nlc3NvckxhbWJkYSxcbiAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgJ2pvYl9pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgICdzdGVwX2luZGV4Jzogc2ZuLkpzb25QYXRoLm51bWJlckF0KCckLnN0ZXBfaW5kZXgnKSxcbiAgICAgICdzdGVwX3R5cGUnOiAnd29ya2Zsb3dfc3RlcCcsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQucHJvY2Vzc1Jlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBMYW1iZGEgZmFpbHVyZXNcbiAgcHJvY2Vzc1N0ZXBDb250aW51ZS5hZGRDYXRjaChwYXJzZUVycm9yU3RlcCwge1xuICAgIHJlc3VsdFBhdGg6ICckLmVycm9yJyxcbiAgICBlcnJvcnM6IFsnU3RhdGVzLkFMTCddLFxuICB9KTtcblxuICAvLyBQcm9jZXNzIEhUTUwgZ2VuZXJhdGlvbiBzdGVwXG4gIGNvbnN0IHByb2Nlc3NIdG1sR2VuZXJhdGlvbiA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2Uoc2NvcGUsICdQcm9jZXNzSHRtbEdlbmVyYXRpb24nLCB7XG4gICAgbGFtYmRhRnVuY3Rpb246IGpvYlByb2Nlc3NvckxhbWJkYSxcbiAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgJ2pvYl9pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgICdzdGVwX3R5cGUnOiAnaHRtbF9nZW5lcmF0aW9uJyxcbiAgICB9KSxcbiAgICByZXN1bHRQYXRoOiAnJC5odG1sUmVzdWx0JyxcbiAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IGZhbHNlLFxuICB9KTtcblxuICAvLyBBZGQgZXJyb3IgaGFuZGxpbmcgZm9yIEhUTUwgZ2VuZXJhdGlvbiBmYWlsdXJlc1xuICAvLyBOb3RlOiBVc2UgcGFyc2VFcnJvckxlZ2FjeSAobm90IHBhcnNlRXJyb3JTdGVwKSBiZWNhdXNlIEhUTUwgZ2VuZXJhdGlvblxuICAvLyBydW5zIGFmdGVyIGFsbCB3b3JrZmxvdyBzdGVwcyBhcmUgY29tcGxldGUsIHNvIHN0ZXBfaW5kZXggaXMgbm90IGluIGNvbnRleHRcbiAgcHJvY2Vzc0h0bWxHZW5lcmF0aW9uLmFkZENhdGNoKHBhcnNlRXJyb3JMZWdhY3ksIHtcbiAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgZXJyb3JzOiBbJ1N0YXRlcy5BTEwnXSxcbiAgfSk7XG5cbiAgLy8gUHJvY2VzcyBIVE1MIGdlbmVyYXRpb24gc3RlcCBmb3IgY29udGludWUtYWZ0ZXItcmVydW4gcGF0aCAoc2VwYXJhdGUgc3RhdGUgdG8gYXZvaWQgXCJhbHJlYWR5IGhhcyBuZXh0XCIgZXJyb3IpXG4gIGNvbnN0IHByb2Nlc3NIdG1sR2VuZXJhdGlvbkNvbnRpbnVlID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZShzY29wZSwgJ1Byb2Nlc3NIdG1sR2VuZXJhdGlvbkNvbnRpbnVlJywge1xuICAgIGxhbWJkYUZ1bmN0aW9uOiBqb2JQcm9jZXNzb3JMYW1iZGEsXG4gICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICdqb2JfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJyksXG4gICAgICAnc3RlcF90eXBlJzogJ2h0bWxfZ2VuZXJhdGlvbicsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQuaHRtbFJlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBIVE1MIGdlbmVyYXRpb24gZmFpbHVyZXNcbiAgcHJvY2Vzc0h0bWxHZW5lcmF0aW9uQ29udGludWUuYWRkQ2F0Y2gocGFyc2VFcnJvckxlZ2FjeSwge1xuICAgIHJlc3VsdFBhdGg6ICckLmVycm9yJyxcbiAgICBlcnJvcnM6IFsnU3RhdGVzLkFMTCddLFxuICB9KTtcblxuICAvLyBDcmVhdGUgcmV1c2FibGUgZmluYWxpemUgam9iIHRhc2sgdXNpbmcgaGVscGVyXG4gIGNvbnN0IGZpbmFsaXplSm9iID0gY3JlYXRlSm9iRmluYWxpemVyKHNjb3BlLCAnRmluYWxpemVKb2InLCBqb2JzVGFibGUpO1xuXG4gIC8vIENoZWNrIEhUTUwgZ2VuZXJhdGlvbiByZXN1bHRcbiAgY29uc3QgY2hlY2tIdG1sUmVzdWx0ID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja0h0bWxSZXN1bHQnKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5ib29sZWFuRXF1YWxzKCckLmh0bWxSZXN1bHQuUGF5bG9hZC5zdWNjZXNzJywgZmFsc2UpLFxuICAgICAgaGFuZGxlSHRtbEdlbmVyYXRpb25GYWlsdXJlXG4gICAgKVxuICAgIC5vdGhlcndpc2UoZmluYWxpemVKb2IpO1xuXG4gIC8vIENoZWNrIGlmIG1vcmUgc3RlcHMgcmVtYWluIC0gbG9vcHMgYmFjayB0byBwcm9jZXNzU3RlcCBpZiBtb3JlIHN0ZXBzIChkZWNsYXJlZCBiZWZvcmUgaW5jcmVtZW50U3RlcClcbiAgY29uc3QgY2hlY2tNb3JlU3RlcHMgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrTW9yZVN0ZXBzJylcbiAgICAud2hlbihcbiAgICAgIHNmbi5Db25kaXRpb24ubnVtYmVyTGVzc1RoYW5Kc29uUGF0aCgnJC5zdGVwX2luZGV4JywgJyQudG90YWxfc3RlcHMnKSxcbiAgICAgIHByb2Nlc3NTdGVwICAvLyBMb29wIGJhY2sgdG8gcHJvY2VzcyBuZXh0IHN0ZXBcbiAgICApXG4gICAgLm90aGVyd2lzZShcbiAgICAgIC8vIEFsbCB3b3JrZmxvdyBzdGVwcyBjb21wbGV0ZSAtIGNoZWNrIGlmIEhUTUwgZ2VuZXJhdGlvbiBpcyBuZWVkZWRcbiAgICAgIG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tJZkh0bWxOZWVkZWQnKVxuICAgICAgICAud2hlbihcbiAgICAgICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQuaGFzX3RlbXBsYXRlJywgdHJ1ZSksXG4gICAgICAgICAgcHJvY2Vzc0h0bWxHZW5lcmF0aW9uLm5leHQoY2hlY2tIdG1sUmVzdWx0KVxuICAgICAgICApXG4gICAgICAgIC5vdGhlcndpc2UoZmluYWxpemVKb2IpXG4gICAgKTtcblxuICAvLyBDaGVjayBpZiBzdGVwIHN1Y2NlZWRlZCAtIGNvbm5lY3RzIHRvIGluY3JlbWVudFN0ZXAgd2hpY2ggY29ubmVjdHMgdG8gY2hlY2tNb3JlU3RlcHNcbiAgY29uc3QgaW5jcmVtZW50U3RlcCA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ0luY3JlbWVudFN0ZXAnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICdzdGVwX2luZGV4LiQnOiAnU3RhdGVzLk1hdGhBZGQoJC5zdGVwX2luZGV4LCAxKScsXG4gICAgICAndG90YWxfc3RlcHMuJCc6ICckLnRvdGFsX3N0ZXBzJyxcbiAgICAgICdoYXNfdGVtcGxhdGUuJCc6ICckLmhhc190ZW1wbGF0ZScsXG4gICAgICAndGVtcGxhdGVfaWQuJCc6ICckLnRlbXBsYXRlX2lkJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChjaGVja01vcmVTdGVwcyk7XG5cbiAgY29uc3QgY2hlY2tTdGVwUmVzdWx0ID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja1N0ZXBSZXN1bHQnKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5ib29sZWFuRXF1YWxzKCckLnByb2Nlc3NSZXN1bHQuUGF5bG9hZC5zdWNjZXNzJywgZmFsc2UpLFxuICAgICAgaW5jcmVtZW50U3RlcFxuICAgIClcbiAgICAub3RoZXJ3aXNlKGluY3JlbWVudFN0ZXApO1xuXG4gIC8vIFJlc29sdmUgc3RlcCBkZXBlbmRlbmNpZXMgLSBjYWxscyBMYW1iZGEgdG8gYnVpbGQgZXhlY3V0aW9uIHBsYW5cbiAgY29uc3QgcmVzb2x2ZURlcGVuZGVuY2llcyA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2Uoc2NvcGUsICdSZXNvbHZlRGVwZW5kZW5jaWVzJywge1xuICAgIGxhbWJkYUZ1bmN0aW9uOiBqb2JQcm9jZXNzb3JMYW1iZGEsXG4gICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICdqb2JfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJyksXG4gICAgICAnd29ya2Zsb3dfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQud29ya2Zsb3dfaWQnKSxcbiAgICAgICdhY3Rpb24nOiAncmVzb2x2ZV9kZXBlbmRlbmNpZXMnLFxuICAgIH0pLFxuICAgIHJlc3VsdFBhdGg6ICckLmV4ZWN1dGlvblBsYW4nLFxuICAgIHJldHJ5T25TZXJ2aWNlRXhjZXB0aW9uczogZmFsc2UsXG4gIH0pO1xuXG4gIC8vIFNldHVwIHN0ZXAgbG9vcCBmb3IgbXVsdGktc3RlcCB3b3JrZmxvd3NcbiAgY29uc3Qgc2V0dXBTdGVwTG9vcCA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ1NldHVwU3RlcExvb3AnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICdzdGVwX2luZGV4JzogMCxcbiAgICAgICd0b3RhbF9zdGVwcy4kJzogJyQuc3RlcHNfbGVuZ3RoJyxcbiAgICAgICdoYXNfdGVtcGxhdGUuJCc6ICckLmhhc190ZW1wbGF0ZScsXG4gICAgICAndGVtcGxhdGVfaWQuJCc6ICckLnRlbXBsYXRlX2lkJyxcbiAgICAgICdleGVjdXRpb25fcGxhbi4kJzogJyQuZXhlY3V0aW9uUGxhbi5QYXlsb2FkJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChwcm9jZXNzU3RlcCkubmV4dChjaGVja1N0ZXBSZXN1bHQpO1xuXG4gIC8vIEFsbCB3b3JrZmxvd3MgbXVzdCB1c2Ugc3RlcHMgZm9ybWF0IC0gcm91dGUgZGlyZWN0bHkgdG8gZGVwZW5kZW5jeSByZXNvbHV0aW9uXG4gIC8vIElmIHdvcmtmbG93IGhhcyBubyBzdGVwcywgdGhlIExhbWJkYSB3aWxsIHRocm93IGFuIGVycm9yXG4gIGNvbnN0IGNoZWNrV29ya2Zsb3dUeXBlID0gcmVzb2x2ZURlcGVuZGVuY2llcy5uZXh0KHNldHVwU3RlcExvb3ApO1xuXG4gIC8vIFNldCBoYXNfdGVtcGxhdGUgdG8gdHJ1ZSB3aGVuIHRlbXBsYXRlIGV4aXN0c1xuICBjb25zdCBzZXRIYXNUZW1wbGF0ZVRydWUgPSBuZXcgc2ZuLlBhc3Moc2NvcGUsICdTZXRIYXNUZW1wbGF0ZVRydWUnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICd3b3JrZmxvd0RhdGEuJCc6ICckLndvcmtmbG93RGF0YScsXG4gICAgICAnc3RlcHNfbGVuZ3RoLiQnOiAnJC5zdGVwc19sZW5ndGgnLFxuICAgICAgJ2hhc190ZW1wbGF0ZSc6IHRydWUsXG4gICAgICAndGVtcGxhdGVfaWQuJCc6ICckLndvcmtmbG93RGF0YS5JdGVtLnRlbXBsYXRlX2lkLlMnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrV29ya2Zsb3dUeXBlKTtcblxuICAvLyBTZXQgaGFzX3RlbXBsYXRlIHRvIGZhbHNlIHdoZW4gdGVtcGxhdGUgZG9lc24ndCBleGlzdFxuICBjb25zdCBzZXRIYXNUZW1wbGF0ZUZhbHNlID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnU2V0SGFzVGVtcGxhdGVGYWxzZScsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3dvcmtmbG93RGF0YS4kJzogJyQud29ya2Zsb3dEYXRhJyxcbiAgICAgICdzdGVwc19sZW5ndGguJCc6ICckLnN0ZXBzX2xlbmd0aCcsXG4gICAgICAnaGFzX3RlbXBsYXRlJzogZmFsc2UsXG4gICAgICAndGVtcGxhdGVfaWQnOiAnJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChjaGVja1dvcmtmbG93VHlwZSk7XG5cbiAgLy8gQ2hlY2sgaWYgdGVtcGxhdGUgZXhpc3RzIGFuZCBzZXQgaGFzX3RlbXBsYXRlIGJvb2xlYW5cbiAgY29uc3QgY2hlY2tUZW1wbGF0ZUV4aXN0cyA9IG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tUZW1wbGF0ZUV4aXN0cycpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmlzUHJlc2VudCgnJC53b3JrZmxvd0RhdGEuSXRlbS50ZW1wbGF0ZV9pZC5TJyksXG4gICAgICBzZXRIYXNUZW1wbGF0ZVRydWVcbiAgICApXG4gICAgLm90aGVyd2lzZShzZXRIYXNUZW1wbGF0ZUZhbHNlKTtcblxuICAvLyBDb21wdXRlIHN0ZXBzIGxlbmd0aCAtIGhhbmRsZSBib3RoIG5ldyAod2l0aCBzdGVwcykgYW5kIGxlZ2FjeSAod2l0aG91dCBzdGVwcykgd29ya2Zsb3dzXG4gIC8vIEFsbCB3b3JrZmxvd3MgbXVzdCBoYXZlIHN0ZXBzIC0gY29tcHV0ZSBzdGVwcyBsZW5ndGggZGlyZWN0bHlcbiAgY29uc3QgY29tcHV0ZVN0ZXBzTGVuZ3RoID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnQ29tcHV0ZVN0ZXBzTGVuZ3RoJywge1xuICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICdqb2JfaWQuJCc6ICckLmpvYl9pZCcsXG4gICAgICAnd29ya2Zsb3dfaWQuJCc6ICckLndvcmtmbG93X2lkJyxcbiAgICAgICdzdWJtaXNzaW9uX2lkLiQnOiAnJC5zdWJtaXNzaW9uX2lkJyxcbiAgICAgICd0ZW5hbnRfaWQuJCc6ICckLnRlbmFudF9pZCcsXG4gICAgICAnd29ya2Zsb3dEYXRhLiQnOiAnJC53b3JrZmxvd0RhdGEnLFxuICAgICAgJ3N0ZXBzX2xlbmd0aC4kJzogJ1N0YXRlcy5BcnJheUxlbmd0aCgkLndvcmtmbG93RGF0YS5JdGVtLnN0ZXBzLkwpJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChjaGVja1RlbXBsYXRlRXhpc3RzKTtcblxuICAvLyBMb2FkIHdvcmtmbG93IGRhdGEgZm9yIGNvbnRpbnVlIHBhdGggKG5lZWRlZCB3aGVuIGNvbnRpbnVpbmcgYWZ0ZXIgcmVydW4pXG4gIGNvbnN0IGxvYWRXb3JrZmxvd0ZvckNvbnRpbnVlID0gbmV3IHRhc2tzLkR5bmFtb0dldEl0ZW0oc2NvcGUsICdMb2FkV29ya2Zsb3dGb3JDb250aW51ZScsIHtcbiAgICB0YWJsZTogd29ya2Zsb3dzVGFibGUsXG4gICAga2V5OiB7XG4gICAgICB3b3JrZmxvd19pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQud29ya2Zsb3dfaWQnKSksXG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJC53b3JrZmxvd0RhdGEnLFxuICB9KTtcblxuICAvLyBDaGVjayBpZiBtb3JlIHN0ZXBzIHJlbWFpbiBhZnRlciByZXJ1biAoZm9yIGNvbnRpbnVlIHBhdGgpXG4gIC8vIEFmdGVyIHNldHVwQ29udGludWVQYXRoLCB3ZSByb3V0ZSB0byBpbmNyZW1lbnRTdGVwIHdoaWNoIHdpbGwgaGFuZGxlIHRoZSBub3JtYWwgd29ya2Zsb3cgbG9vcFxuICAvLyBEZWZpbmVkIGJlZm9yZSBzZXRIYXNUZW1wbGF0ZVRydWVDb250aW51ZS9zZXRIYXNUZW1wbGF0ZUZhbHNlQ29udGludWUgYmVjYXVzZSBpdCdzIHJlZmVyZW5jZWQgdGhlcmVcbiAgY29uc3QgY2hlY2tNb3JlU3RlcHNBZnRlclJlcnVuID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja01vcmVTdGVwc0FmdGVyUmVydW4nKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5udW1iZXJMZXNzVGhhbkpzb25QYXRoKCckLnN0ZXBfaW5kZXgnLCAnJC50b3RhbF9zdGVwcycpLFxuICAgICAgcHJvY2Vzc1N0ZXBDb250aW51ZS5uZXh0KGNoZWNrU3RlcFJlc3VsdCkgIC8vIENvbnRpbnVlIHdpdGggbmV4dCBzdGVwLCB0aGVuIGluY3JlbWVudFN0ZXAgd2lsbCBoYW5kbGUgdGhlIGxvb3BcbiAgICApXG4gICAgLm90aGVyd2lzZShcbiAgICAgIC8vIEFsbCBzdGVwcyBjb21wbGV0ZSAtIGNoZWNrIGlmIEhUTUwgZ2VuZXJhdGlvbiBpcyBuZWVkZWRcbiAgICAgIG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tJZkh0bWxOZWVkZWRBZnRlclJlcnVuJylcbiAgICAgICAgLndoZW4oXG4gICAgICAgICAgc2ZuLkNvbmRpdGlvbi5ib29sZWFuRXF1YWxzKCckLmhhc190ZW1wbGF0ZScsIHRydWUpLFxuICAgICAgICAgIHByb2Nlc3NIdG1sR2VuZXJhdGlvbkNvbnRpbnVlLm5leHQoY2hlY2tIdG1sUmVzdWx0KVxuICAgICAgICApXG4gICAgICAgIC5vdGhlcndpc2UoZmluYWxpemVKb2IpXG4gICAgKTtcblxuICAvLyBTZXQgaGFzX3RlbXBsYXRlIGZvciBjb250aW51ZSBwYXRoIHdoZW4gdGVtcGxhdGUgZXhpc3RzXG4gIGNvbnN0IHNldEhhc1RlbXBsYXRlVHJ1ZUNvbnRpbnVlID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnU2V0SGFzVGVtcGxhdGVUcnVlQ29udGludWUnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICdzdGVwX2luZGV4LiQnOiAnU3RhdGVzLk1hdGhBZGQoJC5zdGVwX2luZGV4LCAxKScsXG4gICAgICAndG90YWxfc3RlcHMuJCc6ICdTdGF0ZXMuQXJyYXlMZW5ndGgoJC53b3JrZmxvd0RhdGEuSXRlbS5zdGVwcy5MKScsXG4gICAgICAnaGFzX3RlbXBsYXRlJzogdHJ1ZSxcbiAgICAgICd0ZW1wbGF0ZV9pZC4kJzogJyQud29ya2Zsb3dEYXRhLkl0ZW0udGVtcGxhdGVfaWQuUycsXG4gICAgICAnd29ya2Zsb3dEYXRhLiQnOiAnJC53b3JrZmxvd0RhdGEnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrTW9yZVN0ZXBzQWZ0ZXJSZXJ1bik7XG5cbiAgLy8gU2V0IGhhc190ZW1wbGF0ZSBmb3IgY29udGludWUgcGF0aCB3aGVuIHRlbXBsYXRlIGRvZXNuJ3QgZXhpc3RcbiAgY29uc3Qgc2V0SGFzVGVtcGxhdGVGYWxzZUNvbnRpbnVlID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnU2V0SGFzVGVtcGxhdGVGYWxzZUNvbnRpbnVlJywge1xuICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICdqb2JfaWQuJCc6ICckLmpvYl9pZCcsXG4gICAgICAnd29ya2Zsb3dfaWQuJCc6ICckLndvcmtmbG93X2lkJyxcbiAgICAgICdzdWJtaXNzaW9uX2lkLiQnOiAnJC5zdWJtaXNzaW9uX2lkJyxcbiAgICAgICd0ZW5hbnRfaWQuJCc6ICckLnRlbmFudF9pZCcsXG4gICAgICAnc3RlcF9pbmRleC4kJzogJ1N0YXRlcy5NYXRoQWRkKCQuc3RlcF9pbmRleCwgMSknLFxuICAgICAgJ3RvdGFsX3N0ZXBzLiQnOiAnU3RhdGVzLkFycmF5TGVuZ3RoKCQud29ya2Zsb3dEYXRhLkl0ZW0uc3RlcHMuTCknLFxuICAgICAgJ2hhc190ZW1wbGF0ZSc6IGZhbHNlLFxuICAgICAgJ3RlbXBsYXRlX2lkJzogJycsXG4gICAgICAnd29ya2Zsb3dEYXRhLiQnOiAnJC53b3JrZmxvd0RhdGEnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrTW9yZVN0ZXBzQWZ0ZXJSZXJ1bik7XG5cbiAgLy8gQ2hlY2sgaWYgdGVtcGxhdGUgZXhpc3RzIGZvciBjb250aW51ZSBwYXRoXG4gIGNvbnN0IGNoZWNrVGVtcGxhdGVFeGlzdHNDb250aW51ZSA9IG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tUZW1wbGF0ZUV4aXN0c0NvbnRpbnVlJylcbiAgICAud2hlbihcbiAgICAgIHNmbi5Db25kaXRpb24uaXNQcmVzZW50KCckLndvcmtmbG93RGF0YS5JdGVtLnRlbXBsYXRlX2lkLlMnKSxcbiAgICAgIHNldEhhc1RlbXBsYXRlVHJ1ZUNvbnRpbnVlXG4gICAgKVxuICAgIC5vdGhlcndpc2Uoc2V0SGFzVGVtcGxhdGVGYWxzZUNvbnRpbnVlKTtcblxuICAvLyBTZXR1cCBjb250aW51ZSBwYXRoIGFmdGVyIHNpbmdsZSBzdGVwIHJlcnVuXG4gIGNvbnN0IHNldHVwQ29udGludWVQYXRoID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnU2V0dXBDb250aW51ZVBhdGgnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICdzdGVwX2luZGV4LiQnOiAnU3RhdGVzLk1hdGhBZGQoJC5zdGVwX2luZGV4LCAxKScsXG4gICAgICAndG90YWxfc3RlcHMuJCc6ICdTdGF0ZXMuQXJyYXlMZW5ndGgoJC53b3JrZmxvd0RhdGEuSXRlbS5zdGVwcy5MKScsXG4gICAgICAnd29ya2Zsb3dEYXRhLiQnOiAnJC53b3JrZmxvd0RhdGEnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrVGVtcGxhdGVFeGlzdHNDb250aW51ZSk7XG5cbiAgLy8gRGVjaWRlIHdoZXRoZXIgdG8gY29udGludWUgYWZ0ZXIgc2luZ2xlLXN0ZXAgcmVydW4sIHJlZ2FyZGxlc3Mgb2Ygc3RlcCBzdWNjZXNzXG4gIGNvbnN0IGNoZWNrQ29udGludWVBZnRlclJlcnVuID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja0NvbnRpbnVlQWZ0ZXJSZXJ1bicpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQuY29udGludWVfYWZ0ZXInLCB0cnVlKSxcbiAgICAgIC8vIExvYWQgd29ya2Zsb3cgZGF0YSBhbmQgY29udGludWUgd2l0aCByZW1haW5pbmcgc3RlcHNcbiAgICAgIGxvYWRXb3JrZmxvd0ZvckNvbnRpbnVlLm5leHQoc2V0dXBDb250aW51ZVBhdGgpXG4gICAgKVxuICAgIC5vdGhlcndpc2UoZmluYWxpemVKb2IpOyAgLy8gSnVzdCBmaW5hbGl6ZSBpZiBub3QgY29udGludWluZ1xuXG4gIGNvbnN0IGNoZWNrU3RlcFJlc3VsdFNpbmdsZVN0ZXBDb250aW51ZSA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ0NoZWNrU3RlcFJlc3VsdFNpbmdsZVN0ZXBDb250aW51ZScpXG4gICAgLm5leHQoY2hlY2tDb250aW51ZUFmdGVyUmVydW4pO1xuXG4gIC8vIENoZWNrIGlmIHRoaXMgaXMgYSBzaW5nbGUtc3RlcCByZXJ1biAoYWN0aW9uID09PSAncHJvY2Vzc19zaW5nbGVfc3RlcCcgb3IgJ3Byb2Nlc3Nfc2luZ2xlX3N0ZXBfYW5kX2NvbnRpbnVlJylcbiAgLy8gSWYgeWVzLCByb3V0ZSBkaXJlY3RseSB0byBwcm9jZXNzU3RlcFNpbmdsZSB3aXRoIHRoZSBwcm92aWRlZCBzdGVwX2luZGV4XG4gIC8vIElmIG5vLCBjb250aW51ZSB3aXRoIG5vcm1hbCB3b3JrZmxvdyBpbml0aWFsaXphdGlvbiBmbG93XG4gIC8vIE5vdGU6IENoZWNrIGlmIGFjdGlvbiBmaWVsZCBleGlzdHMgZmlyc3QgdG8gYXZvaWQgcnVudGltZSBlcnJvcnMgd2hlbiBmaWVsZCBpcyBtaXNzaW5nXG4gIGNvbnN0IGNoZWNrQWN0aW9uID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja0FjdGlvbicpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmFuZChcbiAgICAgICAgc2ZuLkNvbmRpdGlvbi5pc1ByZXNlbnQoJyQuYWN0aW9uJyksXG4gICAgICAgIHNmbi5Db25kaXRpb24ub3IoXG4gICAgICAgICAgc2ZuLkNvbmRpdGlvbi5zdHJpbmdFcXVhbHMoJyQuYWN0aW9uJywgJ3Byb2Nlc3Nfc2luZ2xlX3N0ZXAnKSxcbiAgICAgICAgICBzZm4uQ29uZGl0aW9uLnN0cmluZ0VxdWFscygnJC5hY3Rpb24nLCAncHJvY2Vzc19zaW5nbGVfc3RlcF9hbmRfY29udGludWUnKVxuICAgICAgICApXG4gICAgICApLFxuICAgICAgLy8gU2luZ2xlLXN0ZXAgcmVydW4gcGF0aDogcHJvY2Vzc1N0ZXBTaW5nbGUgLT4gY2hlY2tTdGVwUmVzdWx0U2luZ2xlU3RlcENvbnRpbnVlXG4gICAgICBwcm9jZXNzU3RlcFNpbmdsZS5uZXh0KGNoZWNrU3RlcFJlc3VsdFNpbmdsZVN0ZXBDb250aW51ZSlcbiAgICApXG4gICAgLm90aGVyd2lzZShcbiAgICAgIC8vIE5vcm1hbCB3b3JrZmxvdyBwYXRoOiBpbml0aWFsaXplU3RlcHMgLT4gY29tcHV0ZVN0ZXBzTGVuZ3RoIC0+IC4uLlxuICAgICAgaW5pdGlhbGl6ZVN0ZXBzLm5leHQoY29tcHV0ZVN0ZXBzTGVuZ3RoKVxuICAgICk7XG5cbiAgLy8gRGVmaW5lIHdvcmtmbG93OiBVcGRhdGUgc3RhdHVzIC0+IENoZWNrIGFjdGlvbiAtPiBSb3V0ZSBhY2NvcmRpbmdseVxuICAvLyBBbGwgd29ya2Zsb3dzIG11c3QgdXNlIHN0ZXBzIGZvcm1hdCAtIGxlZ2FjeSBmb3JtYXQgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZFxuICByZXR1cm4gdXBkYXRlSm9iU3RhdHVzLm5leHQoY2hlY2tBY3Rpb24pO1xufVxuXG4iXX0=