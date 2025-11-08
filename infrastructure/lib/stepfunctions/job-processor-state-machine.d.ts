import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
export interface JobProcessorStateMachineProps {
    jobsTable: dynamodb.ITable;
    workflowsTable: dynamodb.ITable;
    jobProcessorLambda: lambda.Function;
}
/**
 * Creates the Step Functions state machine definition for job processing
 */
export declare function createJobProcessorStateMachine(scope: Construct, props: JobProcessorStateMachineProps): sfn.IChainable;
