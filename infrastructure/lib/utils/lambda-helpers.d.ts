import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { TableMap } from '../types';
/**
 * Options for creating a Lambda execution role
 */
export interface LambdaRoleOptions {
    /** Enable X-Ray tracing */
    includeXRay?: boolean;
    /** Additional managed policies to attach */
    additionalPolicies?: iam.IManagedPolicy[];
    /** Additional inline policies */
    inlinePolicies?: Record<string, iam.PolicyDocument>;
}
/**
 * Creates a Lambda execution role with standard policies
 *
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the role
 * @param options - Optional configuration for the role
 * @returns IAM role configured for Lambda execution
 */
export declare function createLambdaRole(scope: Construct, id: string, options?: LambdaRoleOptions): iam.Role;
/**
 * Grants DynamoDB permissions to a role or function
 *
 * @param grantable - IAM grantable (role or function) to grant permissions to
 * @param tablesMap - Map of table keys to DynamoDB table references
 * @throws Error if tablesMap is empty or invalid
 */
export declare function grantDynamoDBPermissions(grantable: iam.IGrantable, tablesMap: TableMap): void;
/**
 * Grants S3 permissions to a role or function
 *
 * @param grantable - IAM grantable (role or function) to grant permissions to
 * @param bucket - S3 bucket to grant access to
 * @throws Error if bucket is null or undefined
 */
export declare function grantS3Permissions(grantable: iam.IGrantable, bucket: s3.Bucket): void;
/**
 * Grants Secrets Manager access to a role or function
 *
 * @param grantable - IAM grantable (role or function) to grant permissions to
 * @param scope - CDK construct scope (for account/region access)
 * @param secretNames - Array of secret names to grant access to
 * @throws Error if secretNames is empty or contains invalid names
 */
export declare function grantSecretsAccess(grantable: iam.IGrantable, scope: Construct & {
    account: string;
    region: string;
}, secretNames: string[]): void;
/**
 * Grants access to commonly used secrets (OpenAI, Twilio)
 *
 * @param grantable - IAM grantable to grant permissions to
 * @param scope - CDK construct scope
 */
export declare function grantCommonSecretsAccess(grantable: iam.IGrantable, scope: Construct & {
    account: string;
    region: string;
}): void;
/**
 * Options for creating a Lambda function with tables and bucket access
 */
export interface CreateLambdaWithTablesOptions {
    /** Runtime (optional for container images) */
    runtime?: lambda.Runtime;
    /** Handler (optional for container images) */
    handler?: string;
    /** Lambda code (zip or container image)
     * - For zip deployment: use lambda.Code (e.g., Code.fromAsset)
     * - For container images: use lambda.DockerImageCode (e.g., DockerImageCode.fromEcr)
     */
    code: lambda.Code | lambda.DockerImageCode;
    /** Timeout duration */
    timeout?: cdk.Duration;
    /** Memory size in MB */
    memorySize?: number;
    /** Additional environment variables */
    environment?: Record<string, string>;
    /** Log retention period */
    logRetention?: logs.RetentionDays;
    /** X-Ray tracing */
    tracing?: lambda.Tracing;
    /** Custom IAM role (created if not provided) */
    role?: iam.Role;
    /** Custom log group (created if not provided) */
    logGroup?: logs.LogGroup;
    /** Function name */
    functionName?: string;
    /** Dead Letter Queue for asynchronous failures */
    deadLetterQueue?: sqs.IQueue;
}
/**
 * Creates a Lambda function with DynamoDB tables, S3 bucket, and environment variables configured
 *
 * Automatically grants necessary permissions and sets up environment variables.
 * Supports both zip-based and container image deployments.
 *
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the function
 * @param tablesMap - Map of table keys to DynamoDB table references
 * @param artifactsBucket - S3 bucket for artifacts
 * @param options - Lambda function configuration options
 * @returns Lambda function instance
 * @throws Error if required parameters are missing or invalid
 */
export declare function createLambdaWithTables(scope: Construct, id: string, tablesMap: TableMap, artifactsBucket: s3.Bucket, options: CreateLambdaWithTablesOptions): lambda.IFunction;
