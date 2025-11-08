import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { TableMap } from '../types';
/**
 * Creates a Lambda execution role with standard policies
 */
export declare function createLambdaRole(scope: Construct, id: string, options?: {
    includeXRay?: boolean;
}): iam.Role;
/**
 * Grants DynamoDB permissions to a role or function
 */
export declare function grantDynamoDBPermissions(grantable: iam.IGrantable, tablesMap: TableMap): void;
/**
 * Grants S3 permissions to a role or function
 */
export declare function grantS3Permissions(grantable: iam.IGrantable, bucket: s3.Bucket): void;
/**
 * Grants Secrets Manager access to a role or function
 */
export declare function grantSecretsAccess(grantable: iam.IGrantable, scope: Construct, secretNames: string[]): void;
/**
 * Creates a Lambda function with DynamoDB tables, S3 bucket, and environment variables configured
 */
export interface CreateLambdaWithTablesOptions {
    runtime: lambda.Runtime;
    handler: string;
    code: lambda.Code;
    timeout?: cdk.Duration;
    memorySize?: number;
    environment?: Record<string, string>;
    logRetention?: logs.RetentionDays;
    tracing?: lambda.Tracing;
    role?: iam.Role;
    logGroup?: logs.LogGroup;
}
export declare function createLambdaWithTables(scope: Construct, id: string, tablesMap: TableMap, artifactsBucket: s3.Bucket, options: CreateLambdaWithTablesOptions): lambda.Function;
