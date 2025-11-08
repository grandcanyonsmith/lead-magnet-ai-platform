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
    // Handle Lambda returning success: false (business logic failure)
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
    // Check if more steps remain - loops back to processStep if more steps (declared before incrementStep)
    const checkMoreSteps = new sfn.Choice(scope, 'CheckMoreSteps')
        .when(sfn.Condition.numberLessThanJsonPath('$.step_index', '$.total_steps'), processStep // Loop back to process next step
    )
        .otherwise(
    // Finalize job - used for both HTML and non-HTML workflows
    new tasks.DynamoUpdateItem(scope, 'FinalizeJob', {
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
    }));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBZUEsd0VBd1RDO0FBclVELG1FQUFxRDtBQUNyRCwyRUFBNkQ7QUFTN0Q7O0dBRUc7QUFDSCxTQUFnQiw4QkFBOEIsQ0FDNUMsS0FBZ0IsRUFDaEIsS0FBb0M7SUFFcEMsTUFBTSxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxLQUFLLENBQUM7SUFFaEUsa0NBQWtDO0lBQ2xDLE1BQU0sZUFBZSxHQUFHLElBQUksS0FBSyxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxpQkFBaUIsRUFBRTtRQUMzRSxLQUFLLEVBQUUsU0FBUztRQUNoQixHQUFHLEVBQUU7WUFDSCxNQUFNLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNqRjtRQUNELGdCQUFnQixFQUFFLGlEQUFpRDtRQUNuRSx3QkFBd0IsRUFBRTtZQUN4QixTQUFTLEVBQUUsUUFBUTtTQUNwQjtRQUNELHlCQUF5QixFQUFFO1lBQ3pCLFNBQVMsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQztZQUM5RCxhQUFhLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1NBQ3BHO1FBQ0QsVUFBVSxFQUFFLGdCQUFnQjtLQUM3QixDQUFDLENBQUM7SUFFSCxrRUFBa0U7SUFDbEUsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUs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QUF3QixHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsMEJBQTBCLEVBQUU7UUFDL0UsVUFBVSxFQUFFO1lBQ1YsVUFBVSxFQUFFLFVBQVU7WUFDdEIsZUFBZSxFQUFFLGVBQWU7WUFDaEMsaUJBQWlCLEVBQUUsaUJBQWlCO1lBQ3BDLGFBQWEsRUFBRSxhQUFhO1lBQzVCLGdCQUFnQixFQUFFLGdCQUFnQjtZQUNsQyxjQUFjLEVBQUUsQ0FBQztZQUNqQiw0RUFBNEU7U0FDN0U7UUFDRCxVQUFVLEVBQUUsR0FBRztLQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFFN0IsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLG9CQUFvQixDQUFDO1NBQ25FLElBQUksQ0FDSCxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQywyQkFBMkIsQ0FBQyxFQUNwRCwyQkFBMkIsQ0FDNUI7U0FDQSxTQUFTLENBQUMsd0JBQXdCLENBQUMsQ0FBQztJQUV2Qyw2SUFBNkk7SUFDN0ksc0VBQXNFO0lBQ3RFLE9BQU8sZUFBZTtTQUNuQixJQUFJLENBQUMsZUFBZSxDQUFDO1NBQ3JCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzlCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgc2ZuIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zJztcbmltcG9ydCAqIGFzIHRhc2tzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEpvYlByb2Nlc3NvclN0YXRlTWFjaGluZVByb3BzIHtcbiAgam9ic1RhYmxlOiBkeW5hbW9kYi5JVGFibGU7XG4gIHdvcmtmbG93c1RhYmxlOiBkeW5hbW9kYi5JVGFibGU7XG4gIGpvYlByb2Nlc3NvckxhbWJkYTogbGFtYmRhLkZ1bmN0aW9uO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgdGhlIFN0ZXAgRnVuY3Rpb25zIHN0YXRlIG1hY2hpbmUgZGVmaW5pdGlvbiBmb3Igam9iIHByb2Nlc3NpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUpvYlByb2Nlc3NvclN0YXRlTWFjaGluZShcbiAgc2NvcGU6IENvbnN0cnVjdCxcbiAgcHJvcHM6IEpvYlByb2Nlc3NvclN0YXRlTWFjaGluZVByb3BzXG4pOiBzZm4uSUNoYWluYWJsZSB7XG4gIGNvbnN0IHsgam9ic1RhYmxlLCB3b3JrZmxvd3NUYWJsZSwgam9iUHJvY2Vzc29yTGFtYmRhIH0gPSBwcm9wcztcblxuICAvLyBVcGRhdGUgam9iIHN0YXR1cyB0byBwcm9jZXNzaW5nXG4gIGNvbnN0IHVwZGF0ZUpvYlN0YXR1cyA9IG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHNjb3BlLCAnVXBkYXRlSm9iU3RhdHVzJywge1xuICAgIHRhYmxlOiBqb2JzVGFibGUsXG4gICAga2V5OiB7XG4gICAgICBqb2JfaWQ6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpKSxcbiAgICB9LFxuICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIHVwZGF0ZWRfYXQgPSA6dXBkYXRlZF9hdCcsXG4gICAgZXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgIH0sXG4gICAgZXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgJzpzdGF0dXMnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdwcm9jZXNzaW5nJyksXG4gICAgICAnOnVwZGF0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJC51cGRhdGVSZXN1bHQnLFxuICB9KTtcblxuICAvLyBIYW5kbGUgTGFtYmRhIHJldHVybmluZyBzdWNjZXNzOiBmYWxzZSAoYnVzaW5lc3MgbG9naWMgZmFpbHVyZSlcbiAgY29uc3QgaGFuZGxlU3RlcEZhaWx1cmUgPSBuZXcgdGFza3MuRHluYW1vVXBkYXRlSXRlbShzY29wZSwgJ0hhbmRsZVN0ZXBGYWlsdXJlJywge1xuICAgIHRhYmxlOiBqb2JzVGFibGUsXG4gICAga2V5OiB7XG4gICAgICBqb2JfaWQ6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpKSxcbiAgICB9LFxuICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIGVycm9yX21lc3NhZ2UgPSA6ZXJyb3IsIGVycm9yX3R5cGUgPSA6ZXJyb3JfdHlwZSwgdXBkYXRlZF9hdCA9IDp1cGRhdGVkX2F0JyxcbiAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICcjc3RhdHVzJzogJ3N0YXR1cycsXG4gICAgfSxcbiAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAnOnN0YXR1cyc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoJ2ZhaWxlZCcpLFxuICAgICAgJzplcnJvcic6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnByb2Nlc3NSZXN1bHQuUGF5bG9hZC5lcnJvcicpKSxcbiAgICAgICc6ZXJyb3JfdHlwZSc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnByb2Nlc3NSZXN1bHQuUGF5bG9hZC5lcnJvcl90eXBlJykpLFxuICAgICAgJzp1cGRhdGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIEhhbmRsZSBMYW1iZGEgZXhjZXB0aW9uICh0aW1lb3V0LCBldGMuKVxuICBjb25zdCBoYW5kbGVTdGVwRXhjZXB0aW9uID0gbmV3IHRhc2tzLkR5bmFtb1VwZGF0ZUl0ZW0oc2NvcGUsICdIYW5kbGVTdGVwRXhjZXB0aW9uJywge1xuICAgIHRhYmxlOiBqb2JzVGFibGUsXG4gICAga2V5OiB7XG4gICAgICBqb2JfaWQ6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnBhcnNlZEVycm9yLmpvYl9pZCcpKSxcbiAgICB9LFxuICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIGVycm9yX21lc3NhZ2UgPSA6ZXJyb3IsIHVwZGF0ZWRfYXQgPSA6dXBkYXRlZF9hdCcsXG4gICAgZXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgIH0sXG4gICAgZXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgJzpzdGF0dXMnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdmYWlsZWQnKSxcbiAgICAgICc6ZXJyb3InOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5wYXJzZWRFcnJvci5lcnJvcl9tZXNzYWdlJykpLFxuICAgICAgJzp1cGRhdGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFBhcnNlIGVycm9yIG1lc3NhZ2UgZnJvbSBMYW1iZGEgcmVzcG9uc2UgKGNyZWF0ZSBzZXBhcmF0ZSBpbnN0YW5jZXMgZm9yIGVhY2ggY2F0Y2ggaGFuZGxlcilcbiAgY29uc3QgcGFyc2VFcnJvckxlZ2FjeSA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ1BhcnNlRXJyb3JMZWdhY3knLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICdlcnJvcl9tZXNzYWdlJzogc2ZuLkpzb25QYXRoLmZvcm1hdChcbiAgICAgICAgJ0xhbWJkYSBleGVjdXRpb24gZmFpbGVkOiB7fSAtIHt9JyxcbiAgICAgICAgc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmVycm9yLkVycm9yJyksXG4gICAgICAgIHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5lcnJvci5DYXVzZScpXG4gICAgICApLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQucGFyc2VkRXJyb3InLFxuICB9KS5uZXh0KGhhbmRsZVN0ZXBFeGNlcHRpb24pO1xuXG4gIGNvbnN0IHBhcnNlRXJyb3JTdGVwID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnUGFyc2VFcnJvclN0ZXAnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICdzdGVwX2luZGV4LiQnOiAnJC5zdGVwX2luZGV4JyxcbiAgICAgICdlcnJvcl9tZXNzYWdlJzogc2ZuLkpzb25QYXRoLmZvcm1hdChcbiAgICAgICAgJ0xhbWJkYSBleGVjdXRpb24gZmFpbGVkOiB7fSAtIHt9JyxcbiAgICAgICAgc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmVycm9yLkVycm9yJyksXG4gICAgICAgIHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5lcnJvci5DYXVzZScpXG4gICAgICApLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQucGFyc2VkRXJyb3InLFxuICB9KS5uZXh0KGhhbmRsZVN0ZXBFeGNlcHRpb24pO1xuXG4gIC8vIEluaXRpYWxpemUgc3RlcHM6IExvYWQgd29ya2Zsb3cgYW5kIGdldCBzdGVwIGNvdW50XG4gIGNvbnN0IGluaXRpYWxpemVTdGVwcyA9IG5ldyB0YXNrcy5EeW5hbW9HZXRJdGVtKHNjb3BlLCAnSW5pdGlhbGl6ZVN0ZXBzJywge1xuICAgIHRhYmxlOiB3b3JrZmxvd3NUYWJsZSxcbiAgICBrZXk6IHtcbiAgICAgIHdvcmtmbG93X2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC53b3JrZmxvd19pZCcpKSxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckLndvcmtmbG93RGF0YScsXG4gIH0pO1xuXG4gIC8vIFByb2Nlc3MgYSBzaW5nbGUgc3RlcCB1c2luZyBMYW1iZGEgZnVuY3Rpb24gKGRlY2xhcmVkIGVhcmx5IGZvciB1c2UgaW4gc2V0dXBTdGVwTG9vcClcbiAgY29uc3QgcHJvY2Vzc1N0ZXAgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHNjb3BlLCAnUHJvY2Vzc1N0ZXAnLCB7XG4gICAgbGFtYmRhRnVuY3Rpb246IGpvYlByb2Nlc3NvckxhbWJkYSxcbiAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgJ2pvYl9pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgICdzdGVwX2luZGV4Jzogc2ZuLkpzb25QYXRoLm51bWJlckF0KCckLnN0ZXBfaW5kZXgnKSxcbiAgICAgICdzdGVwX3R5cGUnOiAnd29ya2Zsb3dfc3RlcCcsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQucHJvY2Vzc1Jlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBMYW1iZGEgZmFpbHVyZXNcbiAgcHJvY2Vzc1N0ZXAuYWRkQ2F0Y2gocGFyc2VFcnJvclN0ZXAsIHtcbiAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgZXJyb3JzOiBbJ1N0YXRlcy5BTEwnXSxcbiAgfSk7XG5cbiAgLy8gQ2hlY2sgaWYgbW9yZSBzdGVwcyByZW1haW4gLSBsb29wcyBiYWNrIHRvIHByb2Nlc3NTdGVwIGlmIG1vcmUgc3RlcHMgKGRlY2xhcmVkIGJlZm9yZSBpbmNyZW1lbnRTdGVwKVxuICBjb25zdCBjaGVja01vcmVTdGVwcyA9IG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tNb3JlU3RlcHMnKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5udW1iZXJMZXNzVGhhbkpzb25QYXRoKCckLnN0ZXBfaW5kZXgnLCAnJC50b3RhbF9zdGVwcycpLFxuICAgICAgcHJvY2Vzc1N0ZXAgIC8vIExvb3AgYmFjayB0byBwcm9jZXNzIG5leHQgc3RlcFxuICAgIClcbiAgICAub3RoZXJ3aXNlKFxuICAgICAgLy8gRmluYWxpemUgam9iIC0gdXNlZCBmb3IgYm90aCBIVE1MIGFuZCBub24tSFRNTCB3b3JrZmxvd3NcbiAgICAgIG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHNjb3BlLCAnRmluYWxpemVKb2InLCB7XG4gICAgICAgIHRhYmxlOiBqb2JzVGFibGUsXG4gICAgICAgIGtleToge1xuICAgICAgICAgIGpvYl9pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJykpLFxuICAgICAgICB9LFxuICAgICAgICB1cGRhdGVFeHByZXNzaW9uOiAnU0VUICNzdGF0dXMgPSA6c3RhdHVzLCBjb21wbGV0ZWRfYXQgPSA6Y29tcGxldGVkX2F0LCB1cGRhdGVkX2F0ID0gOnVwZGF0ZWRfYXQnLFxuICAgICAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgICAgICB9LFxuICAgICAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpzdGF0dXMnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdjb21wbGV0ZWQnKSxcbiAgICAgICAgICAnOmNvbXBsZXRlZF9hdCc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckJC5TdGF0ZS5FbnRlcmVkVGltZScpKSxcbiAgICAgICAgICAnOnVwZGF0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgLy8gQ2hlY2sgaWYgc3RlcCBzdWNjZWVkZWQgLSBjb25uZWN0cyB0byBpbmNyZW1lbnRTdGVwIHdoaWNoIGNvbm5lY3RzIHRvIGNoZWNrTW9yZVN0ZXBzXG4gIGNvbnN0IGluY3JlbWVudFN0ZXAgPSBuZXcgc2ZuLlBhc3Moc2NvcGUsICdJbmNyZW1lbnRTdGVwJywge1xuICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICdqb2JfaWQuJCc6ICckLmpvYl9pZCcsXG4gICAgICAnd29ya2Zsb3dfaWQuJCc6ICckLndvcmtmbG93X2lkJyxcbiAgICAgICdzdWJtaXNzaW9uX2lkLiQnOiAnJC5zdWJtaXNzaW9uX2lkJyxcbiAgICAgICd0ZW5hbnRfaWQuJCc6ICckLnRlbmFudF9pZCcsXG4gICAgICAnc3RlcF9pbmRleC4kJzogJ1N0YXRlcy5NYXRoQWRkKCQuc3RlcF9pbmRleCwgMSknLFxuICAgICAgJ3RvdGFsX3N0ZXBzLiQnOiAnJC50b3RhbF9zdGVwcycsXG4gICAgICAnaGFzX3RlbXBsYXRlLiQnOiAnJC5oYXNfdGVtcGxhdGUnLFxuICAgICAgJ3RlbXBsYXRlX2lkLiQnOiAnJC50ZW1wbGF0ZV9pZCcsXG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJCcsXG4gIH0pLm5leHQoY2hlY2tNb3JlU3RlcHMpO1xuXG4gIGNvbnN0IGNoZWNrU3RlcFJlc3VsdCA9IG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tTdGVwUmVzdWx0JylcbiAgICAud2hlbihcbiAgICAgIHNmbi5Db25kaXRpb24uYm9vbGVhbkVxdWFscygnJC5wcm9jZXNzUmVzdWx0LlBheWxvYWQuc3VjY2VzcycsIGZhbHNlKSxcbiAgICAgIGhhbmRsZVN0ZXBGYWlsdXJlXG4gICAgKVxuICAgIC5vdGhlcndpc2UoaW5jcmVtZW50U3RlcCk7XG5cbiAgLy8gUmVzb2x2ZSBzdGVwIGRlcGVuZGVuY2llcyAtIGNhbGxzIExhbWJkYSB0byBidWlsZCBleGVjdXRpb24gcGxhblxuICBjb25zdCByZXNvbHZlRGVwZW5kZW5jaWVzID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZShzY29wZSwgJ1Jlc29sdmVEZXBlbmRlbmNpZXMnLCB7XG4gICAgbGFtYmRhRnVuY3Rpb246IGpvYlByb2Nlc3NvckxhbWJkYSxcbiAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgJ2pvYl9pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgICd3b3JrZmxvd19pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC53b3JrZmxvd19pZCcpLFxuICAgICAgJ2FjdGlvbic6ICdyZXNvbHZlX2RlcGVuZGVuY2llcycsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQuZXhlY3V0aW9uUGxhbicsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gU2V0dXAgc3RlcCBsb29wIGZvciBtdWx0aS1zdGVwIHdvcmtmbG93c1xuICBjb25zdCBzZXR1cFN0ZXBMb29wID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnU2V0dXBTdGVwTG9vcCcsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3N0ZXBfaW5kZXgnOiAwLFxuICAgICAgJ3RvdGFsX3N0ZXBzLiQnOiAnJC5zdGVwc19sZW5ndGgnLFxuICAgICAgJ2hhc190ZW1wbGF0ZS4kJzogJyQuaGFzX3RlbXBsYXRlJyxcbiAgICAgICd0ZW1wbGF0ZV9pZC4kJzogJyQudGVtcGxhdGVfaWQnLFxuICAgICAgJ2V4ZWN1dGlvbl9wbGFuLiQnOiAnJC5leGVjdXRpb25QbGFuLlBheWxvYWQnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KHByb2Nlc3NTdGVwKS5uZXh0KGNoZWNrU3RlcFJlc3VsdCk7XG5cbiAgLy8gTGVnYWN5IHdvcmtmbG93IHByb2Nlc3NpbmdcbiAgY29uc3QgcHJvY2Vzc0xlZ2FjeUpvYiA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2Uoc2NvcGUsICdQcm9jZXNzTGVnYWN5Sm9iJywge1xuICAgIGxhbWJkYUZ1bmN0aW9uOiBqb2JQcm9jZXNzb3JMYW1iZGEsXG4gICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICdqb2JfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJyksXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQucHJvY2Vzc1Jlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSlcbiAgICAuYWRkQ2F0Y2gocGFyc2VFcnJvckxlZ2FjeSwge1xuICAgICAgcmVzdWx0UGF0aDogJyQuZXJyb3InLFxuICAgICAgZXJyb3JzOiBbJ1N0YXRlcy5BTEwnXSxcbiAgICB9KVxuICAgIC5uZXh0KFxuICAgICAgbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja0xlZ2FjeVJlc3VsdCcpXG4gICAgICAgIC53aGVuKFxuICAgICAgICAgIHNmbi5Db25kaXRpb24uYm9vbGVhbkVxdWFscygnJC5wcm9jZXNzUmVzdWx0LlBheWxvYWQuc3VjY2VzcycsIGZhbHNlKSxcbiAgICAgICAgICBoYW5kbGVTdGVwRmFpbHVyZVxuICAgICAgICApXG4gICAgICAgIC5vdGhlcndpc2UoXG4gICAgICAgICAgbmV3IHRhc2tzLkR5bmFtb1VwZGF0ZUl0ZW0oc2NvcGUsICdGaW5hbGl6ZUxlZ2FjeUpvYicsIHtcbiAgICAgICAgICAgIHRhYmxlOiBqb2JzVGFibGUsXG4gICAgICAgICAgICBrZXk6IHtcbiAgICAgICAgICAgICAgam9iX2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdXBkYXRlRXhwcmVzc2lvbjogJ1NFVCAjc3RhdHVzID0gOnN0YXR1cywgY29tcGxldGVkX2F0ID0gOmNvbXBsZXRlZF9hdCwgdXBkYXRlZF9hdCA9IDp1cGRhdGVkX2F0JyxcbiAgICAgICAgICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAgICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgICAgICAgJzpzdGF0dXMnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdjb21wbGV0ZWQnKSxcbiAgICAgICAgICAgICAgJzpjb21wbGV0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICAgICAgICAgICc6dXBkYXRlZF9hdCc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckJC5TdGF0ZS5FbnRlcmVkVGltZScpKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSlcbiAgICAgICAgKVxuICAgICk7XG5cbiAgLy8gQ2hlY2sgd29ya2Zsb3cgdHlwZSBhbmQgcm91dGUgYWNjb3JkaW5nbHkgKGRlZmluZWQgYWZ0ZXIgcHJvY2Vzc0xlZ2FjeUpvYiBhbmQgc2V0dXBTdGVwTG9vcClcbiAgY29uc3QgY2hlY2tXb3JrZmxvd1R5cGUgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrV29ya2Zsb3dUeXBlJylcbiAgICAud2hlbihcbiAgICAgIHNmbi5Db25kaXRpb24ub3IoXG4gICAgICAgIHNmbi5Db25kaXRpb24uaXNOb3RQcmVzZW50KCckLndvcmtmbG93RGF0YS5JdGVtLnN0ZXBzJyksXG4gICAgICAgIHNmbi5Db25kaXRpb24ubnVtYmVyRXF1YWxzKCckLnN0ZXBzX2xlbmd0aCcsIDApXG4gICAgICApLFxuICAgICAgcHJvY2Vzc0xlZ2FjeUpvYlxuICAgIClcbiAgICAub3RoZXJ3aXNlKHJlc29sdmVEZXBlbmRlbmNpZXMubmV4dChzZXR1cFN0ZXBMb29wKSk7XG5cbiAgLy8gU2V0IGhhc190ZW1wbGF0ZSB0byB0cnVlIHdoZW4gdGVtcGxhdGUgZXhpc3RzXG4gIGNvbnN0IHNldEhhc1RlbXBsYXRlVHJ1ZSA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ1NldEhhc1RlbXBsYXRlVHJ1ZScsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3dvcmtmbG93RGF0YS4kJzogJyQud29ya2Zsb3dEYXRhJyxcbiAgICAgICdzdGVwc19sZW5ndGguJCc6ICckLnN0ZXBzX2xlbmd0aCcsXG4gICAgICAnaGFzX3RlbXBsYXRlJzogdHJ1ZSxcbiAgICAgICd0ZW1wbGF0ZV9pZC4kJzogJyQud29ya2Zsb3dEYXRhLkl0ZW0udGVtcGxhdGVfaWQuUycsXG4gICAgfSxcbiAgICByZXN1bHRQYXRoOiAnJCcsXG4gIH0pLm5leHQoY2hlY2tXb3JrZmxvd1R5cGUpO1xuXG4gIC8vIFNldCBoYXNfdGVtcGxhdGUgdG8gZmFsc2Ugd2hlbiB0ZW1wbGF0ZSBkb2Vzbid0IGV4aXN0XG4gIGNvbnN0IHNldEhhc1RlbXBsYXRlRmFsc2UgPSBuZXcgc2ZuLlBhc3Moc2NvcGUsICdTZXRIYXNUZW1wbGF0ZUZhbHNlJywge1xuICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICdqb2JfaWQuJCc6ICckLmpvYl9pZCcsXG4gICAgICAnd29ya2Zsb3dfaWQuJCc6ICckLndvcmtmbG93X2lkJyxcbiAgICAgICdzdWJtaXNzaW9uX2lkLiQnOiAnJC5zdWJtaXNzaW9uX2lkJyxcbiAgICAgICd0ZW5hbnRfaWQuJCc6ICckLnRlbmFudF9pZCcsXG4gICAgICAnd29ya2Zsb3dEYXRhLiQnOiAnJC53b3JrZmxvd0RhdGEnLFxuICAgICAgJ3N0ZXBzX2xlbmd0aC4kJzogJyQuc3RlcHNfbGVuZ3RoJyxcbiAgICAgICdoYXNfdGVtcGxhdGUnOiBmYWxzZSxcbiAgICAgICd0ZW1wbGF0ZV9pZCc6ICcnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrV29ya2Zsb3dUeXBlKTtcblxuICAvLyBDaGVjayBpZiB0ZW1wbGF0ZSBleGlzdHMgYW5kIHNldCBoYXNfdGVtcGxhdGUgYm9vbGVhblxuICBjb25zdCBjaGVja1RlbXBsYXRlRXhpc3RzID0gbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja1RlbXBsYXRlRXhpc3RzJylcbiAgICAud2hlbihcbiAgICAgIHNmbi5Db25kaXRpb24uaXNQcmVzZW50KCckLndvcmtmbG93RGF0YS5JdGVtLnRlbXBsYXRlX2lkLlMnKSxcbiAgICAgIHNldEhhc1RlbXBsYXRlVHJ1ZVxuICAgIClcbiAgICAub3RoZXJ3aXNlKHNldEhhc1RlbXBsYXRlRmFsc2UpO1xuXG4gIC8vIENvbXB1dGUgc3RlcHMgbGVuZ3RoIC0gaGFuZGxlIGJvdGggbmV3ICh3aXRoIHN0ZXBzKSBhbmQgbGVnYWN5ICh3aXRob3V0IHN0ZXBzKSB3b3JrZmxvd3NcbiAgY29uc3QgY29tcHV0ZVN0ZXBzTGVuZ3RoV2l0aFN0ZXBzID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnQ29tcHV0ZVN0ZXBzTGVuZ3RoV2l0aFN0ZXBzJywge1xuICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICdqb2JfaWQuJCc6ICckLmpvYl9pZCcsXG4gICAgICAnd29ya2Zsb3dfaWQuJCc6ICckLndvcmtmbG93X2lkJyxcbiAgICAgICdzdWJtaXNzaW9uX2lkLiQnOiAnJC5zdWJtaXNzaW9uX2lkJyxcbiAgICAgICd0ZW5hbnRfaWQuJCc6ICckLnRlbmFudF9pZCcsXG4gICAgICAnd29ya2Zsb3dEYXRhLiQnOiAnJC53b3JrZmxvd0RhdGEnLFxuICAgICAgJ3N0ZXBzX2xlbmd0aC4kJzogJ1N0YXRlcy5BcnJheUxlbmd0aCgkLndvcmtmbG93RGF0YS5JdGVtLnN0ZXBzLkwpJyxcbiAgICAgIC8vIERvbid0IGV4dHJhY3QgdGVtcGxhdGVfaWQgaGVyZSAtIGxldCBjaGVja1RlbXBsYXRlRXhpc3RzIGhhbmRsZSBpdCBzYWZlbHlcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChjaGVja1RlbXBsYXRlRXhpc3RzKTtcblxuICBjb25zdCBjb21wdXRlU3RlcHNMZW5ndGhMZWdhY3kgPSBuZXcgc2ZuLlBhc3Moc2NvcGUsICdDb21wdXRlU3RlcHNMZW5ndGhMZWdhY3knLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICd3b3JrZmxvd0RhdGEuJCc6ICckLndvcmtmbG93RGF0YScsXG4gICAgICAnc3RlcHNfbGVuZ3RoJzogMCxcbiAgICAgIC8vIERvbid0IGV4dHJhY3QgdGVtcGxhdGVfaWQgaGVyZSAtIGxldCBjaGVja1RlbXBsYXRlRXhpc3RzIGhhbmRsZSBpdCBzYWZlbHlcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChjaGVja1RlbXBsYXRlRXhpc3RzKTtcblxuICBjb25zdCBjb21wdXRlU3RlcHNMZW5ndGggPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NvbXB1dGVTdGVwc0xlbmd0aCcpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmlzUHJlc2VudCgnJC53b3JrZmxvd0RhdGEuSXRlbS5zdGVwcycpLFxuICAgICAgY29tcHV0ZVN0ZXBzTGVuZ3RoV2l0aFN0ZXBzXG4gICAgKVxuICAgIC5vdGhlcndpc2UoY29tcHV0ZVN0ZXBzTGVuZ3RoTGVnYWN5KTtcblxuICAvLyBEZWZpbmUgd29ya2Zsb3c6IFVwZGF0ZSBzdGF0dXMgLT4gSW5pdGlhbGl6ZSBzdGVwcyAtPiBDb21wdXRlIHN0ZXBzIGxlbmd0aCAtPiBDaGVjayB0ZW1wbGF0ZSAtPiBDaGVjayB3b3JrZmxvdyB0eXBlIC0+IFByb2Nlc3MgYWNjb3JkaW5nbHlcbiAgLy8gTm90ZTogY29tcHV0ZVN0ZXBzTGVuZ3RoIGludGVybmFsbHkgY29ubmVjdHMgdG8gY2hlY2tUZW1wbGF0ZUV4aXN0c1xuICByZXR1cm4gdXBkYXRlSm9iU3RhdHVzXG4gICAgLm5leHQoaW5pdGlhbGl6ZVN0ZXBzKVxuICAgIC5uZXh0KGNvbXB1dGVTdGVwc0xlbmd0aCk7XG59XG5cbiJdfQ==