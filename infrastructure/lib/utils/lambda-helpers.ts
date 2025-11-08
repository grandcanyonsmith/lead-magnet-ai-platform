import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { TableMap } from '../types';
import { createTableEnvironmentVars } from './environment-helpers';

/**
 * Creates a Lambda execution role with standard policies
 */
export function createLambdaRole(
  scope: Construct,
  id: string,
  options?: {
    includeXRay?: boolean;
  }
): iam.Role {
  const managedPolicies = [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
  ];

  if (options?.includeXRay) {
    managedPolicies.push(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
    );
  }

  return new iam.Role(scope, id, {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    managedPolicies,
  });
}

/**
 * Grants DynamoDB permissions to a role or function
 */
export function grantDynamoDBPermissions(
  grantable: iam.IGrantable,
  tablesMap: TableMap
): void {
  Object.values(tablesMap).forEach((table) => {
    table.grantReadWriteData(grantable);
  });
}

/**
 * Grants S3 permissions to a role or function
 */
export function grantS3Permissions(
  grantable: iam.IGrantable,
  bucket: s3.Bucket
): void {
  bucket.grantReadWrite(grantable);
}

/**
 * Grants Secrets Manager access to a role or function
 */
export function grantSecretsAccess(
  grantable: iam.IGrantable,
  scope: Construct,
  secretNames: string[]
): void {
  secretNames.forEach((secretName) => {
    const secret = secretsmanager.Secret.fromSecretNameV2(scope, `Secret${secretName.replace(/[^a-zA-Z0-9]/g, '')}`, secretName);
    secret.grantRead(grantable);
  });
}

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
  logRetention?: cdk.logs.RetentionDays;
  tracing?: lambda.Tracing;
  role?: iam.Role;
  logGroup?: cdk.logs.LogGroup;
}

export function createLambdaWithTables(
  scope: Construct,
  id: string,
  tablesMap: TableMap,
  artifactsBucket: s3.Bucket,
  options: CreateLambdaWithTablesOptions
): lambda.Function {
  // Create role if not provided
  const role = options.role || createLambdaRole(scope, `${id}Role`, {
    includeXRay: options.tracing === lambda.Tracing.ACTIVE,
  });

  // Create environment variables from tables
  const tableEnvVars = createTableEnvironmentVars(tablesMap);
  const environment = {
    ...tableEnvVars,
    ARTIFACTS_BUCKET: artifactsBucket.bucketName,
    ...options.environment,
  };

  // Create Lambda function
  const lambdaFunction = new lambda.Function(scope, id, {
    runtime: options.runtime,
    handler: options.handler,
    code: options.code,
    timeout: options.timeout,
    memorySize: options.memorySize,
    environment,
    role,
    logRetention: options.logRetention,
    tracing: options.tracing,
    logGroup: options.logGroup,
  });

  // Grant permissions
  grantDynamoDBPermissions(lambdaFunction, tablesMap);
  grantS3Permissions(lambdaFunction, artifactsBucket);

  return lambdaFunction;
}

