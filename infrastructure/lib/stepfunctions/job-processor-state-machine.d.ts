import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
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
export declare function createJobProcessorStateMachine(scope: Construct, props: JobProcessorStateMachineProps): sfn.IChainable;
