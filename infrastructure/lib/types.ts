import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';

/**
 * Map of table names to DynamoDB table references
 */
export type TableMap = Record<string, dynamodb.ITable>;

/**
 * Base stack props with common properties
 */
export interface BaseStackProps extends cdk.StackProps {
  tablesMap?: TableMap;
  artifactsBucket?: s3.Bucket;
  cloudfrontDomain?: string;
}

/**
 * Lambda environment configuration
 */
export interface LambdaEnvironmentConfig {
  [key: string]: string;
}

/**
 * DynamoDB table configuration for helper functions
 */
export interface TableConfig {
  tableName: string;
  partitionKey: {
    name: string;
    type: dynamodb.AttributeType;
  };
  sortKey?: {
    name: string;
    type: dynamodb.AttributeType;
  };
  timeToLiveAttribute?: string;
}

/**
 * Global Secondary Index configuration
 */
export interface GsiConfig {
  indexName: string;
  partitionKey: {
    name: string;
    type: dynamodb.AttributeType;
  };
  sortKey?: {
    name: string;
    type: dynamodb.AttributeType;
  };
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

