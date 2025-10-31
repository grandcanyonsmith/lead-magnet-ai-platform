import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
export interface ComputeStackProps extends cdk.StackProps {
    tablesMap: Record<string, dynamodb.Table>;
    artifactsBucket: s3.Bucket;
    taskDefinitionArn?: string;
}
export declare class ComputeStack extends cdk.Stack {
    readonly stateMachine: sfn.StateMachine;
    readonly stateMachineArn: string;
    readonly cluster: ecs.Cluster;
    constructor(scope: Construct, id: string, props: ComputeStackProps);
}
