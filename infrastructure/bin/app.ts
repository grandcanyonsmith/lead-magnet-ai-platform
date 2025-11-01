#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { StorageStack } from '../lib/storage-stack';
import { ComputeStack } from '../lib/compute-stack';
import { ApiStack } from '../lib/api-stack';
import { WorkerStack } from '../lib/worker-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Stack 1: Database (DynamoDB Tables)
const databaseStack = new DatabaseStack(app, 'LeadMagnetDatabaseStack', {
  env,
  stackName: 'leadmagnet-database',
  description: 'DynamoDB tables for lead magnet platform',
});

// Stack 2: Authentication (Cognito)
const authStack = new AuthStack(app, 'LeadMagnetAuthStack', {
  env,
  stackName: 'leadmagnet-auth',
  description: 'Cognito User Pool for authentication',
});

// Stack 3: Storage (S3 + CloudFront)
const storageStack = new StorageStack(app, 'LeadMagnetStorageStack', {
  env,
  stackName: 'leadmagnet-storage',
  description: 'S3 buckets and CloudFront for artifact storage',
});

// Stack 4: Compute (Step Functions + Lambda)
const computeStack = new ComputeStack(app, 'LeadMagnetComputeStack', {
  env,
  stackName: 'leadmagnet-compute',
  description: 'Step Functions state machine and Lambda function for job processing',
  tablesMap: databaseStack.tablesMap,
  artifactsBucket: storageStack.artifactsBucket,
  cloudfrontDomain: storageStack.distribution.distributionDomainName,
});

// Stack 5: API Gateway + Lambda
const apiStack = new ApiStack(app, 'LeadMagnetApiStack', {
  env,
  stackName: 'leadmagnet-api',
  description: 'API Gateway and Lambda functions',
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  tablesMap: databaseStack.tablesMap,
  stateMachineArn: computeStack.stateMachineArn,
  artifactsBucket: storageStack.artifactsBucket,
});

// Stack 6: Worker (ECR Repository - Optional, kept for potential future use)
// Note: Worker is now implemented as Lambda function in ComputeStack
// ECR repository may be kept for potential future containerized workloads
const workerStack = new WorkerStack(app, 'LeadMagnetWorkerStack', {
  env,
  stackName: 'leadmagnet-worker',
  description: 'ECR repository for worker images (optional, Lambda is now primary)',
  tablesMap: databaseStack.tablesMap,
  artifactsBucket: storageStack.artifactsBucket,
});

// Add dependencies
computeStack.addDependency(databaseStack);
computeStack.addDependency(storageStack);
apiStack.addDependency(databaseStack);
apiStack.addDependency(authStack);
apiStack.addDependency(computeStack);
workerStack.addDependency(databaseStack);
workerStack.addDependency(storageStack);

app.synth();

