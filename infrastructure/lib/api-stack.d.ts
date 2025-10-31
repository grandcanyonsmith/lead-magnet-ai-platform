import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
export interface ApiStackProps extends cdk.StackProps {
    userPool: cognito.UserPool;
    userPoolClient: cognito.UserPoolClient;
    tablesMap: Record<string, dynamodb.Table>;
    stateMachineArn: string;
    artifactsBucket: s3.Bucket;
}
export declare class ApiStack extends cdk.Stack {
    readonly api: apigateway.HttpApi;
    readonly apiFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: ApiStackProps);
}
