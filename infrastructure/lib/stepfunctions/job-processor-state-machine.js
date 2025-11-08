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
/**
 * Creates the Step Functions state machine definition for job processing
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
    // Handle Lambda returning success: false (business logic failure) for workflow steps
    const handleStepFailure = new tasks.DynamoUpdateItem(scope, 'HandleStepFailure', {
        table: jobsTable,
        key: {
            job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.job_id')),
        },
        updateExpression: 'SET #status = :status, error_message = :error, error_type = :error_type, updated_at = :updated_at',
        expressionAttributeNames: {
            '#status': 'status',
        },
        expressionAttributeValues: {
            ':status': tasks.DynamoAttributeValue.fromString('failed'),
            ':error': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.processResult.Payload.error')),
            ':error_type': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.processResult.Payload.error_type')),
            ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
        },
    });
    // Handle HTML generation failures - reads from htmlResult instead of processResult
    const handleHtmlGenerationFailure = new tasks.DynamoUpdateItem(scope, 'HandleHtmlGenerationFailure', {
        table: jobsTable,
        key: {
            job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.job_id')),
        },
        updateExpression: 'SET #status = :status, error_message = :error, error_type = :error_type, updated_at = :updated_at',
        expressionAttributeNames: {
            '#status': 'status',
        },
        expressionAttributeValues: {
            ':status': tasks.DynamoAttributeValue.fromString('failed'),
            ':error': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.htmlResult.Payload.error')),
            ':error_type': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.htmlResult.Payload.error_type')),
            ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
        },
    });
    // Handle Lambda exception (timeout, etc.)
    const handleStepException = new tasks.DynamoUpdateItem(scope, 'HandleStepException', {
        table: jobsTable,
        key: {
            job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.parsedError.job_id')),
        },
        updateExpression: 'SET #status = :status, error_message = :error, updated_at = :updated_at',
        expressionAttributeNames: {
            '#status': 'status',
        },
        expressionAttributeValues: {
            ':status': tasks.DynamoAttributeValue.fromString('failed'),
            ':error': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.parsedError.error_message')),
            ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
        },
    });
    // Parse error message from Lambda response (create separate instances for each catch handler)
    const parseErrorLegacy = new sfn.Pass(scope, 'ParseErrorLegacy', {
        parameters: {
            'job_id.$': '$.job_id',
            'error_message': sfn.JsonPath.format('Lambda execution failed: {} - {}', sfn.JsonPath.stringAt('$.error.Error'), sfn.JsonPath.stringAt('$.error.Cause')),
        },
        resultPath: '$.parsedError',
    }).next(handleStepException);
    const parseErrorStep = new sfn.Pass(scope, 'ParseErrorStep', {
        parameters: {
            'job_id.$': '$.job_id',
            'step_index.$': '$.step_index',
            'error_message': sfn.JsonPath.format('Lambda execution failed: {} - {}', sfn.JsonPath.stringAt('$.error.Error'), sfn.JsonPath.stringAt('$.error.Cause')),
        },
        resultPath: '$.parsedError',
    }).next(handleStepException);
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
    processHtmlGeneration.addCatch(parseErrorStep, {
        resultPath: '$.error',
        errors: ['States.ALL'],
    });
    // Create reusable finalize job task
    const finalizeJob = new tasks.DynamoUpdateItem(scope, 'FinalizeJob', {
        table: jobsTable,
        key: {
            job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.job_id')),
        },
        updateExpression: 'SET #status = :status, completed_at = :completed_at, updated_at = :updated_at',
        expressionAttributeNames: {
            '#status': 'status',
        },
        expressionAttributeValues: {
            ':status': tasks.DynamoAttributeValue.fromString('completed'),
            ':completed_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
            ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
        },
    });
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
    // Legacy workflow processing
    const processLegacyJob = new tasks.LambdaInvoke(scope, 'ProcessLegacyJob', {
        lambdaFunction: jobProcessorLambda,
        payload: sfn.TaskInput.fromObject({
            'job_id': sfn.JsonPath.stringAt('$.job_id'),
        }),
        resultPath: '$.processResult',
        retryOnServiceExceptions: false,
    })
        .addCatch(parseErrorLegacy, {
        resultPath: '$.error',
        errors: ['States.ALL'],
    })
        .next(new sfn.Choice(scope, 'CheckLegacyResult')
        .when(sfn.Condition.booleanEquals('$.processResult.Payload.success', false), handleStepFailure)
        .otherwise(new tasks.DynamoUpdateItem(scope, 'FinalizeLegacyJob', {
        table: jobsTable,
        key: {
            job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.job_id')),
        },
        updateExpression: 'SET #status = :status, completed_at = :completed_at, updated_at = :updated_at',
        expressionAttributeNames: {
            '#status': 'status',
        },
        expressionAttributeValues: {
            ':status': tasks.DynamoAttributeValue.fromString('completed'),
            ':completed_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
            ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
        },
    })));
    // Check workflow type and route accordingly (defined after processLegacyJob and setupStepLoop)
    const checkWorkflowType = new sfn.Choice(scope, 'CheckWorkflowType')
        .when(sfn.Condition.or(sfn.Condition.isNotPresent('$.workflowData.Item.steps'), sfn.Condition.numberEquals('$.steps_length', 0)), processLegacyJob)
        .otherwise(resolveDependencies.next(setupStepLoop));
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
    const computeStepsLengthWithSteps = new sfn.Pass(scope, 'ComputeStepsLengthWithSteps', {
        parameters: {
            'job_id.$': '$.job_id',
            'workflow_id.$': '$.workflow_id',
            'submission_id.$': '$.submission_id',
            'tenant_id.$': '$.tenant_id',
            'workflowData.$': '$.workflowData',
            'steps_length.$': 'States.ArrayLength($.workflowData.Item.steps.L)',
            // Don't extract template_id here - let checkTemplateExists handle it safely
        },
        resultPath: '$',
    }).next(checkTemplateExists);
    const computeStepsLengthLegacy = new sfn.Pass(scope, 'ComputeStepsLengthLegacy', {
        parameters: {
            'job_id.$': '$.job_id',
            'workflow_id.$': '$.workflow_id',
            'submission_id.$': '$.submission_id',
            'tenant_id.$': '$.tenant_id',
            'workflowData.$': '$.workflowData',
            'steps_length': 0,
            // Don't extract template_id here - let checkTemplateExists handle it safely
        },
        resultPath: '$',
    }).next(checkTemplateExists);
    const computeStepsLength = new sfn.Choice(scope, 'ComputeStepsLength')
        .when(sfn.Condition.isPresent('$.workflowData.Item.steps'), computeStepsLengthWithSteps)
        .otherwise(computeStepsLengthLegacy);
    // Define workflow: Update status -> Initialize steps -> Compute steps length -> Check template -> Check workflow type -> Process accordingly
    // Note: computeStepsLength internally connects to checkTemplateExists
    return updateJobStatus
        .next(initializeSteps)
        .next(computeStepsLength);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBZUEsd0VBMldDO0FBeFhELG1FQUFxRDtBQUNyRCwyRUFBNkQ7QUFTN0Q7O0dBRUc7QUFDSCxTQUFnQiw4QkFBOEIsQ0FDNUMsS0FBZ0IsRUFDaEIsS0FBb0M7SUFFcEMsTUFBTSxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxLQUFLLENBQUM7SUFFaEUsa0NBQWtDO0lBQ2xDLE1BQU0sZUFBZSxHQUFHLElBQUksS0FBSyxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxpQkFBaUIsRUFBRTtRQUMzRSxLQUFLLEVBQUUsU0FBUztRQUNoQixHQUFHLEVBQUU7WUFDSCxNQUFNLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNqRjtRQUNELGdCQUFnQixFQUFFLGlEQUFpRDtRQUNuRSx3QkFBd0IsRUFBRTtZQUN4QixTQUFTLEVBQUUsUUFBUTtTQUNwQjtRQUNELHlCQUF5QixFQUFFO1lBQ3pCLFNBQVMsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQztZQUM5RCxhQUFhLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1NBQ3BHO1FBQ0QsVUFBVSxFQUFFLGdCQUFnQjtLQUM3QixDQUFDLENBQUM7SUFFSCxxRkFBcUY7SUFDckYsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUs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QixNQUFNLGtCQUFrQixHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsb0JBQW9CLENBQUM7U0FDbkUsSUFBSSxDQUNILEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLDJCQUEyQixDQUFDLEVBQ3BELDJCQUEyQixDQUM1QjtTQUNBLFNBQVMsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0lBRXZDLDZJQUE2STtJQUM3SSxzRUFBc0U7SUFDdEUsT0FBTyxlQUFlO1NBQ25CLElBQUksQ0FBQyxlQUFlLENBQUM7U0FDckIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDOUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgdGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSm9iUHJvY2Vzc29yU3RhdGVNYWNoaW5lUHJvcHMge1xuICBqb2JzVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgd29ya2Zsb3dzVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgam9iUHJvY2Vzc29yTGFtYmRhOiBsYW1iZGEuRnVuY3Rpb247XG59XG5cbi8qKlxuICogQ3JlYXRlcyB0aGUgU3RlcCBGdW5jdGlvbnMgc3RhdGUgbWFjaGluZSBkZWZpbml0aW9uIGZvciBqb2IgcHJvY2Vzc2luZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSm9iUHJvY2Vzc29yU3RhdGVNYWNoaW5lKFxuICBzY29wZTogQ29uc3RydWN0LFxuICBwcm9wczogSm9iUHJvY2Vzc29yU3RhdGVNYWNoaW5lUHJvcHNcbik6IHNmbi5JQ2hhaW5hYmxlIHtcbiAgY29uc3QgeyBqb2JzVGFibGUsIHdvcmtmbG93c1RhYmxlLCBqb2JQcm9jZXNzb3JMYW1iZGEgfSA9IHByb3BzO1xuXG4gIC8vIFVwZGF0ZSBqb2Igc3RhdHVzIHRvIHByb2Nlc3NpbmdcbiAgY29uc3QgdXBkYXRlSm9iU3RhdHVzID0gbmV3IHRhc2tzLkR5bmFtb1VwZGF0ZUl0ZW0oc2NvcGUsICdVcGRhdGVKb2JTdGF0dXMnLCB7XG4gICAgdGFibGU6IGpvYnNUYWJsZSxcbiAgICBrZXk6IHtcbiAgICAgIGpvYl9pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJykpLFxuICAgIH0sXG4gICAgdXBkYXRlRXhwcmVzc2lvbjogJ1NFVCAjc3RhdHVzID0gOnN0YXR1cywgdXBkYXRlZF9hdCA9IDp1cGRhdGVkX2F0JyxcbiAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICcjc3RhdHVzJzogJ3N0YXR1cycsXG4gICAgfSxcbiAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAnOnN0YXR1cyc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoJ3Byb2Nlc3NpbmcnKSxcbiAgICAgICc6dXBkYXRlZF9hdCc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckJC5TdGF0ZS5FbnRlcmVkVGltZScpKSxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckLnVwZGF0ZVJlc3VsdCcsXG4gIH0pO1xuXG4gIC8vIEhhbmRsZSBMYW1iZGEgcmV0dXJuaW5nIHN1Y2Nlc3M6IGZhbHNlIChidXNpbmVzcyBsb2dpYyBmYWlsdXJlKSBmb3Igd29ya2Zsb3cgc3RlcHNcbiAgY29uc3QgaGFuZGxlU3RlcEZhaWx1cmUgPSBuZXcgdGFza3MuRHluYW1vVXBkYXRlSXRlbShzY29wZSwgJ0hhbmRsZVN0ZXBGYWlsdXJlJywge1xuICAgIHRhYmxlOiBqb2JzVGFibGUsXG4gICAga2V5OiB7XG4gICAgICBqb2JfaWQ6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpKSxcbiAgICB9LFxuICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIGVycm9yX21lc3NhZ2UgPSA6ZXJyb3IsIGVycm9yX3R5cGUgPSA6ZXJyb3JfdHlwZSwgdXBkYXRlZF9hdCA9IDp1cGRhdGVkX2F0JyxcbiAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICcjc3RhdHVzJzogJ3N0YXR1cycsXG4gICAgfSxcbiAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAnOnN0YXR1cyc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoJ2ZhaWxlZCcpLFxuICAgICAgJzplcnJvcic6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnByb2Nlc3NSZXN1bHQuUGF5bG9hZC5lcnJvcicpKSxcbiAgICAgICc6ZXJyb3JfdHlwZSc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnByb2Nlc3NSZXN1bHQuUGF5bG9hZC5lcnJvcl90eXBlJykpLFxuICAgICAgJzp1cGRhdGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIEhhbmRsZSBIVE1MIGdlbmVyYXRpb24gZmFpbHVyZXMgLSByZWFkcyBmcm9tIGh0bWxSZXN1bHQgaW5zdGVhZCBvZiBwcm9jZXNzUmVzdWx0XG4gIGNvbnN0IGhhbmRsZUh0bWxHZW5lcmF0aW9uRmFpbHVyZSA9IG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHNjb3BlLCAnSGFuZGxlSHRtbEdlbmVyYXRpb25GYWlsdXJlJywge1xuICAgIHRhYmxlOiBqb2JzVGFibGUsXG4gICAga2V5OiB7XG4gICAgICBqb2JfaWQ6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpKSxcbiAgICB9LFxuICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIGVycm9yX21lc3NhZ2UgPSA6ZXJyb3IsIGVycm9yX3R5cGUgPSA6ZXJyb3JfdHlwZSwgdXBkYXRlZF9hdCA9IDp1cGRhdGVkX2F0JyxcbiAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICcjc3RhdHVzJzogJ3N0YXR1cycsXG4gICAgfSxcbiAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAnOnN0YXR1cyc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoJ2ZhaWxlZCcpLFxuICAgICAgJzplcnJvcic6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmh0bWxSZXN1bHQuUGF5bG9hZC5lcnJvcicpKSxcbiAgICAgICc6ZXJyb3JfdHlwZSc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmh0bWxSZXN1bHQuUGF5bG9hZC5lcnJvcl90eXBlJykpLFxuICAgICAgJzp1cGRhdGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIEhhbmRsZSBMYW1iZGEgZXhjZXB0aW9uICh0aW1lb3V0LCBldGMuKVxuICBjb25zdCBoYW5kbGVTdGVwRXhjZXB0aW9uID0gbmV3IHRhc2tzLkR5bmFtb1VwZGF0ZUl0ZW0oc2NvcGUsICdIYW5kbGVTdGVwRXhjZXB0aW9uJywge1xuICAgIHRhYmxlOiBqb2JzVGFibGUsXG4gICAga2V5OiB7XG4gICAgICBqb2JfaWQ6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnBhcnNlZEVycm9yLmpvYl9pZCcpKSxcbiAgICB9LFxuICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIGVycm9yX21lc3NhZ2UgPSA6ZXJyb3IsIHVwZGF0ZWRfYXQgPSA6dXBkYXRlZF9hdCcsXG4gICAgZXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgIH0sXG4gICAgZXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgJzpzdGF0dXMnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdmYWlsZWQnKSxcbiAgICAgICc6ZXJyb3InOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5wYXJzZWRFcnJvci5lcnJvcl9tZXNzYWdlJykpLFxuICAgICAgJzp1cGRhdGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFBhcnNlIGVycm9yIG1lc3NhZ2UgZnJvbSBMYW1iZGEgcmVzcG9uc2UgKGNyZWF0ZSBzZXBhcmF0ZSBpbnN0YW5jZXMgZm9yIGVhY2ggY2F0Y2ggaGFuZGxlcilcbiAgY29uc3QgcGFyc2VFcnJvckxlZ2FjeSA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ1BhcnNlRXJyb3JMZWdhY3knLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICdlcnJvcl9tZXNzYWdlJzogc2ZuLkpzb25QYXRoLmZvcm1hdChcbiAgICAgICAgJ0xhbWJkYSBleGVjdXRpb24gZmFpbGVkOiB7fSAtIHt9JyxcbiAgICAgICAgc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmVycm9yLkVycm9yJyksXG4gICAgICAgIHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5lcnJvci5DYXVzZScpXG4gICAgICApLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQucGFyc2VkRXJyb3InLFxuICB9KS5uZXh0KGhhbmRsZVN0ZXBFeGNlcHRpb24pO1xuXG4gIGNvbnN0IHBhcnNlRXJyb3JTdGVwID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnUGFyc2VFcnJvclN0ZXAnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICdzdGVwX2luZGV4LiQnOiAnJC5zdGVwX2luZGV4JyxcbiAgICAgICdlcnJvcl9tZXNzYWdlJzogc2ZuLkpzb25QYXRoLmZvcm1hdChcbiAgICAgICAgJ0xhbWJkYSBleGVjdXRpb24gZmFpbGVkOiB7fSAtIHt9JyxcbiAgICAgICAgc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmVycm9yLkVycm9yJyksXG4gICAgICAgIHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5lcnJvci5DYXVzZScpXG4gICAgICApLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQucGFyc2VkRXJyb3InLFxuICB9KS5uZXh0KGhhbmRsZVN0ZXBFeGNlcHRpb24pO1xuXG4gIC8vIEluaXRpYWxpemUgc3RlcHM6IExvYWQgd29ya2Zsb3cgYW5kIGdldCBzdGVwIGNvdW50XG4gIGNvbnN0IGluaXRpYWxpemVTdGVwcyA9IG5ldyB0YXNrcy5EeW5hbW9HZXRJdGVtKHNjb3BlLCAnSW5pdGlhbGl6ZVN0ZXBzJywge1xuICAgIHRhYmxlOiB3b3JrZmxvd3NUYWJsZSxcbiAgICBrZXk6IHtcbiAgICAgIHdvcmtmbG93X2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC53b3JrZmxvd19pZCcpKSxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckLndvcmtmbG93RGF0YScsXG4gIH0pO1xuXG4gIC8vIFByb2Nlc3MgYSBzaW5nbGUgc3RlcCB1c2luZyBMYW1iZGEgZnVuY3Rpb24gKGRlY2xhcmVkIGVhcmx5IGZvciB1c2UgaW4gc2V0dXBTdGVwTG9vcClcbiAgY29uc3QgcHJvY2Vzc1N0ZXAgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHNjb3BlLCAnUHJvY2Vzc1N0ZXAnLCB7XG4gICAgbGFtYmRhRnVuY3Rpb246IGpvYlByb2Nlc3NvckxhbWJkYSxcbiAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgJ2pvYl9pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgICdzdGVwX2luZGV4Jzogc2ZuLkpzb25QYXRoLm51bWJlckF0KCckLnN0ZXBfaW5kZXgnKSxcbiAgICAgICdzdGVwX3R5cGUnOiAnd29ya2Zsb3dfc3RlcCcsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQucHJvY2Vzc1Jlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBMYW1iZGEgZmFpbHVyZXNcbiAgcHJvY2Vzc1N0ZXAuYWRkQ2F0Y2gocGFyc2VFcnJvclN0ZXAsIHtcbiAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgZXJyb3JzOiBbJ1N0YXRlcy5BTEwnXSxcbiAgfSk7XG5cbiAgLy8gUHJvY2VzcyBIVE1MIGdlbmVyYXRpb24gc3RlcFxuICBjb25zdCBwcm9jZXNzSHRtbEdlbmVyYXRpb24gPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHNjb3BlLCAnUHJvY2Vzc0h0bWxHZW5lcmF0aW9uJywge1xuICAgIGxhbWJkYUZ1bmN0aW9uOiBqb2JQcm9jZXNzb3JMYW1iZGEsXG4gICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICdqb2JfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJyksXG4gICAgICAnc3RlcF90eXBlJzogJ2h0bWxfZ2VuZXJhdGlvbicsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQuaHRtbFJlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBIVE1MIGdlbmVyYXRpb24gZmFpbHVyZXNcbiAgcHJvY2Vzc0h0bWxHZW5lcmF0aW9uLmFkZENhdGNoKHBhcnNlRXJyb3JTdGVwLCB7XG4gICAgcmVzdWx0UGF0aDogJyQuZXJyb3InLFxuICAgIGVycm9yczogWydTdGF0ZXMuQUxMJ10sXG4gIH0pO1xuXG4gIC8vIENyZWF0ZSByZXVzYWJsZSBmaW5hbGl6ZSBqb2IgdGFza1xuICBjb25zdCBmaW5hbGl6ZUpvYiA9IG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHNjb3BlLCAnRmluYWxpemVKb2InLCB7XG4gICAgdGFibGU6IGpvYnNUYWJsZSxcbiAgICBrZXk6IHtcbiAgICAgIGpvYl9pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJykpLFxuICAgIH0sXG4gICAgdXBkYXRlRXhwcmVzc2lvbjogJ1NFVCAjc3RhdHVzID0gOnN0YXR1cywgY29tcGxldGVkX2F0ID0gOmNvbXBsZXRlZF9hdCwgdXBkYXRlZF9hdCA9IDp1cGRhdGVkX2F0JyxcbiAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICcjc3RhdHVzJzogJ3N0YXR1cycsXG4gICAgfSxcbiAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAnOnN0YXR1cyc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoJ2NvbXBsZXRlZCcpLFxuICAgICAgJzpjb21wbGV0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICAnOnVwZGF0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gQ2hlY2sgSFRNTCBnZW5lcmF0aW9uIHJlc3VsdFxuICBjb25zdCBjaGVja0h0bWxSZXN1bHQgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrSHRtbFJlc3VsdCcpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQuaHRtbFJlc3VsdC5QYXlsb2FkLnN1Y2Nlc3MnLCBmYWxzZSksXG4gICAgICBoYW5kbGVIdG1sR2VuZXJhdGlvbkZhaWx1cmVcbiAgICApXG4gICAgLm90aGVyd2lzZShmaW5hbGl6ZUpvYik7XG5cbiAgLy8gQ2hlY2sgaWYgbW9yZSBzdGVwcyByZW1haW4gLSBsb29wcyBiYWNrIHRvIHByb2Nlc3NTdGVwIGlmIG1vcmUgc3RlcHMgKGRlY2xhcmVkIGJlZm9yZSBpbmNyZW1lbnRTdGVwKVxuICBjb25zdCBjaGVja01vcmVTdGVwcyA9IG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tNb3JlU3RlcHMnKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5udW1iZXJMZXNzVGhhbkpzb25QYXRoKCckLnN0ZXBfaW5kZXgnLCAnJC50b3RhbF9zdGVwcycpLFxuICAgICAgcHJvY2Vzc1N0ZXAgIC8vIExvb3AgYmFjayB0byBwcm9jZXNzIG5leHQgc3RlcFxuICAgIClcbiAgICAub3RoZXJ3aXNlKFxuICAgICAgLy8gQWxsIHdvcmtmbG93IHN0ZXBzIGNvbXBsZXRlIC0gY2hlY2sgaWYgSFRNTCBnZW5lcmF0aW9uIGlzIG5lZWRlZFxuICAgICAgbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja0lmSHRtbE5lZWRlZCcpXG4gICAgICAgIC53aGVuKFxuICAgICAgICAgIHNmbi5Db25kaXRpb24uYm9vbGVhbkVxdWFscygnJC5oYXNfdGVtcGxhdGUnLCB0cnVlKSxcbiAgICAgICAgICBwcm9jZXNzSHRtbEdlbmVyYXRpb24ubmV4dChjaGVja0h0bWxSZXN1bHQpXG4gICAgICAgIClcbiAgICAgICAgLm90aGVyd2lzZShmaW5hbGl6ZUpvYilcbiAgICApO1xuXG4gIC8vIENoZWNrIGlmIHN0ZXAgc3VjY2VlZGVkIC0gY29ubmVjdHMgdG8gaW5jcmVtZW50U3RlcCB3aGljaCBjb25uZWN0cyB0byBjaGVja01vcmVTdGVwc1xuICBjb25zdCBpbmNyZW1lbnRTdGVwID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnSW5jcmVtZW50U3RlcCcsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3N0ZXBfaW5kZXguJCc6ICdTdGF0ZXMuTWF0aEFkZCgkLnN0ZXBfaW5kZXgsIDEpJyxcbiAgICAgICd0b3RhbF9zdGVwcy4kJzogJyQudG90YWxfc3RlcHMnLFxuICAgICAgJ2hhc190ZW1wbGF0ZS4kJzogJyQuaGFzX3RlbXBsYXRlJyxcbiAgICAgICd0ZW1wbGF0ZV9pZC4kJzogJyQudGVtcGxhdGVfaWQnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrTW9yZVN0ZXBzKTtcblxuICBjb25zdCBjaGVja1N0ZXBSZXN1bHQgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrU3RlcFJlc3VsdCcpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQucHJvY2Vzc1Jlc3VsdC5QYXlsb2FkLnN1Y2Nlc3MnLCBmYWxzZSksXG4gICAgICBoYW5kbGVTdGVwRmFpbHVyZVxuICAgIClcbiAgICAub3RoZXJ3aXNlKGluY3JlbWVudFN0ZXApO1xuXG4gIC8vIFJlc29sdmUgc3RlcCBkZXBlbmRlbmNpZXMgLSBjYWxscyBMYW1iZGEgdG8gYnVpbGQgZXhlY3V0aW9uIHBsYW5cbiAgY29uc3QgcmVzb2x2ZURlcGVuZGVuY2llcyA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2Uoc2NvcGUsICdSZXNvbHZlRGVwZW5kZW5jaWVzJywge1xuICAgIGxhbWJkYUZ1bmN0aW9uOiBqb2JQcm9jZXNzb3JMYW1iZGEsXG4gICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICdqb2JfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJyksXG4gICAgICAnd29ya2Zsb3dfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQud29ya2Zsb3dfaWQnKSxcbiAgICAgICdhY3Rpb24nOiAncmVzb2x2ZV9kZXBlbmRlbmNpZXMnLFxuICAgIH0pLFxuICAgIHJlc3VsdFBhdGg6ICckLmV4ZWN1dGlvblBsYW4nLFxuICAgIHJldHJ5T25TZXJ2aWNlRXhjZXB0aW9uczogZmFsc2UsXG4gIH0pO1xuXG4gIC8vIFNldHVwIHN0ZXAgbG9vcCBmb3IgbXVsdGktc3RlcCB3b3JrZmxvd3NcbiAgY29uc3Qgc2V0dXBTdGVwTG9vcCA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ1NldHVwU3RlcExvb3AnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICdzdGVwX2luZGV4JzogMCxcbiAgICAgICd0b3RhbF9zdGVwcy4kJzogJyQuc3RlcHNfbGVuZ3RoJyxcbiAgICAgICdoYXNfdGVtcGxhdGUuJCc6ICckLmhhc190ZW1wbGF0ZScsXG4gICAgICAndGVtcGxhdGVfaWQuJCc6ICckLnRlbXBsYXRlX2lkJyxcbiAgICAgICdleGVjdXRpb25fcGxhbi4kJzogJyQuZXhlY3V0aW9uUGxhbi5QYXlsb2FkJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChwcm9jZXNzU3RlcCkubmV4dChjaGVja1N0ZXBSZXN1bHQpO1xuXG4gIC8vIExlZ2FjeSB3b3JrZmxvdyBwcm9jZXNzaW5nXG4gIGNvbnN0IHByb2Nlc3NMZWdhY3lKb2IgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHNjb3BlLCAnUHJvY2Vzc0xlZ2FjeUpvYicsIHtcbiAgICBsYW1iZGFGdW5jdGlvbjogam9iUHJvY2Vzc29yTGFtYmRhLFxuICAgIHBheWxvYWQ6IHNmbi5UYXNrSW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAnam9iX2lkJzogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpLFxuICAgIH0pLFxuICAgIHJlc3VsdFBhdGg6ICckLnByb2Nlc3NSZXN1bHQnLFxuICAgIHJldHJ5T25TZXJ2aWNlRXhjZXB0aW9uczogZmFsc2UsXG4gIH0pXG4gICAgLmFkZENhdGNoKHBhcnNlRXJyb3JMZWdhY3ksIHtcbiAgICAgIHJlc3VsdFBhdGg6ICckLmVycm9yJyxcbiAgICAgIGVycm9yczogWydTdGF0ZXMuQUxMJ10sXG4gICAgfSlcbiAgICAubmV4dChcbiAgICAgIG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tMZWdhY3lSZXN1bHQnKVxuICAgICAgICAud2hlbihcbiAgICAgICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQucHJvY2Vzc1Jlc3VsdC5QYXlsb2FkLnN1Y2Nlc3MnLCBmYWxzZSksXG4gICAgICAgICAgaGFuZGxlU3RlcEZhaWx1cmVcbiAgICAgICAgKVxuICAgICAgICAub3RoZXJ3aXNlKFxuICAgICAgICAgIG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHNjb3BlLCAnRmluYWxpemVMZWdhY3lKb2InLCB7XG4gICAgICAgICAgICB0YWJsZTogam9ic1RhYmxlLFxuICAgICAgICAgICAga2V5OiB7XG4gICAgICAgICAgICAgIGpvYl9pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJykpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIGNvbXBsZXRlZF9hdCA9IDpjb21wbGV0ZWRfYXQsIHVwZGF0ZWRfYXQgPSA6dXBkYXRlZF9hdCcsXG4gICAgICAgICAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygnY29tcGxldGVkJyksXG4gICAgICAgICAgICAgICc6Y29tcGxldGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgICAgICAgICAgICAnOnVwZGF0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pXG4gICAgICAgIClcbiAgICApO1xuXG4gIC8vIENoZWNrIHdvcmtmbG93IHR5cGUgYW5kIHJvdXRlIGFjY29yZGluZ2x5IChkZWZpbmVkIGFmdGVyIHByb2Nlc3NMZWdhY3lKb2IgYW5kIHNldHVwU3RlcExvb3ApXG4gIGNvbnN0IGNoZWNrV29ya2Zsb3dUeXBlID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja1dvcmtmbG93VHlwZScpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLm9yKFxuICAgICAgICBzZm4uQ29uZGl0aW9uLmlzTm90UHJlc2VudCgnJC53b3JrZmxvd0RhdGEuSXRlbS5zdGVwcycpLFxuICAgICAgICBzZm4uQ29uZGl0aW9uLm51bWJlckVxdWFscygnJC5zdGVwc19sZW5ndGgnLCAwKVxuICAgICAgKSxcbiAgICAgIHByb2Nlc3NMZWdhY3lKb2JcbiAgICApXG4gICAgLm90aGVyd2lzZShyZXNvbHZlRGVwZW5kZW5jaWVzLm5leHQoc2V0dXBTdGVwTG9vcCkpO1xuXG4gIC8vIFNldCBoYXNfdGVtcGxhdGUgdG8gdHJ1ZSB3aGVuIHRlbXBsYXRlIGV4aXN0c1xuICBjb25zdCBzZXRIYXNUZW1wbGF0ZVRydWUgPSBuZXcgc2ZuLlBhc3Moc2NvcGUsICdTZXRIYXNUZW1wbGF0ZVRydWUnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICd3b3JrZmxvd0RhdGEuJCc6ICckLndvcmtmbG93RGF0YScsXG4gICAgICAnc3RlcHNfbGVuZ3RoLiQnOiAnJC5zdGVwc19sZW5ndGgnLFxuICAgICAgJ2hhc190ZW1wbGF0ZSc6IHRydWUsXG4gICAgICAndGVtcGxhdGVfaWQuJCc6ICckLndvcmtmbG93RGF0YS5JdGVtLnRlbXBsYXRlX2lkLlMnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrV29ya2Zsb3dUeXBlKTtcblxuICAvLyBTZXQgaGFzX3RlbXBsYXRlIHRvIGZhbHNlIHdoZW4gdGVtcGxhdGUgZG9lc24ndCBleGlzdFxuICBjb25zdCBzZXRIYXNUZW1wbGF0ZUZhbHNlID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnU2V0SGFzVGVtcGxhdGVGYWxzZScsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3dvcmtmbG93RGF0YS4kJzogJyQud29ya2Zsb3dEYXRhJyxcbiAgICAgICdzdGVwc19sZW5ndGguJCc6ICckLnN0ZXBzX2xlbmd0aCcsXG4gICAgICAnaGFzX3RlbXBsYXRlJzogZmFsc2UsXG4gICAgICAndGVtcGxhdGVfaWQnOiAnJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChjaGVja1dvcmtmbG93VHlwZSk7XG5cbiAgLy8gQ2hlY2sgaWYgdGVtcGxhdGUgZXhpc3RzIGFuZCBzZXQgaGFzX3RlbXBsYXRlIGJvb2xlYW5cbiAgY29uc3QgY2hlY2tUZW1wbGF0ZUV4aXN0cyA9IG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tUZW1wbGF0ZUV4aXN0cycpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmlzUHJlc2VudCgnJC53b3JrZmxvd0RhdGEuSXRlbS50ZW1wbGF0ZV9pZC5TJyksXG4gICAgICBzZXRIYXNUZW1wbGF0ZVRydWVcbiAgICApXG4gICAgLm90aGVyd2lzZShzZXRIYXNUZW1wbGF0ZUZhbHNlKTtcblxuICAvLyBDb21wdXRlIHN0ZXBzIGxlbmd0aCAtIGhhbmRsZSBib3RoIG5ldyAod2l0aCBzdGVwcykgYW5kIGxlZ2FjeSAod2l0aG91dCBzdGVwcykgd29ya2Zsb3dzXG4gIGNvbnN0IGNvbXB1dGVTdGVwc0xlbmd0aFdpdGhTdGVwcyA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ0NvbXB1dGVTdGVwc0xlbmd0aFdpdGhTdGVwcycsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3dvcmtmbG93RGF0YS4kJzogJyQud29ya2Zsb3dEYXRhJyxcbiAgICAgICdzdGVwc19sZW5ndGguJCc6ICdTdGF0ZXMuQXJyYXlMZW5ndGgoJC53b3JrZmxvd0RhdGEuSXRlbS5zdGVwcy5MKScsXG4gICAgICAvLyBEb24ndCBleHRyYWN0IHRlbXBsYXRlX2lkIGhlcmUgLSBsZXQgY2hlY2tUZW1wbGF0ZUV4aXN0cyBoYW5kbGUgaXQgc2FmZWx5XG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJCcsXG4gIH0pLm5leHQoY2hlY2tUZW1wbGF0ZUV4aXN0cyk7XG5cbiAgY29uc3QgY29tcHV0ZVN0ZXBzTGVuZ3RoTGVnYWN5ID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnQ29tcHV0ZVN0ZXBzTGVuZ3RoTGVnYWN5Jywge1xuICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICdqb2JfaWQuJCc6ICckLmpvYl9pZCcsXG4gICAgICAnd29ya2Zsb3dfaWQuJCc6ICckLndvcmtmbG93X2lkJyxcbiAgICAgICdzdWJtaXNzaW9uX2lkLiQnOiAnJC5zdWJtaXNzaW9uX2lkJyxcbiAgICAgICd0ZW5hbnRfaWQuJCc6ICckLnRlbmFudF9pZCcsXG4gICAgICAnd29ya2Zsb3dEYXRhLiQnOiAnJC53b3JrZmxvd0RhdGEnLFxuICAgICAgJ3N0ZXBzX2xlbmd0aCc6IDAsXG4gICAgICAvLyBEb24ndCBleHRyYWN0IHRlbXBsYXRlX2lkIGhlcmUgLSBsZXQgY2hlY2tUZW1wbGF0ZUV4aXN0cyBoYW5kbGUgaXQgc2FmZWx5XG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJCcsXG4gIH0pLm5leHQoY2hlY2tUZW1wbGF0ZUV4aXN0cyk7XG5cbiAgY29uc3QgY29tcHV0ZVN0ZXBzTGVuZ3RoID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDb21wdXRlU3RlcHNMZW5ndGgnKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5pc1ByZXNlbnQoJyQud29ya2Zsb3dEYXRhLkl0ZW0uc3RlcHMnKSxcbiAgICAgIGNvbXB1dGVTdGVwc0xlbmd0aFdpdGhTdGVwc1xuICAgIClcbiAgICAub3RoZXJ3aXNlKGNvbXB1dGVTdGVwc0xlbmd0aExlZ2FjeSk7XG5cbiAgLy8gRGVmaW5lIHdvcmtmbG93OiBVcGRhdGUgc3RhdHVzIC0+IEluaXRpYWxpemUgc3RlcHMgLT4gQ29tcHV0ZSBzdGVwcyBsZW5ndGggLT4gQ2hlY2sgdGVtcGxhdGUgLT4gQ2hlY2sgd29ya2Zsb3cgdHlwZSAtPiBQcm9jZXNzIGFjY29yZGluZ2x5XG4gIC8vIE5vdGU6IGNvbXB1dGVTdGVwc0xlbmd0aCBpbnRlcm5hbGx5IGNvbm5lY3RzIHRvIGNoZWNrVGVtcGxhdGVFeGlzdHNcbiAgcmV0dXJuIHVwZGF0ZUpvYlN0YXR1c1xuICAgIC5uZXh0KGluaXRpYWxpemVTdGVwcylcbiAgICAubmV4dChjb21wdXRlU3RlcHNMZW5ndGgpO1xufVxuXG4iXX0=