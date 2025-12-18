#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { StorageStack } from '../lib/storage-stack';
import { WorkerStack } from '../lib/worker-stack';
import { ComputeStack } from '../lib/compute-stack';
import { ApiStack } from '../lib/api-stack';
import { ShellExecutorStack } from '../lib/shell-executor-stack';
import { STACK_NAMES, DEFAULT_REGION } from '../lib/config/constants';

/**
 * Validates required environment variables
 * 
 * @throws Error if required environment variables are missing
 */
function validateEnvironment(): void {
  if (!process.env.CDK_DEFAULT_ACCOUNT) {
    throw new Error(
      'CDK_DEFAULT_ACCOUNT environment variable is required. ' +
      'Set it using: export CDK_DEFAULT_ACCOUNT=<your-account-id>'
    );
  }
}

/**
 * Gets the AWS environment configuration
 * 
 * @returns CDK environment configuration
 */
function getEnvironment(): cdk.Environment {
  const account = process.env.CDK_DEFAULT_ACCOUNT;
  const region = process.env.CDK_DEFAULT_REGION || DEFAULT_REGION;

  if (!account) {
    throw new Error('CDK_DEFAULT_ACCOUNT is required but not set');
  }

  return {
    account,
    region,
  };
}

/**
 * Creates all CDK stacks for the Lead Magnet platform
 * 
 * Stack dependencies:
 * 1. DatabaseStack - No dependencies (creates DynamoDB tables)
 * 2. AuthStack - No dependencies (creates Cognito User Pool)
 * 3. StorageStack - No dependencies (creates S3 bucket and CloudFront)
 * 4. WorkerStack - No dependencies (creates ECR repository)
 * 5. ComputeStack - Depends on: DatabaseStack, StorageStack, WorkerStack
 * 6. ApiStack - Depends on: AuthStack, DatabaseStack, ComputeStack, StorageStack
 * 
 * @param app - CDK app instance
 * @param env - AWS environment configuration
 */
function createStacks(app: cdk.App, env: cdk.Environment): void {
  // Stack 1: Database (DynamoDB Tables) - Foundation layer
  const databaseStack = new DatabaseStack(app, 'LeadMagnetDatabaseStack', {
    env,
    stackName: STACK_NAMES.DATABASE,
    description: 'DynamoDB tables for lead magnet platform',
  });

  // Stack 2: Authentication (Cognito) - Foundation layer
  const authStack = new AuthStack(app, 'LeadMagnetAuthStack', {
    env,
    stackName: STACK_NAMES.AUTH,
    description: 'Cognito User Pool for authentication',
  });

  // Stack 3: Storage (S3 + CloudFront) - Foundation layer
  const storageStack = new StorageStack(app, 'LeadMagnetStorageStack', {
    env,
    stackName: STACK_NAMES.STORAGE,
    description: 'S3 buckets and CloudFront for artifact storage',
  });

  // Stack 4: Worker (ECR Repository) - Foundation layer
  // Creates ECR repository for Lambda container images
  // Container images are required for Playwright (GLIBC compatibility)
  const workerStack = new WorkerStack(app, 'LeadMagnetWorkerStack', {
    env,
    stackName: STACK_NAMES.WORKER,
    description: 'ECR repository for Lambda container images',
  });

  // Stack 4.5: Shell Executor (ECS Fargate + isolated VPC + result bucket)
  const shellExecutorStack = new ShellExecutorStack(app, 'LeadMagnetShellExecutorStack', {
    env,
    stackName: STACK_NAMES.SHELL_EXECUTOR,
    description: 'ECS Fargate shell executor + result bucket',
  });

  // Stack 5: Compute (Step Functions + Lambda) - Application layer
  // Depends on: DatabaseStack, StorageStack, WorkerStack
  const computeStack = new ComputeStack(app, 'LeadMagnetComputeStack', {
    env,
    stackName: STACK_NAMES.COMPUTE,
    description: 'Step Functions state machine and Lambda function for job processing',
    tablesMap: databaseStack.tablesMap,
    artifactsBucket: storageStack.artifactsBucket,
    cloudfrontDomain: storageStack.distribution.distributionDomainName,
    ecrRepository: workerStack.ecrRepository,
    shellExecutor: {
      cluster: shellExecutorStack.cluster,
      taskDefinition: shellExecutorStack.taskDefinition,
      securityGroup: shellExecutorStack.securityGroup,
      subnetIds: shellExecutorStack.subnetIds,
      resultsBucket: shellExecutorStack.resultsBucket,
    },
  });

  // Stack 6: API Gateway + Lambda - Application layer
  // Depends on: AuthStack, DatabaseStack, ComputeStack, StorageStack
  const apiStack = new ApiStack(app, 'LeadMagnetApiStack', {
    env,
    stackName: STACK_NAMES.API,
    description: 'API Gateway and Lambda functions',
    userPool: authStack.userPool,
    userPoolClient: authStack.userPoolClient,
    tablesMap: databaseStack.tablesMap,
    stateMachineArn: computeStack.stateMachineArn,
    artifactsBucket: storageStack.artifactsBucket,
    cloudfrontDomain: storageStack.distribution.distributionDomainName,
    shellExecutor: {
      cluster: shellExecutorStack.cluster,
      taskDefinition: shellExecutorStack.taskDefinition,
      securityGroup: shellExecutorStack.securityGroup,
      subnetIds: shellExecutorStack.subnetIds,
      resultsBucket: shellExecutorStack.resultsBucket,
    },
  });
}

/**
 * Main entry point for CDK application
 */
function main(): void {
  try {
    // Validate environment
    validateEnvironment();

    // Create CDK app
    const app = new cdk.App();

    // Get environment configuration
    const env = getEnvironment();

    // Create all stacks
    createStacks(app, env);

    // Synthesize CloudFormation templates
    app.synth();
  } catch (error) {
    console.error('Error initializing CDK app:', error);
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

// Execute main function
main();

