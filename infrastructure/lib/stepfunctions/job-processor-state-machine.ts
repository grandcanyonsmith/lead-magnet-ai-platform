import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export interface JobProcessorStateMachineProps {
  jobsTable: dynamodb.ITable;
  workflowsTable: dynamodb.ITable;
  jobProcessorLambda: lambda.Function;
}

/**
 * Creates the Step Functions state machine definition for job processing
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
      'error_message': sfn.JsonPath.format(
        'Lambda execution failed: {} - {}',
        sfn.JsonPath.stringAt('$.error.Error'),
        sfn.JsonPath.stringAt('$.error.Cause')
      ),
    },
    resultPath: '$.parsedError',
  }).next(handleStepException);

  const parseErrorStep = new sfn.Pass(scope, 'ParseErrorStep', {
    parameters: {
      'job_id.$': '$.job_id',
      'step_index.$': '$.step_index',
      'error_message': sfn.JsonPath.format(
        'Lambda execution failed: {} - {}',
        sfn.JsonPath.stringAt('$.error.Error'),
        sfn.JsonPath.stringAt('$.error.Cause')
      ),
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
    .when(
      sfn.Condition.numberLessThanJsonPath('$.step_index', '$.total_steps'),
      processStep  // Loop back to process next step
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
      })
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
    .next(
      new sfn.Choice(scope, 'CheckLegacyResult')
        .when(
          sfn.Condition.booleanEquals('$.processResult.Payload.success', false),
          handleStepFailure
        )
        .otherwise(
          new tasks.DynamoUpdateItem(scope, 'FinalizeLegacyJob', {
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
          })
        )
    );

  // Check workflow type and route accordingly (defined after processLegacyJob and setupStepLoop)
  const checkWorkflowType = new sfn.Choice(scope, 'CheckWorkflowType')
    .when(
      sfn.Condition.or(
        sfn.Condition.isNotPresent('$.workflowData.Item.steps'),
        sfn.Condition.numberEquals('$.steps_length', 0)
      ),
      processLegacyJob
    )
    .otherwise(setupStepLoop);

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
    .when(
      sfn.Condition.isPresent('$.workflowData.Item.steps'),
      computeStepsLengthWithSteps
    )
    .otherwise(computeStepsLengthLegacy);

  // Define workflow: Update status -> Initialize steps -> Compute steps length -> Check template -> Check workflow type -> Process accordingly
  // Note: computeStepsLength internally connects to checkTemplateExists
  return updateJobStatus
    .next(initializeSteps)
    .next(computeStepsLength);
}

