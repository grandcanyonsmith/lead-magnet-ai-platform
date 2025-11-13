import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { TableMap } from '../types';
import { createTableEnvironmentVars, getSecretArn } from './environment-helpers';
import { SECRET_NAMES, ENV_VAR_NAMES } from '../config/constants';

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
export function createLambdaRole(
  scope: Construct,
  id: string,
  options?: LambdaRoleOptions
): iam.Role {
  if (!id || id.trim().length === 0) {
    throw new Error('Role ID cannot be empty');
  }

  const managedPolicies = [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
  ];

  if (options?.includeXRay) {
    managedPolicies.push(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
    );
  }

  if (options?.additionalPolicies) {
    managedPolicies.push(...options.additionalPolicies);
  }

  return new iam.Role(scope, id, {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    managedPolicies,
    inlinePolicies: options?.inlinePolicies,
  });
}

/**
 * Grants DynamoDB permissions to a role or function
 * 
 * @param grantable - IAM grantable (role or function) to grant permissions to
 * @param tablesMap - Map of table keys to DynamoDB table references
 * @throws Error if tablesMap is empty or invalid
 */
export function grantDynamoDBPermissions(
  grantable: iam.IGrantable,
  tablesMap: TableMap
): void {
  if (!grantable) {
    throw new Error('Grantable cannot be null or undefined');
  }

  const tables = Object.values(tablesMap);
  if (tables.length === 0) {
    throw new Error('tablesMap cannot be empty');
  }

  tables.forEach((table) => {
    if (!table) {
      throw new Error('Table reference cannot be null or undefined');
    }
    table.grantReadWriteData(grantable);
  });
}

/**
 * Grants S3 permissions to a role or function
 * 
 * @param grantable - IAM grantable (role or function) to grant permissions to
 * @param bucket - S3 bucket to grant access to
 * @throws Error if bucket is null or undefined
 */
export function grantS3Permissions(
  grantable: iam.IGrantable,
  bucket: s3.Bucket
): void {
  if (!grantable) {
    throw new Error('Grantable cannot be null or undefined');
  }
  if (!bucket) {
    throw new Error('Bucket cannot be null or undefined');
  }

  bucket.grantReadWrite(grantable);
}

/**
 * Grants Secrets Manager access to a role or function
 * 
 * @param grantable - IAM grantable (role or function) to grant permissions to
 * @param scope - CDK construct scope (for account/region access)
 * @param secretNames - Array of secret names to grant access to
 * @throws Error if secretNames is empty or contains invalid names
 */
export function grantSecretsAccess(
  grantable: iam.IGrantable,
  scope: Construct & { account: string; region: string },
  secretNames: string[]
): void {
  if (!grantable) {
    throw new Error('Grantable cannot be null or undefined');
  }
  if (!secretNames || secretNames.length === 0) {
    throw new Error('secretNames cannot be empty');
  }

  secretNames.forEach((secretName) => {
    if (!secretName || secretName.trim().length === 0) {
      throw new Error('Secret name cannot be empty');
    }

    // Create a safe ID for the secret construct
    const safeId = `Secret${secretName.replace(/[^a-zA-Z0-9]/g, '')}`;
    const secret = secretsmanager.Secret.fromSecretNameV2(
      scope,
      safeId,
      secretName
    );
    secret.grantRead(grantable);
  });
}

/**
 * Grants access to commonly used secrets (OpenAI, Twilio)
 * 
 * @param grantable - IAM grantable to grant permissions to
 * @param scope - CDK construct scope
 */
export function grantCommonSecretsAccess(
  grantable: iam.IGrantable,
  scope: Construct & { account: string; region: string }
): void {
  grantSecretsAccess(grantable, scope, [
    SECRET_NAMES.OPENAI_API_KEY,
    SECRET_NAMES.TWILIO_CREDENTIALS,
  ]);
}

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
export function createLambdaWithTables(
  scope: Construct,
  id: string,
  tablesMap: TableMap,
  artifactsBucket: s3.Bucket,
  options: CreateLambdaWithTablesOptions
): lambda.IFunction {
  // Validate inputs
  if (!id || id.trim().length === 0) {
    throw new Error('Function ID cannot be empty');
  }
  if (!tablesMap || Object.keys(tablesMap).length === 0) {
    throw new Error('tablesMap cannot be empty');
  }
  if (!artifactsBucket) {
    throw new Error('artifactsBucket cannot be null or undefined');
  }
  if (!options.code) {
    throw new Error('Lambda code is required');
  }

  // Create role if not provided
  const role = options.role || createLambdaRole(scope, `${id}Role`, {
    includeXRay: options.tracing === lambda.Tracing.ACTIVE,
  });

  // Create environment variables from tables
  const tableEnvVars = createTableEnvironmentVars(tablesMap);
  const environment = {
    ...tableEnvVars,
    [ENV_VAR_NAMES.ARTIFACTS_BUCKET]: artifactsBucket.bucketName,
    ...options.environment,
  };

  // Create Lambda function (container image or zip)
  let lambdaFunction: lambda.IFunction;
  
  // Determine deployment type: container image if runtime/handler are both missing
  const isContainerImage = options.runtime === undefined && options.handler === undefined;
  
  if (isContainerImage) {
    // Container image - use DockerImageFunction
    // When runtime/handler are undefined, code must be DockerImageCode
    // Verify that code is actually DockerImageCode by checking its type
    // DockerImageCode.fromEcr() returns a DockerImageCode instance
    if (!options.code) {
      throw new Error('Code is required for Lambda function');
    }
    
    // Create DockerImageFunction - CDK will validate the code type
    // If code is not DockerImageCode, CDK will throw an error during synthesis
    lambdaFunction = new lambda.DockerImageFunction(scope, id, {
      functionName: options.functionName,
      code: options.code as lambda.DockerImageCode,
      timeout: options.timeout,
      memorySize: options.memorySize,
      environment,
      role,
      logRetention: options.logRetention,
      tracing: options.tracing,
      logGroup: options.logGroup,
    });
  } else {
    // Zip deployment - use regular Function
    if (!options.runtime) {
      throw new Error('Runtime is required for zip-based Lambda functions');
    }
    if (!options.handler) {
      throw new Error('Handler is required for zip-based Lambda functions');
    }
    if (!(options.code instanceof lambda.Code)) {
      throw new Error('Lambda.Code is required for zip-based deployment');
    }
    lambdaFunction = new lambda.Function(scope, id, {
      functionName: options.functionName,
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
  }

  // Grant permissions
  grantDynamoDBPermissions(lambdaFunction, tablesMap);
  grantS3Permissions(lambdaFunction, artifactsBucket);

  return lambdaFunction;
}

