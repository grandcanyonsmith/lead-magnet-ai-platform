#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { StorageStack } from '../lib/storage-stack';
import { WorkerStack } from '../lib/worker-stack';
import { ComputeStack } from '../lib/compute-stack';
import { ApiStack } from '../lib/api-stack';

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

// Stack 3.5: Worker (ECR Repository for container images)
const workerStack = new WorkerStack(app, 'LeadMagnetWorkerStack', {
  env,
  stackName: 'leadmagnet-worker',
  description: 'ECR repository for Lambda container images',
  tablesMap: databaseStack.tablesMap,
  artifactsBucket: storageStack.artifactsBucket,
});

// Stack 4: Compute (Step Functions + Lambda)
const computeStack = new ComputeStack(app, 'LeadMagnetComputeStack', {
  env,
  stackName: 'leadmagnet-compute',
  description: 'Step Functions state machine and Lambda function for job processing',
  tablesMap: databaseStack.tablesMap,
  artifactsBucket: storageStack.artifactsBucket,
  cloudfrontDomain: storageStack.distribution.distributionDomainName,
  ecrRepository: workerStack.ecrRepository,  // Use container image for Playwright
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
  cloudfrontDomain: storageStack.distribution.distributionDomainName,
});

// Note: WorkerStack provides ECR repository for Lambda container images.
// Container images are required for Playwright (GLIBC compatibility).

app.synth();

