import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import {
  createStepFailureHandler,
  createHtmlGenerationFailureHandler,
  createExceptionHandlerChain,
  createJobFinalizer,
} from './error-handlers';

export interface JobProcessorStateMachineProps {
  jobsTable: dynamodb.ITable;
  workflowsTable: dynamodb.ITable;
  jobProcessorLambda: lambda.IFunction;
}

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
export function createJobProcessorStateMachine(
  scope: Construct,
  props: JobProcessorStateMachineProps
): sfn.IChainable {
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
  const handleStepFailure = createStepFailureHandler(scope, jobsTable);
  const handleHtmlGenerationFailure = createHtmlGenerationFailureHandler(scope, jobsTable);
  const parseErrorLegacy = createExceptionHandlerChain(scope, 'ParseErrorLegacy', jobsTable, false);
  const parseErrorStep = createExceptionHandlerChain(scope, 'ParseErrorStep', jobsTable, true);

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
  const finalizeJob = createJobFinalizer(scope, 'FinalizeJob', jobsTable);

  // Check HTML generation result
  const checkHtmlResult = new sfn.Choice(scope, 'CheckHtmlResult')
    .when(
      sfn.Condition.booleanEquals('$.htmlResult.Payload.success', false),
      handleHtmlGenerationFailure
    )
    .otherwise(finalizeJob);

  // Check if more steps remain - loops back to processStep if more steps (declared before incrementStep)
  const checkMoreSteps = new sfn.Choice(scope, 'CheckMoreSteps')
    .when(
      sfn.Condition.numberLessThanJsonPath('$.step_index', '$.total_steps'),
      processStep  // Loop back to process next step
    )
    .otherwise(
      // All workflow steps complete - check if HTML generation is needed
      new sfn.Choice(scope, 'CheckIfHtmlNeeded')
        .when(
          sfn.Condition.booleanEquals('$.has_template', true),
          processHtmlGeneration.next(checkHtmlResult)
        )
        .otherwise(finalizeJob)
    );

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
    .when(
      sfn.Condition.booleanEquals('$.processResult.Payload.success', false),
      handleStepFailure
    )
    .otherwise(incrementStep);

  // Check step result for single-step rerun (goes directly to finalizeJob instead of incrementing)
  const checkStepResultSingleStep = new sfn.Choice(scope, 'CheckStepResultSingleStep')
    .when(
      sfn.Condition.booleanEquals('$.processResult.Payload.success', false),
      handleStepFailure
    )
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
    .when(
      sfn.Condition.isPresent('$.workflowData.Item.template_id.S'),
      setHasTemplateTrue
    )
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
    .when(
      sfn.Condition.numberLessThanJsonPath('$.step_index', '$.total_steps'),
      processStepContinue.next(checkStepResult)  // Continue with next step, then incrementStep will handle the loop
    )
    .otherwise(
      // All steps complete - check if HTML generation is needed
      new sfn.Choice(scope, 'CheckIfHtmlNeededAfterRerun')
        .when(
          sfn.Condition.booleanEquals('$.has_template', true),
          processHtmlGenerationContinue.next(checkHtmlResult)
        )
        .otherwise(finalizeJob)
    );

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
    .when(
      sfn.Condition.isPresent('$.workflowData.Item.template_id.S'),
      setHasTemplateTrueContinue
    )
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

  // Check step result for single-step rerun with continue option
  const checkStepResultSingleStepContinue = new sfn.Choice(scope, 'CheckStepResultSingleStepContinue')
    .when(
      sfn.Condition.booleanEquals('$.processResult.Payload.success', false),
      handleStepFailure
    )
    .otherwise(
      // Step succeeded - check if we should continue
      new sfn.Choice(scope, 'CheckContinueAfterRerun')
        .when(
          sfn.Condition.booleanEquals('$.continue_after', true),
          // Load workflow data and continue with remaining steps
          loadWorkflowForContinue.next(setupContinuePath)
        )
        .otherwise(finalizeJob)  // Just finalize if not continuing
    );

  // Check if this is a single-step rerun (action === 'process_single_step' or 'process_single_step_and_continue')
  // If yes, route directly to processStepSingle with the provided step_index
  // If no, continue with normal workflow initialization flow
  const checkAction = new sfn.Choice(scope, 'CheckAction')
    .when(
      sfn.Condition.or(
        sfn.Condition.stringEquals('$.action', 'process_single_step'),
        sfn.Condition.stringEquals('$.action', 'process_single_step_and_continue')
      ),
      // Single-step rerun path: processStepSingle -> checkStepResultSingleStepContinue
      processStepSingle.next(checkStepResultSingleStepContinue)
    )
    .otherwise(
      // Normal workflow path: initializeSteps -> computeStepsLength -> ...
      initializeSteps.next(computeStepsLength)
    );

  // Define workflow: Update status -> Check action -> Route accordingly
  // All workflows must use steps format - legacy format is no longer supported
  return updateJobStatus.next(checkAction);
}

