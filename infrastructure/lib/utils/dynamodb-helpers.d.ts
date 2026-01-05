import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { TableConfig, GsiConfig } from '../types';
/**
 * Creates a DynamoDB table with standard configuration
 */
export declare function createTable(scope: Construct, id: string, config: TableConfig): dynamodb.Table;
/**
 * Creates a DynamoDB table with Global Secondary Indexes
 */
export declare function createTableWithGSI(scope: Construct, id: string, config: TableConfig, gsis: GsiConfig[]): dynamodb.Table;
