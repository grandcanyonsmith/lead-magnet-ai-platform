import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

/**
 * Options for creating error handlers
 */
export interface ErrorHandlerOptions {
  /** DynamoDB table for jobs */
  jobsTable: dynamodb.ITable;
  /** Scope for creating constructs */
  scope: Construct;
}

/**
 * Creates a DynamoDB update task to mark a job as failed
 * 
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the task
 * @param jobsTable - DynamoDB table for jobs
 * @param errorPath - JSONPath to the error message in the state
 * @param errorTypePath - Optional JSONPath to the error type
 * @param jobIdPath - JSONPath to the job_id (defaults to '$.job_id')
 * @returns DynamoDB update task that marks job as failed
 */
export function createJobFailureHandler(
  scope: Construct,
  id: string,
  jobsTable: dynamodb.ITable,
  errorPath: string,
  errorTypePath?: string,
  jobIdPath: string = '$.job_id'
): tasks.DynamoUpdateItem {
  const expressionAttributeValues: Record<string, tasks.DynamoAttributeValue> = {
    ':status': tasks.DynamoAttributeValue.fromString('failed'),
    ':error': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt(errorPath)),
    ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
  };

  let updateExpression = 'SET #status = :status, error_message = :error, updated_at = :updated_at';

  if (errorTypePath) {
    expressionAttributeValues[':error_type'] = tasks.DynamoAttributeValue.fromString(
      sfn.JsonPath.stringAt(errorTypePath)
    );
    updateExpression += ', error_type = :error_type';
  }

  return new tasks.DynamoUpdateItem(scope, id, {
    table: jobsTable,
    key: {
      job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt(jobIdPath)),
    },
    updateExpression,
    expressionAttributeNames: {
      '#status': 'status',
    },
    expressionAttributeValues,
  });
}

/**
 * Creates a Pass state that parses Lambda error information
 * 
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the pass state
 * @param includeStepIndex - Whether to include step_index in the parsed error
 * @returns Pass state that parses error information
 */
export function createErrorParser(
  scope: Construct,
  id: string,
  includeStepIndex: boolean = false
): sfn.Pass {
  const parameters: Record<string, any> = {
    'job_id.$': '$.job_id',
    'error_message': sfn.JsonPath.format(
      'Lambda execution failed: {} - {}',
      sfn.JsonPath.stringAt('$.error.Error'),
      sfn.JsonPath.stringAt('$.error.Cause')
    ),
  };

  if (includeStepIndex) {
    parameters['step_index.$'] = '$.step_index';
  }

  return new sfn.Pass(scope, id, {
    parameters,
    resultPath: '$.parsedError',
  });
}

/**
 * Creates a complete error handler chain: parse error -> handle exception
 * 
 * @param scope - CDK construct scope
 * @param id - Base identifier for the error handler chain
 * @param jobsTable - DynamoDB table for jobs
 * @param includeStepIndex - Whether to include step_index in error parsing
 * @returns Chain of states: parse error -> handle exception
 */
export function createExceptionHandlerChain(
  scope: Construct,
  id: string,
  jobsTable: dynamodb.ITable,
  includeStepIndex: boolean = false
): sfn.IChainable {
  const parseError = createErrorParser(scope, `${id}ParseError`, includeStepIndex);
  const handleException = createJobFailureHandler(
    scope,
    `${id}HandleException`,
    jobsTable,
    '$.parsedError.error_message',
    undefined,
    '$.parsedError.job_id'
  );

  return parseError.next(handleException);
}

/**
 * Creates a handler for workflow step failures (business logic failures)
 * 
 * @param scope - CDK construct scope
 * @param jobsTable - DynamoDB table for jobs
 * @returns DynamoDB update task for step failures
 */
export function createStepFailureHandler(
  scope: Construct,
  jobsTable: dynamodb.ITable
): tasks.DynamoUpdateItem {
  return createJobFailureHandler(
    scope,
    'HandleStepFailure',
    jobsTable,
    '$.processResult.Payload.error',
    '$.processResult.Payload.error_type'
  );
}

/**
 * Creates a handler for HTML generation failures
 * 
 * @param scope - CDK construct scope
 * @param jobsTable - DynamoDB table for jobs
 * @returns DynamoDB update task for HTML generation failures
 */
export function createHtmlGenerationFailureHandler(
  scope: Construct,
  jobsTable: dynamodb.ITable
): tasks.DynamoUpdateItem {
  return createJobFailureHandler(
    scope,
    'HandleHtmlGenerationFailure',
    jobsTable,
    '$.htmlResult.Payload.error',
    '$.htmlResult.Payload.error_type'
  );
}

/**
 * Creates a DynamoDB update task to finalize a job as completed
 * 
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the task
 * @param jobsTable - DynamoDB table for jobs
 * @returns DynamoDB update task that marks job as completed
 */
export function createJobFinalizer(
  scope: Construct,
  id: string,
  jobsTable: dynamodb.ITable
): tasks.DynamoUpdateItem {
  return new tasks.DynamoUpdateItem(scope, id, {
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
}

