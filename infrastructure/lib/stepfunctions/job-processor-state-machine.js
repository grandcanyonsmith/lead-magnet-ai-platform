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
    const handleStepFailure = (0, error_handlers_1.createStepFailureHandler)(scope, jobsTable);
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
        .when(sfn.Condition.booleanEquals('$.processResult.Payload.success', false), handleStepFailure)
        .otherwise(incrementStep);
    // Check step result for single-step rerun (goes directly to finalizeJob instead of incrementing)
    const checkStepResultSingleStep = new sfn.Choice(scope, 'CheckStepResultSingleStep')
        .when(sfn.Condition.booleanEquals('$.processResult.Payload.success', false), handleStepFailure)
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
    // Check if this is a single-step rerun (action === 'process_single_step')
    // If yes, route directly to processStepSingle with the provided step_index, then finalize
    // If no, continue with normal workflow initialization flow
    const checkAction = new sfn.Choice(scope, 'CheckAction')
        .when(sfn.Condition.stringEquals('$.action', 'process_single_step'), 
    // Single-step rerun path: processStepSingle -> checkStepResultSingleStep -> finalizeJob
    processStepSingle.next(checkStepResultSingleStep))
        .otherwise(
    // Normal workflow path: initializeSteps -> computeStepsLength -> ...
    initializeSteps.next(computeStepsLength));
    // Define workflow: Update status -> Check action -> Route accordingly
    // All workflows must use steps format - legacy format is no longer supported
    return updateJobStatus.next(checkAction);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNEJBLHdFQTJQQztBQXJSRCxtRUFBcUQ7QUFDckQsMkVBQTZEO0FBRTdELHFEQUswQjtBQVExQjs7Ozs7Ozs7O0dBU0c7QUFDSCxTQUFnQiw4QkFBOEIsQ0FDNUMsS0FBZ0IsRUFDaEIsS0FBb0M7SUFFcEMsTUFBTSxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxLQUFLLENBQUM7SUFFaEUsa0NBQWtDO0lBQ2xDLE1BQU0sZUFBZSxHQUFHLElBQUksS0FBSyxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxpQkFBaUIsRUFBRTtRQUMzRSxLQUFLLEVBQUUsU0FBUztRQUNoQixHQUFHLEVBQUU7WUFDSCxNQUFNLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNqRjtRQUNELGdCQUFnQixFQUFFLGlEQUFpRDtRQUNuRSx3QkFBd0IsRUFBRTtZQUN4QixTQUFTLEVBQUUsUUFBUTtTQUNwQjtRQUNELHlCQUF5QixFQUFFO1lBQ3pCLFNBQVMsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQztZQUM5RCxhQUFhLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1NBQ3BHO1FBQ0QsVUFBVSxFQUFFLGdCQUFnQjtLQUM3QixDQUFDLENBQUM7SUFFSCwrQ0FBK0M7SUFDL0MsTUFBTSxpQkFBaUIsR0FBRyxJQUFBLHlDQUF3QixFQUFD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V0FBVyxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsYUFBYSxDQUFDO1NBQ3JELElBQUksQ0FDSCxHQUFHLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUscUJBQXFCLENBQUM7SUFDN0Qsd0ZBQXdGO0lBQ3hGLGlCQUFpQixDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUNsRDtTQUNBLFNBQVM7SUFDUixxRUFBcUU7SUFDckUsZUFBZSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUN6QyxDQUFDO0lBRUosc0VBQXNFO0lBQ3RFLDZFQUE2RTtJQUM3RSxPQUFPLGVBQWUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDM0MsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgdGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQge1xuICBjcmVhdGVTdGVwRmFpbHVyZUhhbmRsZXIsXG4gIGNyZWF0ZUh0bWxHZW5lcmF0aW9uRmFpbHVyZUhhbmRsZXIsXG4gIGNyZWF0ZUV4Y2VwdGlvbkhhbmRsZXJDaGFpbixcbiAgY3JlYXRlSm9iRmluYWxpemVyLFxufSBmcm9tICcuL2Vycm9yLWhhbmRsZXJzJztcblxuZXhwb3J0IGludGVyZmFjZSBKb2JQcm9jZXNzb3JTdGF0ZU1hY2hpbmVQcm9wcyB7XG4gIGpvYnNUYWJsZTogZHluYW1vZGIuSVRhYmxlO1xuICB3b3JrZmxvd3NUYWJsZTogZHluYW1vZGIuSVRhYmxlO1xuICBqb2JQcm9jZXNzb3JMYW1iZGE6IGxhbWJkYS5JRnVuY3Rpb247XG59XG5cbi8qKlxuICogQ3JlYXRlcyB0aGUgU3RlcCBGdW5jdGlvbnMgc3RhdGUgbWFjaGluZSBkZWZpbml0aW9uIGZvciBqb2IgcHJvY2Vzc2luZ1xuICogXG4gKiBUaGlzIHN0YXRlIG1hY2hpbmUgb3JjaGVzdHJhdGVzIHRoZSBleGVjdXRpb24gb2Ygd29ya2Zsb3cgam9icywgaGFuZGxpbmc6XG4gKiAtIE11bHRpLXN0ZXAgd29ya2Zsb3dzIHdpdGggZGVwZW5kZW5jeSByZXNvbHV0aW9uXG4gKiAtIEhUTUwgZ2VuZXJhdGlvbiBmb3IgdGVtcGxhdGVzXG4gKiAtIEVycm9yIGhhbmRsaW5nIGFuZCBqb2Igc3RhdHVzIHVwZGF0ZXNcbiAqIFxuICogTm90ZTogTGVnYWN5IGZvcm1hdCBpcyBubyBsb25nZXIgc3VwcG9ydGVkLiBBbGwgd29ya2Zsb3dzIG11c3QgdXNlIHN0ZXBzIGZvcm1hdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUpvYlByb2Nlc3NvclN0YXRlTWFjaGluZShcbiAgc2NvcGU6IENvbnN0cnVjdCxcbiAgcHJvcHM6IEpvYlByb2Nlc3NvclN0YXRlTWFjaGluZVByb3BzXG4pOiBzZm4uSUNoYWluYWJsZSB7XG4gIGNvbnN0IHsgam9ic1RhYmxlLCB3b3JrZmxvd3NUYWJsZSwgam9iUHJvY2Vzc29yTGFtYmRhIH0gPSBwcm9wcztcblxuICAvLyBVcGRhdGUgam9iIHN0YXR1cyB0byBwcm9jZXNzaW5nXG4gIGNvbnN0IHVwZGF0ZUpvYlN0YXR1cyA9IG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHNjb3BlLCAnVXBkYXRlSm9iU3RhdHVzJywge1xuICAgIHRhYmxlOiBqb2JzVGFibGUsXG4gICAga2V5OiB7XG4gICAgICBqb2JfaWQ6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpKSxcbiAgICB9LFxuICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIHVwZGF0ZWRfYXQgPSA6dXBkYXRlZF9hdCcsXG4gICAgZXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgIH0sXG4gICAgZXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgJzpzdGF0dXMnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdwcm9jZXNzaW5nJyksXG4gICAgICAnOnVwZGF0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJC51cGRhdGVSZXN1bHQnLFxuICB9KTtcblxuICAvLyBDcmVhdGUgZXJyb3IgaGFuZGxlcnMgdXNpbmcgaGVscGVyIGZ1bmN0aW9uc1xuICBjb25zdCBoYW5kbGVTdGVwRmFpbHVyZSA9IGNyZWF0ZVN0ZXBGYWlsdXJlSGFuZGxlcihzY29wZSwgam9ic1RhYmxlKTtcbiAgY29uc3QgaGFuZGxlSHRtbEdlbmVyYXRpb25GYWlsdXJlID0gY3JlYXRlSHRtbEdlbmVyYXRpb25GYWlsdXJlSGFuZGxlcihzY29wZSwgam9ic1RhYmxlKTtcbiAgY29uc3QgcGFyc2VFcnJvckxlZ2FjeSA9IGNyZWF0ZUV4Y2VwdGlvbkhhbmRsZXJDaGFpbihzY29wZSwgJ1BhcnNlRXJyb3JMZWdhY3knLCBqb2JzVGFibGUsIGZhbHNlKTtcbiAgY29uc3QgcGFyc2VFcnJvclN0ZXAgPSBjcmVhdGVFeGNlcHRpb25IYW5kbGVyQ2hhaW4oc2NvcGUsICdQYXJzZUVycm9yU3RlcCcsIGpvYnNUYWJsZSwgdHJ1ZSk7XG5cbiAgLy8gSW5pdGlhbGl6ZSBzdGVwczogTG9hZCB3b3JrZmxvdyBhbmQgZ2V0IHN0ZXAgY291bnRcbiAgY29uc3QgaW5pdGlhbGl6ZVN0ZXBzID0gbmV3IHRhc2tzLkR5bmFtb0dldEl0ZW0oc2NvcGUsICdJbml0aWFsaXplU3RlcHMnLCB7XG4gICAgdGFibGU6IHdvcmtmbG93c1RhYmxlLFxuICAgIGtleToge1xuICAgICAgd29ya2Zsb3dfaWQ6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLndvcmtmbG93X2lkJykpLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQud29ya2Zsb3dEYXRhJyxcbiAgfSk7XG5cbiAgLy8gUHJvY2VzcyBhIHNpbmdsZSBzdGVwIHVzaW5nIExhbWJkYSBmdW5jdGlvbiAoZGVjbGFyZWQgZWFybHkgZm9yIHVzZSBpbiBzZXR1cFN0ZXBMb29wKVxuICBjb25zdCBwcm9jZXNzU3RlcCA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2Uoc2NvcGUsICdQcm9jZXNzU3RlcCcsIHtcbiAgICBsYW1iZGFGdW5jdGlvbjogam9iUHJvY2Vzc29yTGFtYmRhLFxuICAgIHBheWxvYWQ6IHNmbi5UYXNrSW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAnam9iX2lkJzogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpLFxuICAgICAgJ3N0ZXBfaW5kZXgnOiBzZm4uSnNvblBhdGgubnVtYmVyQXQoJyQuc3RlcF9pbmRleCcpLFxuICAgICAgJ3N0ZXBfdHlwZSc6ICd3b3JrZmxvd19zdGVwJyxcbiAgICB9KSxcbiAgICByZXN1bHRQYXRoOiAnJC5wcm9jZXNzUmVzdWx0JyxcbiAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IGZhbHNlLFxuICB9KTtcblxuICAvLyBBZGQgZXJyb3IgaGFuZGxpbmcgZm9yIExhbWJkYSBmYWlsdXJlc1xuICBwcm9jZXNzU3RlcC5hZGRDYXRjaChwYXJzZUVycm9yU3RlcCwge1xuICAgIHJlc3VsdFBhdGg6ICckLmVycm9yJyxcbiAgICBlcnJvcnM6IFsnU3RhdGVzLkFMTCddLFxuICB9KTtcblxuICAvLyBQcm9jZXNzIGEgc2luZ2xlIHN0ZXAgZm9yIHJlcnVuIChzZXBhcmF0ZSBzdGF0ZSB0byBhdm9pZCBcImFscmVhZHkgaGFzIG5leHRcIiBlcnJvcilcbiAgY29uc3QgcHJvY2Vzc1N0ZXBTaW5nbGUgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHNjb3BlLCAnUHJvY2Vzc1N0ZXBTaW5nbGUnLCB7XG4gICAgbGFtYmRhRnVuY3Rpb246IGpvYlByb2Nlc3NvckxhbWJkYSxcbiAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgJ2pvYl9pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgICdzdGVwX2luZGV4Jzogc2ZuLkpzb25QYXRoLm51bWJlckF0KCckLnN0ZXBfaW5kZXgnKSxcbiAgICAgICdzdGVwX3R5cGUnOiAnd29ya2Zsb3dfc3RlcCcsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQucHJvY2Vzc1Jlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBMYW1iZGEgZmFpbHVyZXNcbiAgcHJvY2Vzc1N0ZXBTaW5nbGUuYWRkQ2F0Y2gocGFyc2VFcnJvclN0ZXAsIHtcbiAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgZXJyb3JzOiBbJ1N0YXRlcy5BTEwnXSxcbiAgfSk7XG5cbiAgLy8gUHJvY2VzcyBIVE1MIGdlbmVyYXRpb24gc3RlcFxuICBjb25zdCBwcm9jZXNzSHRtbEdlbmVyYXRpb24gPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHNjb3BlLCAnUHJvY2Vzc0h0bWxHZW5lcmF0aW9uJywge1xuICAgIGxhbWJkYUZ1bmN0aW9uOiBqb2JQcm9jZXNzb3JMYW1iZGEsXG4gICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICdqb2JfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJyksXG4gICAgICAnc3RlcF90eXBlJzogJ2h0bWxfZ2VuZXJhdGlvbicsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQuaHRtbFJlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBIVE1MIGdlbmVyYXRpb24gZmFpbHVyZXNcbiAgLy8gTm90ZTogVXNlIHBhcnNlRXJyb3JMZWdhY3kgKG5vdCBwYXJzZUVycm9yU3RlcCkgYmVjYXVzZSBIVE1MIGdlbmVyYXRpb25cbiAgLy8gcnVucyBhZnRlciBhbGwgd29ya2Zsb3cgc3RlcHMgYXJlIGNvbXBsZXRlLCBzbyBzdGVwX2luZGV4IGlzIG5vdCBpbiBjb250ZXh0XG4gIHByb2Nlc3NIdG1sR2VuZXJhdGlvbi5hZGRDYXRjaChwYXJzZUVycm9yTGVnYWN5LCB7XG4gICAgcmVzdWx0UGF0aDogJyQuZXJyb3InLFxuICAgIGVycm9yczogWydTdGF0ZXMuQUxMJ10sXG4gIH0pO1xuXG4gIC8vIENyZWF0ZSByZXVzYWJsZSBmaW5hbGl6ZSBqb2IgdGFzayB1c2luZyBoZWxwZXJcbiAgY29uc3QgZmluYWxpemVKb2IgPSBjcmVhdGVKb2JGaW5hbGl6ZXIoc2NvcGUsICdGaW5hbGl6ZUpvYicsIGpvYnNUYWJsZSk7XG5cbiAgLy8gQ2hlY2sgSFRNTCBnZW5lcmF0aW9uIHJlc3VsdFxuICBjb25zdCBjaGVja0h0bWxSZXN1bHQgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrSHRtbFJlc3VsdCcpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQuaHRtbFJlc3VsdC5QYXlsb2FkLnN1Y2Nlc3MnLCBmYWxzZSksXG4gICAgICBoYW5kbGVIdG1sR2VuZXJhdGlvbkZhaWx1cmVcbiAgICApXG4gICAgLm90aGVyd2lzZShmaW5hbGl6ZUpvYik7XG5cbiAgLy8gQ2hlY2sgaWYgbW9yZSBzdGVwcyByZW1haW4gLSBsb29wcyBiYWNrIHRvIHByb2Nlc3NTdGVwIGlmIG1vcmUgc3RlcHMgKGRlY2xhcmVkIGJlZm9yZSBpbmNyZW1lbnRTdGVwKVxuICBjb25zdCBjaGVja01vcmVTdGVwcyA9IG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tNb3JlU3RlcHMnKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5udW1iZXJMZXNzVGhhbkpzb25QYXRoKCckLnN0ZXBfaW5kZXgnLCAnJC50b3RhbF9zdGVwcycpLFxuICAgICAgcHJvY2Vzc1N0ZXAgIC8vIExvb3AgYmFjayB0byBwcm9jZXNzIG5leHQgc3RlcFxuICAgIClcbiAgICAub3RoZXJ3aXNlKFxuICAgICAgLy8gQWxsIHdvcmtmbG93IHN0ZXBzIGNvbXBsZXRlIC0gY2hlY2sgaWYgSFRNTCBnZW5lcmF0aW9uIGlzIG5lZWRlZFxuICAgICAgbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja0lmSHRtbE5lZWRlZCcpXG4gICAgICAgIC53aGVuKFxuICAgICAgICAgIHNmbi5Db25kaXRpb24uYm9vbGVhbkVxdWFscygnJC5oYXNfdGVtcGxhdGUnLCB0cnVlKSxcbiAgICAgICAgICBwcm9jZXNzSHRtbEdlbmVyYXRpb24ubmV4dChjaGVja0h0bWxSZXN1bHQpXG4gICAgICAgIClcbiAgICAgICAgLm90aGVyd2lzZShmaW5hbGl6ZUpvYilcbiAgICApO1xuXG4gIC8vIENoZWNrIGlmIHN0ZXAgc3VjY2VlZGVkIC0gY29ubmVjdHMgdG8gaW5jcmVtZW50U3RlcCB3aGljaCBjb25uZWN0cyB0byBjaGVja01vcmVTdGVwc1xuICBjb25zdCBpbmNyZW1lbnRTdGVwID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnSW5jcmVtZW50U3RlcCcsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3N0ZXBfaW5kZXguJCc6ICdTdGF0ZXMuTWF0aEFkZCgkLnN0ZXBfaW5kZXgsIDEpJyxcbiAgICAgICd0b3RhbF9zdGVwcy4kJzogJyQudG90YWxfc3RlcHMnLFxuICAgICAgJ2hhc190ZW1wbGF0ZS4kJzogJyQuaGFzX3RlbXBsYXRlJyxcbiAgICAgICd0ZW1wbGF0ZV9pZC4kJzogJyQudGVtcGxhdGVfaWQnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrTW9yZVN0ZXBzKTtcblxuICBjb25zdCBjaGVja1N0ZXBSZXN1bHQgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrU3RlcFJlc3VsdCcpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQucHJvY2Vzc1Jlc3VsdC5QYXlsb2FkLnN1Y2Nlc3MnLCBmYWxzZSksXG4gICAgICBoYW5kbGVTdGVwRmFpbHVyZVxuICAgIClcbiAgICAub3RoZXJ3aXNlKGluY3JlbWVudFN0ZXApO1xuXG4gIC8vIENoZWNrIHN0ZXAgcmVzdWx0IGZvciBzaW5nbGUtc3RlcCByZXJ1biAoZ29lcyBkaXJlY3RseSB0byBmaW5hbGl6ZUpvYiBpbnN0ZWFkIG9mIGluY3JlbWVudGluZylcbiAgY29uc3QgY2hlY2tTdGVwUmVzdWx0U2luZ2xlU3RlcCA9IG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tTdGVwUmVzdWx0U2luZ2xlU3RlcCcpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQucHJvY2Vzc1Jlc3VsdC5QYXlsb2FkLnN1Y2Nlc3MnLCBmYWxzZSksXG4gICAgICBoYW5kbGVTdGVwRmFpbHVyZVxuICAgIClcbiAgICAub3RoZXJ3aXNlKGZpbmFsaXplSm9iKTtcblxuICAvLyBSZXNvbHZlIHN0ZXAgZGVwZW5kZW5jaWVzIC0gY2FsbHMgTGFtYmRhIHRvIGJ1aWxkIGV4ZWN1dGlvbiBwbGFuXG4gIGNvbnN0IHJlc29sdmVEZXBlbmRlbmNpZXMgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHNjb3BlLCAnUmVzb2x2ZURlcGVuZGVuY2llcycsIHtcbiAgICBsYW1iZGFGdW5jdGlvbjogam9iUHJvY2Vzc29yTGFtYmRhLFxuICAgIHBheWxvYWQ6IHNmbi5UYXNrSW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAnam9iX2lkJzogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpLFxuICAgICAgJ3dvcmtmbG93X2lkJzogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLndvcmtmbG93X2lkJyksXG4gICAgICAnYWN0aW9uJzogJ3Jlc29sdmVfZGVwZW5kZW5jaWVzJyxcbiAgICB9KSxcbiAgICByZXN1bHRQYXRoOiAnJC5leGVjdXRpb25QbGFuJyxcbiAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IGZhbHNlLFxuICB9KTtcblxuICAvLyBTZXR1cCBzdGVwIGxvb3AgZm9yIG11bHRpLXN0ZXAgd29ya2Zsb3dzXG4gIGNvbnN0IHNldHVwU3RlcExvb3AgPSBuZXcgc2ZuLlBhc3Moc2NvcGUsICdTZXR1cFN0ZXBMb29wJywge1xuICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICdqb2JfaWQuJCc6ICckLmpvYl9pZCcsXG4gICAgICAnd29ya2Zsb3dfaWQuJCc6ICckLndvcmtmbG93X2lkJyxcbiAgICAgICdzdWJtaXNzaW9uX2lkLiQnOiAnJC5zdWJtaXNzaW9uX2lkJyxcbiAgICAgICd0ZW5hbnRfaWQuJCc6ICckLnRlbmFudF9pZCcsXG4gICAgICAnc3RlcF9pbmRleCc6IDAsXG4gICAgICAndG90YWxfc3RlcHMuJCc6ICckLnN0ZXBzX2xlbmd0aCcsXG4gICAgICAnaGFzX3RlbXBsYXRlLiQnOiAnJC5oYXNfdGVtcGxhdGUnLFxuICAgICAgJ3RlbXBsYXRlX2lkLiQnOiAnJC50ZW1wbGF0ZV9pZCcsXG4gICAgICAnZXhlY3V0aW9uX3BsYW4uJCc6ICckLmV4ZWN1dGlvblBsYW4uUGF5bG9hZCcsXG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJCcsXG4gIH0pLm5leHQocHJvY2Vzc1N0ZXApLm5leHQoY2hlY2tTdGVwUmVzdWx0KTtcblxuICAvLyBBbGwgd29ya2Zsb3dzIG11c3QgdXNlIHN0ZXBzIGZvcm1hdCAtIHJvdXRlIGRpcmVjdGx5IHRvIGRlcGVuZGVuY3kgcmVzb2x1dGlvblxuICAvLyBJZiB3b3JrZmxvdyBoYXMgbm8gc3RlcHMsIHRoZSBMYW1iZGEgd2lsbCB0aHJvdyBhbiBlcnJvclxuICBjb25zdCBjaGVja1dvcmtmbG93VHlwZSA9IHJlc29sdmVEZXBlbmRlbmNpZXMubmV4dChzZXR1cFN0ZXBMb29wKTtcblxuICAvLyBTZXQgaGFzX3RlbXBsYXRlIHRvIHRydWUgd2hlbiB0ZW1wbGF0ZSBleGlzdHNcbiAgY29uc3Qgc2V0SGFzVGVtcGxhdGVUcnVlID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnU2V0SGFzVGVtcGxhdGVUcnVlJywge1xuICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICdqb2JfaWQuJCc6ICckLmpvYl9pZCcsXG4gICAgICAnd29ya2Zsb3dfaWQuJCc6ICckLndvcmtmbG93X2lkJyxcbiAgICAgICdzdWJtaXNzaW9uX2lkLiQnOiAnJC5zdWJtaXNzaW9uX2lkJyxcbiAgICAgICd0ZW5hbnRfaWQuJCc6ICckLnRlbmFudF9pZCcsXG4gICAgICAnd29ya2Zsb3dEYXRhLiQnOiAnJC53b3JrZmxvd0RhdGEnLFxuICAgICAgJ3N0ZXBzX2xlbmd0aC4kJzogJyQuc3RlcHNfbGVuZ3RoJyxcbiAgICAgICdoYXNfdGVtcGxhdGUnOiB0cnVlLFxuICAgICAgJ3RlbXBsYXRlX2lkLiQnOiAnJC53b3JrZmxvd0RhdGEuSXRlbS50ZW1wbGF0ZV9pZC5TJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChjaGVja1dvcmtmbG93VHlwZSk7XG5cbiAgLy8gU2V0IGhhc190ZW1wbGF0ZSB0byBmYWxzZSB3aGVuIHRlbXBsYXRlIGRvZXNuJ3QgZXhpc3RcbiAgY29uc3Qgc2V0SGFzVGVtcGxhdGVGYWxzZSA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ1NldEhhc1RlbXBsYXRlRmFsc2UnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICd3b3JrZmxvd0RhdGEuJCc6ICckLndvcmtmbG93RGF0YScsXG4gICAgICAnc3RlcHNfbGVuZ3RoLiQnOiAnJC5zdGVwc19sZW5ndGgnLFxuICAgICAgJ2hhc190ZW1wbGF0ZSc6IGZhbHNlLFxuICAgICAgJ3RlbXBsYXRlX2lkJzogJycsXG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJCcsXG4gIH0pLm5leHQoY2hlY2tXb3JrZmxvd1R5cGUpO1xuXG4gIC8vIENoZWNrIGlmIHRlbXBsYXRlIGV4aXN0cyBhbmQgc2V0IGhhc190ZW1wbGF0ZSBib29sZWFuXG4gIGNvbnN0IGNoZWNrVGVtcGxhdGVFeGlzdHMgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrVGVtcGxhdGVFeGlzdHMnKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5pc1ByZXNlbnQoJyQud29ya2Zsb3dEYXRhLkl0ZW0udGVtcGxhdGVfaWQuUycpLFxuICAgICAgc2V0SGFzVGVtcGxhdGVUcnVlXG4gICAgKVxuICAgIC5vdGhlcndpc2Uoc2V0SGFzVGVtcGxhdGVGYWxzZSk7XG5cbiAgLy8gQ29tcHV0ZSBzdGVwcyBsZW5ndGggLSBoYW5kbGUgYm90aCBuZXcgKHdpdGggc3RlcHMpIGFuZCBsZWdhY3kgKHdpdGhvdXQgc3RlcHMpIHdvcmtmbG93c1xuICAvLyBBbGwgd29ya2Zsb3dzIG11c3QgaGF2ZSBzdGVwcyAtIGNvbXB1dGUgc3RlcHMgbGVuZ3RoIGRpcmVjdGx5XG4gIGNvbnN0IGNvbXB1dGVTdGVwc0xlbmd0aCA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ0NvbXB1dGVTdGVwc0xlbmd0aCcsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3dvcmtmbG93RGF0YS4kJzogJyQud29ya2Zsb3dEYXRhJyxcbiAgICAgICdzdGVwc19sZW5ndGguJCc6ICdTdGF0ZXMuQXJyYXlMZW5ndGgoJC53b3JrZmxvd0RhdGEuSXRlbS5zdGVwcy5MKScsXG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJCcsXG4gIH0pLm5leHQoY2hlY2tUZW1wbGF0ZUV4aXN0cyk7XG5cbiAgLy8gQ2hlY2sgaWYgdGhpcyBpcyBhIHNpbmdsZS1zdGVwIHJlcnVuIChhY3Rpb24gPT09ICdwcm9jZXNzX3NpbmdsZV9zdGVwJylcbiAgLy8gSWYgeWVzLCByb3V0ZSBkaXJlY3RseSB0byBwcm9jZXNzU3RlcFNpbmdsZSB3aXRoIHRoZSBwcm92aWRlZCBzdGVwX2luZGV4LCB0aGVuIGZpbmFsaXplXG4gIC8vIElmIG5vLCBjb250aW51ZSB3aXRoIG5vcm1hbCB3b3JrZmxvdyBpbml0aWFsaXphdGlvbiBmbG93XG4gIGNvbnN0IGNoZWNrQWN0aW9uID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja0FjdGlvbicpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLnN0cmluZ0VxdWFscygnJC5hY3Rpb24nLCAncHJvY2Vzc19zaW5nbGVfc3RlcCcpLFxuICAgICAgLy8gU2luZ2xlLXN0ZXAgcmVydW4gcGF0aDogcHJvY2Vzc1N0ZXBTaW5nbGUgLT4gY2hlY2tTdGVwUmVzdWx0U2luZ2xlU3RlcCAtPiBmaW5hbGl6ZUpvYlxuICAgICAgcHJvY2Vzc1N0ZXBTaW5nbGUubmV4dChjaGVja1N0ZXBSZXN1bHRTaW5nbGVTdGVwKVxuICAgIClcbiAgICAub3RoZXJ3aXNlKFxuICAgICAgLy8gTm9ybWFsIHdvcmtmbG93IHBhdGg6IGluaXRpYWxpemVTdGVwcyAtPiBjb21wdXRlU3RlcHNMZW5ndGggLT4gLi4uXG4gICAgICBpbml0aWFsaXplU3RlcHMubmV4dChjb21wdXRlU3RlcHNMZW5ndGgpXG4gICAgKTtcblxuICAvLyBEZWZpbmUgd29ya2Zsb3c6IFVwZGF0ZSBzdGF0dXMgLT4gQ2hlY2sgYWN0aW9uIC0+IFJvdXRlIGFjY29yZGluZ2x5XG4gIC8vIEFsbCB3b3JrZmxvd3MgbXVzdCB1c2Ugc3RlcHMgZm9ybWF0IC0gbGVnYWN5IGZvcm1hdCBpcyBubyBsb25nZXIgc3VwcG9ydGVkXG4gIHJldHVybiB1cGRhdGVKb2JTdGF0dXMubmV4dChjaGVja0FjdGlvbik7XG59XG5cbiJdfQ==