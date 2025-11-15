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
    // Define workflow: Update status -> Initialize steps -> Compute steps length -> Check template -> Process steps
    // All workflows must use steps format - legacy format is no longer supported
    return updateJobStatus
        .next(initializeSteps)
        .next(computeStepsLength);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiam9iLXByb2Nlc3Nvci1zdGF0ZS1tYWNoaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNEJBLHdFQXFOQztBQS9PRCxtRUFBcUQ7QUFDckQsMkVBQTZEO0FBRTdELHFEQUswQjtBQVExQjs7Ozs7Ozs7O0dBU0c7QUFDSCxTQUFnQiw4QkFBOEIsQ0FDNUMsS0FBZ0IsRUFDaEIsS0FBb0M7SUFFcEMsTUFBTSxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxLQUFLLENBQUM7SUFFaEUsa0NBQWtDO0lBQ2xDLE1BQU0sZUFBZSxHQUFHLElBQUksS0FBSyxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxpQkFBaUIsRUFBRTtRQUMzRSxLQUFLLEVBQUUsU0FBUztRQUNoQixHQUFHLEVBQUU7WUFDSCxNQUFNLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNqRjtRQUNELGdCQUFnQixFQUFFLGlEQUFpRDtRQUNuRSx3QkFBd0IsRUFBRTtZQUN4QixTQUFTLEVBQUUsUUFBUTtTQUNwQjtRQUNELHlCQUF5QixFQUFFO1lBQ3pCLFNBQVMsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQztZQUM5RCxhQUFhLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1NBQ3BHO1FBQ0QsVUFBVSxFQUFFLGdCQUFnQjtLQUM3QixDQUFDLENBQUM7SUFFSCwrQ0FBK0M7SUFDL0MsTUFBTSxpQkFBaUIsR0FBRyxJQUFBLHlDQUF3QixFQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNyRSxNQUFNLDJCQUEyQixHQUFHLElBQUEsbURBQWtDLEVBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3pGLE1BQU0sZ0JBQWdCLEdBQUcsSUFBQSw0Q0FBMkIsRUFBQyxLQUFLLEVBQUUsa0JBQWtCLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2xHLE1BQU0sY0FBYyxHQUFHLElBQUEsNENBQTJCLEVBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUU3RixxREFBcUQ7SUFDckQsTUFBTSxlQUFlLEdBQUcsSUFBSSxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxpQkFBaUIsRUFBRTtRQUN4RSxLQUFLLEVBQUUsY0FBYztRQUNyQixHQUFHLEVBQUU7WUFDSCxXQUFXLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsQ0FBQztTQUMzRjtRQUNELFVBQVUsRUFBRSxnQkFBZ0I7S0FDN0IsQ0FBQyxDQUFDO0lBRUgsd0ZBQXdGO0lBQ3hGLE1BQU0sV0FBVyxHQUFHLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsYUFBYSxFQUFFO1FBQy9ELGNBQWMsRUFBRSxrQkFBa0I7UUFDbEMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDO1lBQ2hDLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFDM0MsWUFBWSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQztZQUNuRCxXQUFXLEVBQUUsZUFBZTtTQUM3QixDQUFDO1FBQ0YsVUFBVSxFQUFFLGlCQUFpQjtRQUM3Qix3QkFBd0IsRUFBRSxLQUFLO0tBQ2hDLENBQUMsQ0FBQztJQUVILHlDQUF5QztJQUN6QyxXQUFXLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRTtRQUNuQyxVQUFVLEVBQUUsU0FBUztRQUNyQixNQUFNLEVBQUUsQ0FBQyxZQUFZLENBQUM7S0FDdkIsQ0FBQyxDQUFDO0lBRUgsK0JBQStCO0lBQy9CLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxLQUFLLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSx1QkFBdUIsRUFBRTtRQUNuRixjQUFjLEVBQUUsa0JBQWtCO1FBQ2xDLE9BQU8sRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQztZQUNoQyxRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO1lBQzNDLFdBQVcsRUFBRSxpQkFBaUI7U0FDL0IsQ0FBQztRQUNGLFVBQVUsRUFBRSxjQUFjO1FBQzFCLHdCQUF3QixFQUFFLEtBQUs7S0FDaEMsQ0FBQyxDQUFDO0lBRUgsa0RBQWtEO0lBQ2xELDBFQUEwRTtJQUMxRSw4RUFBOEU7SUFDOUUscUJBQXFCLENBQUMsUUFBUSxDQUFDLGdCQUFnQixFQUFFO1FBQy9DLFVBQVUsRUFBRSxTQUFTO1FBQ3JCLE1BQU0sRUFBRSxDQUFDLFlBQVksQ0FBQztLQUN2QixDQUFDLENBQUM7SUFFSCxpREFBaUQ7SUFDakQsTUFBTSxXQUFXLEdBQUcsSUFBQSxtQ0FBa0IsRUFBQyxLQUFLLEVBQUUsYUFBYSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBRXhFLCtCQUErQjtJQUMvQixNQUFNLGVBQWUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLGlCQUFpQixDQUFDO1NBQzdELElBQUksQ0FDSCxHQUFHLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyw4QkFBOEIsRUFBRSxLQUFLLENBQUMsRUFDbEUsMkJBQTJCLENBQzVCO1NBQ0EsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBRTFCLHVHQUF1RztJQUN2RyxNQUFNLGNBQWMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLGdCQUFnQixDQUFDO1NBQzNELElBQUksQ0FDSCxHQUFHLENBQUMsU0FBUyxDQUFDLHNCQUFzQixDQUFDLGNBQWMsRUFBRSxlQUFlLENBQUMsRUFDckUsV0FBVyxDQUFFLGlDQUFpQztLQUMvQztTQUNBLFNBQVM7SUFDUixtRUFBbUU7SUFDbkUsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxtQkFBbUIsQ0FBQztTQUN2QyxJQUFJLENBQ0gsR0FBRyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLEVBQ25ELHFCQUFxQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FDNUM7U0FDQSxTQUFTLENBQUMsV0FBVyxDQUFDLENBQzFCLENBQUM7SUFFSix1RkFBdUY7SUFDdkYsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxlQUFlLEVBQUU7UUFDekQsVUFBVSxFQUFFO1lBQ1YsVUFBVSxFQUFFLFVBQVU7WUFDdEIsZUFBZSxFQUFFLGVBQWU7WUFDaEMsaUJBQWlCLEVBQUUsaUJBQWlCO1lBQ3BDLGFBQWEsRUFBRSxhQUFhO1lBQzVCLGNBQWMsRUFBRSxpQ0FBaUM7WUFDakQsZUFBZSxFQUFFLGVBQWU7WUFDaEMsZ0JBQWdCLEVBQUUsZ0JBQWdCO1lBQ2xDLGVBQWUsRUFBRSxlQUFlO1NBQ2pDO1FBQ0QsVUFBVSxFQUFFLEdBQUc7S0FDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUV4QixNQUFNLGVBQWUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLGlCQUFpQixDQUFDO1NBQzdELElBQUksQ0FDSCxHQUFHLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxpQ0FBaUMsRUFBRSxLQUFLLENBQUMsRUFDckUsaUJBQWlCLENBQ2xCO1NBQ0EsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRTVCLG1FQUFtRTtJQUNuRSxNQUFNLG1CQUFtQixHQUFHLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUscUJBQXFCLEVBQUU7UUFDL0UsY0FBYyxFQUFFLGtCQUFrQjtRQUNsQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUM7WUFDaEMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQztZQUMzQyxhQUFhLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDO1lBQ3JELFFBQVEsRUFBRSxzQkFBc0I7U0FDakMsQ0FBQztRQUNGLFVBQVUsRUFBRSxpQkFBaUI7UUFDN0Isd0JBQXdCLEVBQUUsS0FBSztLQUNoQyxDQUFDLENBQUM7SUFFSCwyQ0FBMkM7SUFDM0MsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxlQUFlLEVBQUU7UUFDekQsVUFBVSxFQUFFO1lBQ1YsVUFBVSxFQUFFLFVBQVU7WUFDdEIsZUFBZSxFQUFFLGVBQWU7WUFDaEMsaUJBQWlCLEVBQUUsaUJBQWlCO1lBQ3BDLGFBQWEsRUFBRSxhQUFhO1lBQzVCLFlBQVksRUFBRSxDQUFDO1lBQ2YsZUFBZSxFQUFFLGdCQUFnQjtZQUNqQyxnQkFBZ0IsRUFBRSxnQkFBZ0I7WUFDbEMsZUFBZSxFQUFFLGVBQWU7WUFDaEMsa0JBQWtCLEVBQUUseUJBQXlCO1NBQzlDO1FBQ0QsVUFBVSxFQUFFLEdBQUc7S0FDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7SUFFM0MsZ0ZBQWdGO0lBQ2hGLDJEQUEyRDtJQUMzRCxNQUFNLGlCQUFpQixHQUFHLG1CQUFtQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUVsRSxnREFBZ0Q7SUFDaEQsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLG9CQUFvQixFQUFFO1FBQ25FLFVBQVUsRUFBRTtZQUNWLFVBQVUsRUFBRSxVQUFVO1lBQ3RCLGVBQWUsRUFBRSxlQUFlO1lBQ2hDLGlCQUFpQixFQUFFLGlCQUFpQjtZQUNwQyxhQUFhLEVBQUUsYUFBYTtZQUM1QixnQkFBZ0IsRUFBRSxnQkFBZ0I7WUFDbEMsZ0JBQWdCLEVBQUUsZ0JBQWdCO1lBQ2xDLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLGVBQWUsRUFBRSxtQ0FBbUM7U0FDckQ7UUFDRCxVQUFVLEVBQUUsR0FBRztLQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFFM0Isd0RBQXdEO0lBQ3hELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxxQkFBcUIsRUFBRTtRQUNyRSxVQUFVLEVBQUU7WUFDVixVQUFVLEVBQUUsVUFBVTtZQUN0QixlQUFlLEVBQUUsZUFBZTtZQUNoQyxpQkFBaUIsRUFBRSxpQkFBaUI7WUFDcEMsYUFBYSxFQUFFLGFBQWE7WUFDNUIsZ0JBQWdCLEVBQUUsZ0JBQWdCO1lBQ2xDLGdCQUFnQixFQUFFLGdCQUFnQjtZQUNsQyxjQUFjLEVBQUUsS0FBSztZQUNyQixhQUFhLEVBQUUsRUFBRTtTQUNsQjtRQUNELFVBQVUsRUFBRSxHQUFHO0tBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUUzQix3REFBd0Q7SUFDeEQsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLHFCQUFxQixDQUFDO1NBQ3JFLElBQUksQ0FDSCxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxtQ0FBbUMsQ0FBQyxFQUM1RCxrQkFBa0IsQ0FDbkI7U0FDQSxTQUFTLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUVsQywyRkFBMkY7SUFDM0YsZ0VBQWdFO0lBQ2hFLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxvQkFBb0IsRUFBRTtRQUNuRSxVQUFVLEVBQUU7WUFDVixVQUFVLEVBQUUsVUFBVTtZQUN0QixlQUFlLEVBQUUsZUFBZTtZQUNoQyxpQkFBaUIsRUFBRSxpQkFBaUI7WUFDcEMsYUFBYSxFQUFFLGFBQWE7WUFDNUIsZ0JBQWdCLEVBQUUsZ0JBQWdCO1lBQ2xDLGdCQUFnQixFQUFFLGlEQUFpRDtTQUNwRTtRQUNELFVBQVUsRUFBRSxHQUFHO0tBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUU3QixnSEFBZ0g7SUFDaEgsNkVBQTZFO0lBQzdFLE9BQU8sZUFBZTtTQUNuQixJQUFJLENBQUMsZUFBZSxDQUFDO1NBQ3JCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzlCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgc2ZuIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zJztcbmltcG9ydCAqIGFzIHRhc2tzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHtcbiAgY3JlYXRlU3RlcEZhaWx1cmVIYW5kbGVyLFxuICBjcmVhdGVIdG1sR2VuZXJhdGlvbkZhaWx1cmVIYW5kbGVyLFxuICBjcmVhdGVFeGNlcHRpb25IYW5kbGVyQ2hhaW4sXG4gIGNyZWF0ZUpvYkZpbmFsaXplcixcbn0gZnJvbSAnLi9lcnJvci1oYW5kbGVycyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSm9iUHJvY2Vzc29yU3RhdGVNYWNoaW5lUHJvcHMge1xuICBqb2JzVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgd29ya2Zsb3dzVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgam9iUHJvY2Vzc29yTGFtYmRhOiBsYW1iZGEuSUZ1bmN0aW9uO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgdGhlIFN0ZXAgRnVuY3Rpb25zIHN0YXRlIG1hY2hpbmUgZGVmaW5pdGlvbiBmb3Igam9iIHByb2Nlc3NpbmdcbiAqIFxuICogVGhpcyBzdGF0ZSBtYWNoaW5lIG9yY2hlc3RyYXRlcyB0aGUgZXhlY3V0aW9uIG9mIHdvcmtmbG93IGpvYnMsIGhhbmRsaW5nOlxuICogLSBNdWx0aS1zdGVwIHdvcmtmbG93cyB3aXRoIGRlcGVuZGVuY3kgcmVzb2x1dGlvblxuICogLSBIVE1MIGdlbmVyYXRpb24gZm9yIHRlbXBsYXRlc1xuICogLSBFcnJvciBoYW5kbGluZyBhbmQgam9iIHN0YXR1cyB1cGRhdGVzXG4gKiBcbiAqIE5vdGU6IExlZ2FjeSBmb3JtYXQgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZC4gQWxsIHdvcmtmbG93cyBtdXN0IHVzZSBzdGVwcyBmb3JtYXQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVKb2JQcm9jZXNzb3JTdGF0ZU1hY2hpbmUoXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIHByb3BzOiBKb2JQcm9jZXNzb3JTdGF0ZU1hY2hpbmVQcm9wc1xuKTogc2ZuLklDaGFpbmFibGUge1xuICBjb25zdCB7IGpvYnNUYWJsZSwgd29ya2Zsb3dzVGFibGUsIGpvYlByb2Nlc3NvckxhbWJkYSB9ID0gcHJvcHM7XG5cbiAgLy8gVXBkYXRlIGpvYiBzdGF0dXMgdG8gcHJvY2Vzc2luZ1xuICBjb25zdCB1cGRhdGVKb2JTdGF0dXMgPSBuZXcgdGFza3MuRHluYW1vVXBkYXRlSXRlbShzY29wZSwgJ1VwZGF0ZUpvYlN0YXR1cycsIHtcbiAgICB0YWJsZTogam9ic1RhYmxlLFxuICAgIGtleToge1xuICAgICAgam9iX2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSksXG4gICAgfSxcbiAgICB1cGRhdGVFeHByZXNzaW9uOiAnU0VUICNzdGF0dXMgPSA6c3RhdHVzLCB1cGRhdGVkX2F0ID0gOnVwZGF0ZWRfYXQnLFxuICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICB9LFxuICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygncHJvY2Vzc2luZycpLFxuICAgICAgJzp1cGRhdGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQudXBkYXRlUmVzdWx0JyxcbiAgfSk7XG5cbiAgLy8gQ3JlYXRlIGVycm9yIGhhbmRsZXJzIHVzaW5nIGhlbHBlciBmdW5jdGlvbnNcbiAgY29uc3QgaGFuZGxlU3RlcEZhaWx1cmUgPSBjcmVhdGVTdGVwRmFpbHVyZUhhbmRsZXIoc2NvcGUsIGpvYnNUYWJsZSk7XG4gIGNvbnN0IGhhbmRsZUh0bWxHZW5lcmF0aW9uRmFpbHVyZSA9IGNyZWF0ZUh0bWxHZW5lcmF0aW9uRmFpbHVyZUhhbmRsZXIoc2NvcGUsIGpvYnNUYWJsZSk7XG4gIGNvbnN0IHBhcnNlRXJyb3JMZWdhY3kgPSBjcmVhdGVFeGNlcHRpb25IYW5kbGVyQ2hhaW4oc2NvcGUsICdQYXJzZUVycm9yTGVnYWN5Jywgam9ic1RhYmxlLCBmYWxzZSk7XG4gIGNvbnN0IHBhcnNlRXJyb3JTdGVwID0gY3JlYXRlRXhjZXB0aW9uSGFuZGxlckNoYWluKHNjb3BlLCAnUGFyc2VFcnJvclN0ZXAnLCBqb2JzVGFibGUsIHRydWUpO1xuXG4gIC8vIEluaXRpYWxpemUgc3RlcHM6IExvYWQgd29ya2Zsb3cgYW5kIGdldCBzdGVwIGNvdW50XG4gIGNvbnN0IGluaXRpYWxpemVTdGVwcyA9IG5ldyB0YXNrcy5EeW5hbW9HZXRJdGVtKHNjb3BlLCAnSW5pdGlhbGl6ZVN0ZXBzJywge1xuICAgIHRhYmxlOiB3b3JrZmxvd3NUYWJsZSxcbiAgICBrZXk6IHtcbiAgICAgIHdvcmtmbG93X2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC53b3JrZmxvd19pZCcpKSxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckLndvcmtmbG93RGF0YScsXG4gIH0pO1xuXG4gIC8vIFByb2Nlc3MgYSBzaW5nbGUgc3RlcCB1c2luZyBMYW1iZGEgZnVuY3Rpb24gKGRlY2xhcmVkIGVhcmx5IGZvciB1c2UgaW4gc2V0dXBTdGVwTG9vcClcbiAgY29uc3QgcHJvY2Vzc1N0ZXAgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHNjb3BlLCAnUHJvY2Vzc1N0ZXAnLCB7XG4gICAgbGFtYmRhRnVuY3Rpb246IGpvYlByb2Nlc3NvckxhbWJkYSxcbiAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgJ2pvYl9pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgICdzdGVwX2luZGV4Jzogc2ZuLkpzb25QYXRoLm51bWJlckF0KCckLnN0ZXBfaW5kZXgnKSxcbiAgICAgICdzdGVwX3R5cGUnOiAnd29ya2Zsb3dfc3RlcCcsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQucHJvY2Vzc1Jlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBMYW1iZGEgZmFpbHVyZXNcbiAgcHJvY2Vzc1N0ZXAuYWRkQ2F0Y2gocGFyc2VFcnJvclN0ZXAsIHtcbiAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgZXJyb3JzOiBbJ1N0YXRlcy5BTEwnXSxcbiAgfSk7XG5cbiAgLy8gUHJvY2VzcyBIVE1MIGdlbmVyYXRpb24gc3RlcFxuICBjb25zdCBwcm9jZXNzSHRtbEdlbmVyYXRpb24gPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHNjb3BlLCAnUHJvY2Vzc0h0bWxHZW5lcmF0aW9uJywge1xuICAgIGxhbWJkYUZ1bmN0aW9uOiBqb2JQcm9jZXNzb3JMYW1iZGEsXG4gICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICdqb2JfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJyksXG4gICAgICAnc3RlcF90eXBlJzogJ2h0bWxfZ2VuZXJhdGlvbicsXG4gICAgfSksXG4gICAgcmVzdWx0UGF0aDogJyQuaHRtbFJlc3VsdCcsXG4gICAgcmV0cnlPblNlcnZpY2VFeGNlcHRpb25zOiBmYWxzZSxcbiAgfSk7XG5cbiAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBIVE1MIGdlbmVyYXRpb24gZmFpbHVyZXNcbiAgLy8gTm90ZTogVXNlIHBhcnNlRXJyb3JMZWdhY3kgKG5vdCBwYXJzZUVycm9yU3RlcCkgYmVjYXVzZSBIVE1MIGdlbmVyYXRpb25cbiAgLy8gcnVucyBhZnRlciBhbGwgd29ya2Zsb3cgc3RlcHMgYXJlIGNvbXBsZXRlLCBzbyBzdGVwX2luZGV4IGlzIG5vdCBpbiBjb250ZXh0XG4gIHByb2Nlc3NIdG1sR2VuZXJhdGlvbi5hZGRDYXRjaChwYXJzZUVycm9yTGVnYWN5LCB7XG4gICAgcmVzdWx0UGF0aDogJyQuZXJyb3InLFxuICAgIGVycm9yczogWydTdGF0ZXMuQUxMJ10sXG4gIH0pO1xuXG4gIC8vIENyZWF0ZSByZXVzYWJsZSBmaW5hbGl6ZSBqb2IgdGFzayB1c2luZyBoZWxwZXJcbiAgY29uc3QgZmluYWxpemVKb2IgPSBjcmVhdGVKb2JGaW5hbGl6ZXIoc2NvcGUsICdGaW5hbGl6ZUpvYicsIGpvYnNUYWJsZSk7XG5cbiAgLy8gQ2hlY2sgSFRNTCBnZW5lcmF0aW9uIHJlc3VsdFxuICBjb25zdCBjaGVja0h0bWxSZXN1bHQgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrSHRtbFJlc3VsdCcpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQuaHRtbFJlc3VsdC5QYXlsb2FkLnN1Y2Nlc3MnLCBmYWxzZSksXG4gICAgICBoYW5kbGVIdG1sR2VuZXJhdGlvbkZhaWx1cmVcbiAgICApXG4gICAgLm90aGVyd2lzZShmaW5hbGl6ZUpvYik7XG5cbiAgLy8gQ2hlY2sgaWYgbW9yZSBzdGVwcyByZW1haW4gLSBsb29wcyBiYWNrIHRvIHByb2Nlc3NTdGVwIGlmIG1vcmUgc3RlcHMgKGRlY2xhcmVkIGJlZm9yZSBpbmNyZW1lbnRTdGVwKVxuICBjb25zdCBjaGVja01vcmVTdGVwcyA9IG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tNb3JlU3RlcHMnKVxuICAgIC53aGVuKFxuICAgICAgc2ZuLkNvbmRpdGlvbi5udW1iZXJMZXNzVGhhbkpzb25QYXRoKCckLnN0ZXBfaW5kZXgnLCAnJC50b3RhbF9zdGVwcycpLFxuICAgICAgcHJvY2Vzc1N0ZXAgIC8vIExvb3AgYmFjayB0byBwcm9jZXNzIG5leHQgc3RlcFxuICAgIClcbiAgICAub3RoZXJ3aXNlKFxuICAgICAgLy8gQWxsIHdvcmtmbG93IHN0ZXBzIGNvbXBsZXRlIC0gY2hlY2sgaWYgSFRNTCBnZW5lcmF0aW9uIGlzIG5lZWRlZFxuICAgICAgbmV3IHNmbi5DaG9pY2Uoc2NvcGUsICdDaGVja0lmSHRtbE5lZWRlZCcpXG4gICAgICAgIC53aGVuKFxuICAgICAgICAgIHNmbi5Db25kaXRpb24uYm9vbGVhbkVxdWFscygnJC5oYXNfdGVtcGxhdGUnLCB0cnVlKSxcbiAgICAgICAgICBwcm9jZXNzSHRtbEdlbmVyYXRpb24ubmV4dChjaGVja0h0bWxSZXN1bHQpXG4gICAgICAgIClcbiAgICAgICAgLm90aGVyd2lzZShmaW5hbGl6ZUpvYilcbiAgICApO1xuXG4gIC8vIENoZWNrIGlmIHN0ZXAgc3VjY2VlZGVkIC0gY29ubmVjdHMgdG8gaW5jcmVtZW50U3RlcCB3aGljaCBjb25uZWN0cyB0byBjaGVja01vcmVTdGVwc1xuICBjb25zdCBpbmNyZW1lbnRTdGVwID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnSW5jcmVtZW50U3RlcCcsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3N0ZXBfaW5kZXguJCc6ICdTdGF0ZXMuTWF0aEFkZCgkLnN0ZXBfaW5kZXgsIDEpJyxcbiAgICAgICd0b3RhbF9zdGVwcy4kJzogJyQudG90YWxfc3RlcHMnLFxuICAgICAgJ2hhc190ZW1wbGF0ZS4kJzogJyQuaGFzX3RlbXBsYXRlJyxcbiAgICAgICd0ZW1wbGF0ZV9pZC4kJzogJyQudGVtcGxhdGVfaWQnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrTW9yZVN0ZXBzKTtcblxuICBjb25zdCBjaGVja1N0ZXBSZXN1bHQgPSBuZXcgc2ZuLkNob2ljZShzY29wZSwgJ0NoZWNrU3RlcFJlc3VsdCcpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQucHJvY2Vzc1Jlc3VsdC5QYXlsb2FkLnN1Y2Nlc3MnLCBmYWxzZSksXG4gICAgICBoYW5kbGVTdGVwRmFpbHVyZVxuICAgIClcbiAgICAub3RoZXJ3aXNlKGluY3JlbWVudFN0ZXApO1xuXG4gIC8vIFJlc29sdmUgc3RlcCBkZXBlbmRlbmNpZXMgLSBjYWxscyBMYW1iZGEgdG8gYnVpbGQgZXhlY3V0aW9uIHBsYW5cbiAgY29uc3QgcmVzb2x2ZURlcGVuZGVuY2llcyA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2Uoc2NvcGUsICdSZXNvbHZlRGVwZW5kZW5jaWVzJywge1xuICAgIGxhbWJkYUZ1bmN0aW9uOiBqb2JQcm9jZXNzb3JMYW1iZGEsXG4gICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICdqb2JfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJyksXG4gICAgICAnd29ya2Zsb3dfaWQnOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQud29ya2Zsb3dfaWQnKSxcbiAgICAgICdhY3Rpb24nOiAncmVzb2x2ZV9kZXBlbmRlbmNpZXMnLFxuICAgIH0pLFxuICAgIHJlc3VsdFBhdGg6ICckLmV4ZWN1dGlvblBsYW4nLFxuICAgIHJldHJ5T25TZXJ2aWNlRXhjZXB0aW9uczogZmFsc2UsXG4gIH0pO1xuXG4gIC8vIFNldHVwIHN0ZXAgbG9vcCBmb3IgbXVsdGktc3RlcCB3b3JrZmxvd3NcbiAgY29uc3Qgc2V0dXBTdGVwTG9vcCA9IG5ldyBzZm4uUGFzcyhzY29wZSwgJ1NldHVwU3RlcExvb3AnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICdzdGVwX2luZGV4JzogMCxcbiAgICAgICd0b3RhbF9zdGVwcy4kJzogJyQuc3RlcHNfbGVuZ3RoJyxcbiAgICAgICdoYXNfdGVtcGxhdGUuJCc6ICckLmhhc190ZW1wbGF0ZScsXG4gICAgICAndGVtcGxhdGVfaWQuJCc6ICckLnRlbXBsYXRlX2lkJyxcbiAgICAgICdleGVjdXRpb25fcGxhbi4kJzogJyQuZXhlY3V0aW9uUGxhbi5QYXlsb2FkJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChwcm9jZXNzU3RlcCkubmV4dChjaGVja1N0ZXBSZXN1bHQpO1xuXG4gIC8vIEFsbCB3b3JrZmxvd3MgbXVzdCB1c2Ugc3RlcHMgZm9ybWF0IC0gcm91dGUgZGlyZWN0bHkgdG8gZGVwZW5kZW5jeSByZXNvbHV0aW9uXG4gIC8vIElmIHdvcmtmbG93IGhhcyBubyBzdGVwcywgdGhlIExhbWJkYSB3aWxsIHRocm93IGFuIGVycm9yXG4gIGNvbnN0IGNoZWNrV29ya2Zsb3dUeXBlID0gcmVzb2x2ZURlcGVuZGVuY2llcy5uZXh0KHNldHVwU3RlcExvb3ApO1xuXG4gIC8vIFNldCBoYXNfdGVtcGxhdGUgdG8gdHJ1ZSB3aGVuIHRlbXBsYXRlIGV4aXN0c1xuICBjb25zdCBzZXRIYXNUZW1wbGF0ZVRydWUgPSBuZXcgc2ZuLlBhc3Moc2NvcGUsICdTZXRIYXNUZW1wbGF0ZVRydWUnLCB7XG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgJ2pvYl9pZC4kJzogJyQuam9iX2lkJyxcbiAgICAgICd3b3JrZmxvd19pZC4kJzogJyQud29ya2Zsb3dfaWQnLFxuICAgICAgJ3N1Ym1pc3Npb25faWQuJCc6ICckLnN1Ym1pc3Npb25faWQnLFxuICAgICAgJ3RlbmFudF9pZC4kJzogJyQudGVuYW50X2lkJyxcbiAgICAgICd3b3JrZmxvd0RhdGEuJCc6ICckLndvcmtmbG93RGF0YScsXG4gICAgICAnc3RlcHNfbGVuZ3RoLiQnOiAnJC5zdGVwc19sZW5ndGgnLFxuICAgICAgJ2hhc190ZW1wbGF0ZSc6IHRydWUsXG4gICAgICAndGVtcGxhdGVfaWQuJCc6ICckLndvcmtmbG93RGF0YS5JdGVtLnRlbXBsYXRlX2lkLlMnLFxuICAgIH0sXG4gICAgcmVzdWx0UGF0aDogJyQnLFxuICB9KS5uZXh0KGNoZWNrV29ya2Zsb3dUeXBlKTtcblxuICAvLyBTZXQgaGFzX3RlbXBsYXRlIHRvIGZhbHNlIHdoZW4gdGVtcGxhdGUgZG9lc24ndCBleGlzdFxuICBjb25zdCBzZXRIYXNUZW1wbGF0ZUZhbHNlID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnU2V0SGFzVGVtcGxhdGVGYWxzZScsIHtcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAnam9iX2lkLiQnOiAnJC5qb2JfaWQnLFxuICAgICAgJ3dvcmtmbG93X2lkLiQnOiAnJC53b3JrZmxvd19pZCcsXG4gICAgICAnc3VibWlzc2lvbl9pZC4kJzogJyQuc3VibWlzc2lvbl9pZCcsXG4gICAgICAndGVuYW50X2lkLiQnOiAnJC50ZW5hbnRfaWQnLFxuICAgICAgJ3dvcmtmbG93RGF0YS4kJzogJyQud29ya2Zsb3dEYXRhJyxcbiAgICAgICdzdGVwc19sZW5ndGguJCc6ICckLnN0ZXBzX2xlbmd0aCcsXG4gICAgICAnaGFzX3RlbXBsYXRlJzogZmFsc2UsXG4gICAgICAndGVtcGxhdGVfaWQnOiAnJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChjaGVja1dvcmtmbG93VHlwZSk7XG5cbiAgLy8gQ2hlY2sgaWYgdGVtcGxhdGUgZXhpc3RzIGFuZCBzZXQgaGFzX3RlbXBsYXRlIGJvb2xlYW5cbiAgY29uc3QgY2hlY2tUZW1wbGF0ZUV4aXN0cyA9IG5ldyBzZm4uQ2hvaWNlKHNjb3BlLCAnQ2hlY2tUZW1wbGF0ZUV4aXN0cycpXG4gICAgLndoZW4oXG4gICAgICBzZm4uQ29uZGl0aW9uLmlzUHJlc2VudCgnJC53b3JrZmxvd0RhdGEuSXRlbS50ZW1wbGF0ZV9pZC5TJyksXG4gICAgICBzZXRIYXNUZW1wbGF0ZVRydWVcbiAgICApXG4gICAgLm90aGVyd2lzZShzZXRIYXNUZW1wbGF0ZUZhbHNlKTtcblxuICAvLyBDb21wdXRlIHN0ZXBzIGxlbmd0aCAtIGhhbmRsZSBib3RoIG5ldyAod2l0aCBzdGVwcykgYW5kIGxlZ2FjeSAod2l0aG91dCBzdGVwcykgd29ya2Zsb3dzXG4gIC8vIEFsbCB3b3JrZmxvd3MgbXVzdCBoYXZlIHN0ZXBzIC0gY29tcHV0ZSBzdGVwcyBsZW5ndGggZGlyZWN0bHlcbiAgY29uc3QgY29tcHV0ZVN0ZXBzTGVuZ3RoID0gbmV3IHNmbi5QYXNzKHNjb3BlLCAnQ29tcHV0ZVN0ZXBzTGVuZ3RoJywge1xuICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICdqb2JfaWQuJCc6ICckLmpvYl9pZCcsXG4gICAgICAnd29ya2Zsb3dfaWQuJCc6ICckLndvcmtmbG93X2lkJyxcbiAgICAgICdzdWJtaXNzaW9uX2lkLiQnOiAnJC5zdWJtaXNzaW9uX2lkJyxcbiAgICAgICd0ZW5hbnRfaWQuJCc6ICckLnRlbmFudF9pZCcsXG4gICAgICAnd29ya2Zsb3dEYXRhLiQnOiAnJC53b3JrZmxvd0RhdGEnLFxuICAgICAgJ3N0ZXBzX2xlbmd0aC4kJzogJ1N0YXRlcy5BcnJheUxlbmd0aCgkLndvcmtmbG93RGF0YS5JdGVtLnN0ZXBzLkwpJyxcbiAgICB9LFxuICAgIHJlc3VsdFBhdGg6ICckJyxcbiAgfSkubmV4dChjaGVja1RlbXBsYXRlRXhpc3RzKTtcblxuICAvLyBEZWZpbmUgd29ya2Zsb3c6IFVwZGF0ZSBzdGF0dXMgLT4gSW5pdGlhbGl6ZSBzdGVwcyAtPiBDb21wdXRlIHN0ZXBzIGxlbmd0aCAtPiBDaGVjayB0ZW1wbGF0ZSAtPiBQcm9jZXNzIHN0ZXBzXG4gIC8vIEFsbCB3b3JrZmxvd3MgbXVzdCB1c2Ugc3RlcHMgZm9ybWF0IC0gbGVnYWN5IGZvcm1hdCBpcyBubyBsb25nZXIgc3VwcG9ydGVkXG4gIHJldHVybiB1cGRhdGVKb2JTdGF0dXNcbiAgICAubmV4dChpbml0aWFsaXplU3RlcHMpXG4gICAgLm5leHQoY29tcHV0ZVN0ZXBzTGVuZ3RoKTtcbn1cblxuIl19