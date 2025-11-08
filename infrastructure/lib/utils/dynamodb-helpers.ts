import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { TableConfig, GsiConfig } from '../types';

/**
 * Creates a DynamoDB table with standard configuration
 */
export function createTable(
  scope: Construct,
  id: string,
  config: TableConfig
): dynamodb.Table {
  const table = new dynamodb.Table(scope, id, {
    tableName: config.tableName,
    partitionKey: config.partitionKey,
    sortKey: config.sortKey,
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    pointInTimeRecovery: true,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    encryption: dynamodb.TableEncryption.AWS_MANAGED,
    timeToLiveAttribute: config.timeToLiveAttribute,
  });

  return table;
}

/**
 * Creates a DynamoDB table with Global Secondary Indexes
 */
export function createTableWithGSI(
  scope: Construct,
  id: string,
  config: TableConfig,
  gsis: GsiConfig[]
): dynamodb.Table {
  const table = createTable(scope, id, config);

  gsis.forEach((gsi) => {
    table.addGlobalSecondaryIndex({
      indexName: gsi.indexName,
      partitionKey: gsi.partitionKey,
      sortKey: gsi.sortKey,
      projectionType: gsi.projectionType || dynamodb.ProjectionType.ALL,
    });
  });

  return table;
}

