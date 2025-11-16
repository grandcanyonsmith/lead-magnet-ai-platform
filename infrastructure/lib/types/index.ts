import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { TABLE_NAMES } from '../config/constants';

/**
 * Enum for table keys used in TableMap
 */
export enum TableKey {
  WORKFLOWS = 'workflows',
  FORMS = 'forms',
  SUBMISSIONS = 'submissions',
  JOBS = 'jobs',
  ARTIFACTS = 'artifacts',
  TEMPLATES = 'templates',
  USER_SETTINGS = 'userSettings',
  USAGE_RECORDS = 'usageRecords',
  NOTIFICATIONS = 'notifications',
  USERS = 'users',
  CUSTOMERS = 'customers',
  FILES = 'files',
  IMPERSONATION_LOGS = 'impersonationLogs',
  SESSIONS = 'sessions',
  FOLDERS = 'folders',
}

/**
 * Typed map of table keys to DynamoDB table references
 * Ensures type safety when accessing tables by key
 */
export interface TableMap {
  [TableKey.WORKFLOWS]: dynamodb.ITable;
  [TableKey.FORMS]: dynamodb.ITable;
  [TableKey.SUBMISSIONS]: dynamodb.ITable;
  [TableKey.JOBS]: dynamodb.ITable;
  [TableKey.ARTIFACTS]: dynamodb.ITable;
  [TableKey.TEMPLATES]: dynamodb.ITable;
  [TableKey.USER_SETTINGS]: dynamodb.ITable;
  [TableKey.USAGE_RECORDS]: dynamodb.ITable;
  [TableKey.NOTIFICATIONS]: dynamodb.ITable;
  [TableKey.USERS]: dynamodb.ITable;
  [TableKey.CUSTOMERS]: dynamodb.ITable;
  [TableKey.FILES]: dynamodb.ITable;
  [TableKey.IMPERSONATION_LOGS]: dynamodb.ITable;
  [TableKey.SESSIONS]: dynamodb.ITable;
  [TableKey.FOLDERS]: dynamodb.ITable;
}

/**
 * Base stack props with common properties shared across stacks
 */
export interface BaseStackProps extends cdk.StackProps {
  tablesMap?: TableMap;
  artifactsBucket?: s3.Bucket;
  cloudfrontDomain?: string;
}

/**
 * Lambda environment configuration
 * Maps environment variable names to their string values
 */
export interface LambdaEnvironmentConfig {
  [key: string]: string;
}

/**
 * DynamoDB table configuration for helper functions
 */
export interface TableConfig {
  /** Table name (should match TABLE_NAMES constant) */
  tableName: string;
  /** Partition key definition */
  partitionKey: {
    name: string;
    type: dynamodb.AttributeType;
  };
  /** Optional sort key definition */
  sortKey?: {
    name: string;
    type: dynamodb.AttributeType;
  };
  /** Optional TTL attribute name */
  timeToLiveAttribute?: string;
}

/**
 * Global Secondary Index configuration
 */
export interface GsiConfig {
  /** Index name */
  indexName: string;
  /** Partition key for the GSI */
  partitionKey: {
    name: string;
    type: dynamodb.AttributeType;
  };
  /** Optional sort key for the GSI */
  sortKey?: {
    name: string;
    type: dynamodb.AttributeType;
  };
  /** Projection type (defaults to ALL) */
  projectionType?: dynamodb.ProjectionType;
}

/**
 * Stack configuration for consistent stack props
 */
export interface StackConfig {
  env?: cdk.Environment;
  stackName: string;
  description: string;
}

/**
 * Configuration for creating a Lambda function with standard permissions
 */
export interface LambdaFunctionConfig {
  /** Function name */
  functionName: string;
  /** Runtime (optional for container images) */
  runtime?: string;
  /** Handler (optional for container images) */
  handler?: string;
  /** Memory size in MB */
  memorySize?: number;
  /** Timeout duration */
  timeout?: cdk.Duration;
  /** Environment variables */
  environment?: Record<string, string>;
  /** Enable X-Ray tracing */
  tracing?: boolean;
  /** Log retention period */
  logRetention?: number;
}

/**
 * Configuration for stack dependencies
 * Used to pass resources between stacks
 */
export interface StackDependencies {
  tablesMap: TableMap;
  artifactsBucket: s3.Bucket;
  cloudfrontDomain?: string;
  userPool?: cognito.UserPool;
  userPoolClient?: cognito.UserPoolClient;
  stateMachineArn?: string;
  ecrRepository?: any; // Using any to avoid circular dependency
}

