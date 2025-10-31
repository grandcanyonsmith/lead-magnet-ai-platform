import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
export interface WorkerStackProps extends cdk.StackProps {
    cluster: ecs.Cluster;
    tablesMap: Record<string, dynamodb.Table>;
    artifactsBucket: s3.Bucket;
}
export declare class WorkerStack extends cdk.Stack {
    readonly taskDefinition: ecs.FargateTaskDefinition;
    readonly ecrRepository: ecr.Repository;
    constructor(scope: Construct, id: string, props: WorkerStackProps);
}
