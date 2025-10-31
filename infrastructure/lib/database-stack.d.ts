import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export declare class DatabaseStack extends cdk.Stack {
    readonly tablesMap: Record<string, dynamodb.Table>;
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
