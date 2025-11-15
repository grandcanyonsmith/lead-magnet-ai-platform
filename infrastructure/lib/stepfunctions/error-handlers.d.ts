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
export declare function createJobFailureHandler(scope: Construct, id: string, jobsTable: dynamodb.ITable, errorPath: string, errorTypePath?: string, jobIdPath?: string): tasks.DynamoUpdateItem;
/**
 * Creates a Pass state that parses Lambda error information
 *
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the pass state
 * @param includeStepIndex - Whether to include step_index in the parsed error
 * @returns Pass state that parses error information
 */
export declare function createErrorParser(scope: Construct, id: string, includeStepIndex?: boolean): sfn.Pass;
/**
 * Creates a complete error handler chain: parse error -> handle exception
 *
 * @param scope - CDK construct scope
 * @param id - Base identifier for the error handler chain
 * @param jobsTable - DynamoDB table for jobs
 * @param includeStepIndex - Whether to include step_index in error parsing
 * @returns Chain of states: parse error -> handle exception
 */
export declare function createExceptionHandlerChain(scope: Construct, id: string, jobsTable: dynamodb.ITable, includeStepIndex?: boolean): sfn.IChainable;
/**
 * Creates a handler for workflow step failures (business logic failures)
 *
 * @param scope - CDK construct scope
 * @param jobsTable - DynamoDB table for jobs
 * @returns DynamoDB update task for step failures
 */
export declare function createStepFailureHandler(scope: Construct, jobsTable: dynamodb.ITable): tasks.DynamoUpdateItem;
/**
 * Creates a handler for HTML generation failures
 *
 * @param scope - CDK construct scope
 * @param jobsTable - DynamoDB table for jobs
 * @returns DynamoDB update task for HTML generation failures
 */
export declare function createHtmlGenerationFailureHandler(scope: Construct, jobsTable: dynamodb.ITable): tasks.DynamoUpdateItem;
/**
 * Creates a DynamoDB update task to finalize a job as completed
 *
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the task
 * @param jobsTable - DynamoDB table for jobs
 * @returns DynamoDB update task that marks job as completed
 */
export declare function createJobFinalizer(scope: Construct, id: string, jobsTable: dynamodb.ITable): tasks.DynamoUpdateItem;
