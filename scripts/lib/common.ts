/**
 * Shared utilities for Lead Magnet AI TypeScript scripts.
 * 
 * This module provides common functionality used across multiple scripts:
 * - AWS client initialization and configuration
 * - Table name resolution
 * - Region configuration
 * - Error handling utilities
 * - Logging/formatting functions
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

// Cache AWS clients to avoid reinitializing
const clientsCache: Map<string, any> = new Map();

/**
 * Get AWS region from environment or default.
 * 
 * @returns AWS region string (default: us-east-1)
 */
export function getAwsRegion(): string {
  return process.env.AWS_REGION || 'us-east-1';
}

/**
 * Get AWS account ID.
 * 
 * @returns AWS account ID string
 * @throws Error if unable to get account ID
 */
export async function getAwsAccountId(): Promise<string> {
  const cacheKey = 'account_id';
  if (clientsCache.has(cacheKey)) {
    return clientsCache.get(cacheKey);
  }

  try {
    const sts = getStsClient();
    const command = new GetCallerIdentityCommand({});
    const response = await sts.send(command);
    const accountId = response.Account || '';
    
    if (!accountId) {
      throw new Error('Failed to get AWS account ID');
    }
    
    clientsCache.set(cacheKey, accountId);
    return accountId;
  } catch (error) {
    throw new Error(`Failed to get AWS account ID: ${error}`);
  }
}

/**
 * Get or create cached DynamoDB client.
 */
export function getDynamoDbClient(): DynamoDBClient {
  const region = getAwsRegion();
  const cacheKey = `dynamodb_${region}`;
  
  if (clientsCache.has(cacheKey)) {
    return clientsCache.get(cacheKey);
  }
  
  const client = new DynamoDBClient({ region });
  clientsCache.set(cacheKey, client);
  return client;
}

/**
 * Get or create cached DynamoDB Document client.
 */
export function getDynamoDbDocumentClient(): DynamoDBDocumentClient {
  const region = getAwsRegion();
  const cacheKey = `dynamodb_doc_${region}`;
  
  if (clientsCache.has(cacheKey)) {
    return clientsCache.get(cacheKey);
  }
  
  const client = DynamoDBDocumentClient.from(getDynamoDbClient(), {
    marshallOptions: {
      removeUndefinedValues: true,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });
  
  clientsCache.set(cacheKey, client);
  return client;
}

/**
 * Get or create cached S3 client.
 */
export function getS3Client(): S3Client {
  const region = getAwsRegion();
  const cacheKey = `s3_${region}`;
  
  if (clientsCache.has(cacheKey)) {
    return clientsCache.get(cacheKey);
  }
  
  const client = new S3Client({ region });
  clientsCache.set(cacheKey, client);
  return client;
}

/**
 * Get or create cached Cognito client.
 */
export function getCognitoClient(): CognitoIdentityProviderClient {
  const region = getAwsRegion();
  const cacheKey = `cognito_${region}`;
  
  if (clientsCache.has(cacheKey)) {
    return clientsCache.get(cacheKey);
  }
  
  const client = new CognitoIdentityProviderClient({ region });
  clientsCache.set(cacheKey, client);
  return client;
}

/**
 * Get or create cached CloudFormation client.
 */
export function getCloudFormationClient(): CloudFormationClient {
  const region = getAwsRegion();
  const cacheKey = `cloudformation_${region}`;
  
  if (clientsCache.has(cacheKey)) {
    return clientsCache.get(cacheKey);
  }
  
  const client = new CloudFormationClient({ region });
  clientsCache.set(cacheKey, client);
  return client;
}

/**
 * Get or create cached STS client.
 */
export function getStsClient(): STSClient {
  const region = getAwsRegion();
  const cacheKey = `sts_${region}`;
  
  if (clientsCache.has(cacheKey)) {
    return clientsCache.get(cacheKey);
  }
  
  const client = new STSClient({ region });
  clientsCache.set(cacheKey, client);
  return client;
}

/**
 * Get DynamoDB table name for a given table type.
 * 
 * @param tableType - One of 'jobs', 'workflows', 'forms', 'submissions', 
 *                   'artifacts', 'templates', 'users', 'customers', etc.
 * @returns Table name string
 * @throws Error if table_type is invalid
 */
export function getTableName(tableType: string): string {
  const tableNames: Record<string, string> = {
    jobs: 'leadmagnet-jobs',
    workflows: 'leadmagnet-workflows',
    forms: 'leadmagnet-forms',
    submissions: 'leadmagnet-submissions',
    artifacts: 'leadmagnet-artifacts',
    templates: 'leadmagnet-templates',
    users: 'leadmagnet-users',
    customers: 'leadmagnet-customers',
    'user-settings': 'leadmagnet-user-settings',
    notifications: 'leadmagnet-notifications',
  };
  
  if (!(tableType in tableNames)) {
    throw new Error(
      `Invalid table_type: ${tableType}. ` +
      `Must be one of: ${Object.keys(tableNames).join(', ')}`
    );
  }
  
  // Allow override via environment variable
  const envKey = `${tableType.toUpperCase().replace(/-/g, '_')}_TABLE`;
  return process.env[envKey] || tableNames[tableType];
}

/**
 * Get artifacts S3 bucket name.
 * 
 * @returns Bucket name string
 */
export async function getArtifactsBucket(): Promise<string> {
  const bucket = process.env.ARTIFACTS_BUCKET;
  if (bucket) {
    return bucket;
  }
  
  const accountId = await getAwsAccountId();
  return `leadmagnet-artifacts-${accountId}`;
}

/**
 * Format timestamp for display.
 * 
 * @param timestamp - ISO timestamp string or Date object
 * @returns Formatted timestamp string
 */
export function formatTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' 
    ? new Date(timestamp) 
    : timestamp;
  
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

/**
 * Print a formatted section header.
 * 
 * @param title - Section title
 * @param width - Width of the section divider (default: 80)
 */
export function printSection(title: string, width: number = 80): void {
  console.log('='.repeat(width));
  console.log(title);
  console.log('='.repeat(width));
}

/**
 * Print a formatted subsection header.
 * 
 * @param title - Subsection title
 * @param width - Width of the subsection divider (default: 80)
 */
export function printSubsection(title: string, width: number = 80): void {
  console.log('-'.repeat(width));
  console.log(title);
  console.log('-'.repeat(width));
}

/**
 * Print success message.
 * 
 * @param message - Success message
 */
export function printSuccess(message: string): void {
  console.log(`✓ ${message}`);
}

/**
 * Print error message.
 * 
 * @param message - Error message
 */
export function printError(message: string): void {
  console.error(`✗ ${message}`);
}

/**
 * Print warning message.
 * 
 * @param message - Warning message
 */
export function printWarning(message: string): void {
  console.warn(`⚠ ${message}`);
}

/**
 * Print info message.
 * 
 * @param message - Info message
 */
export function printInfo(message: string): void {
  console.log(`ℹ ${message}`);
}

/**
 * Handle errors with consistent formatting.
 * 
 * @param error - Error object or message
 * @param context - Additional context about where the error occurred
 */
export function handleError(error: unknown, context?: string): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  if (context) {
    printError(`${context}: ${errorMessage}`);
  } else {
    printError(errorMessage);
  }
  
  if (errorStack && process.env.DEBUG) {
    console.error(errorStack);
  }
  
  process.exit(1);
}

/**
 * Get CloudFormation stack output value.
 * 
 * @param stackName - Stack name
 * @param outputKey - Output key
 * @param region - AWS region (optional, uses default if not provided)
 * @returns Output value or undefined if not found
 */
export async function getStackOutput(
  stackName: string,
  outputKey: string,
  region?: string
): Promise<string | undefined> {
  try {
    const cf = getCloudFormationClient();
    const { DescribeStacksCommand } = await import('@aws-sdk/client-cloudformation');
    
    const command = new DescribeStacksCommand({ StackName: stackName });
    const response = await cf.send(command);
    
    if (!response.Stacks || response.Stacks.length === 0) {
      return undefined;
    }
    
    const stack = response.Stacks[0];
    const output = stack.Outputs?.find(o => o.OutputKey === outputKey);
    return output?.OutputValue;
  } catch (error) {
    printWarning(`Failed to get stack output ${outputKey} from ${stackName}: ${error}`);
    return undefined;
  }
}

/**
 * Get API URL from environment or CloudFormation.
 * 
 * @returns API URL string
 */
export async function getApiUrl(): Promise<string> {
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  
  const apiUrl = await getStackOutput('leadmagnet-api', 'ApiUrl');
  if (apiUrl) {
    return apiUrl;
  }
  
  // Default fallback
  return 'https://czp5b77azd.execute-api.us-east-1.amazonaws.com';
}

