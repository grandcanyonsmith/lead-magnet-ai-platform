import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { createTable, createTableWithGSI } from '../utils/dynamodb-helpers';
import { TableMap, TableKey } from '../types';
import { getTableNames, getExportNamePrefix } from '../config/constants';

/**
 * Database Stack
 * 
 * Creates all DynamoDB tables required for the Lead Magnet platform.
 * Tables are configured with appropriate indexes, TTL, and encryption.
 */
export class DatabaseStack extends cdk.Stack {
  public readonly tablesMap: TableMap;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const TABLE_NAMES = getTableNames();
    const EXPORT_PREFIX = getExportNamePrefix();

    // Table 1: Workflows
    const workflowsTable = createTableWithGSI(
      this,
      'WorkflowsTable',
      {
        tableName: TABLE_NAMES.WORKFLOWS,
        partitionKey: { name: 'workflow_id', type: dynamodb.AttributeType.STRING },
      },
      [
        {
          indexName: 'gsi_tenant_status',
          partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
        },
        {
          indexName: 'gsi_form_id',
          partitionKey: { name: 'form_id', type: dynamodb.AttributeType.STRING },
        },
      ]
    );

    // Table 2: Forms
    const formsTable = createTableWithGSI(
      this,
      'FormsTable',
      {
        tableName: TABLE_NAMES.FORMS,
        partitionKey: { name: 'form_id', type: dynamodb.AttributeType.STRING },
      },
      [
        {
          indexName: 'gsi_tenant_id',
          partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
        },
        {
          indexName: 'gsi_public_slug',
          partitionKey: { name: 'public_slug', type: dynamodb.AttributeType.STRING },
        },
        {
          indexName: 'gsi_workflow_id',
          partitionKey: { name: 'workflow_id', type: dynamodb.AttributeType.STRING },
        },
      ]
    );

    // Table 3: Form Submissions
    const submissionsTable = createTableWithGSI(
      this,
      'SubmissionsTable',
      {
        tableName: TABLE_NAMES.SUBMISSIONS,
        partitionKey: { name: 'submission_id', type: dynamodb.AttributeType.STRING },
        timeToLiveAttribute: 'ttl',
      },
      [
        {
          indexName: 'gsi_form_created',
          partitionKey: { name: 'form_id', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
        },
        {
          indexName: 'gsi_tenant_created',
          partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
        },
      ]
    );

    // Table 4: Jobs
    const jobsTable = createTableWithGSI(
      this,
      'JobsTable',
      {
        tableName: TABLE_NAMES.JOBS,
        partitionKey: { name: 'job_id', type: dynamodb.AttributeType.STRING },
      },
      [
        {
          indexName: 'gsi_workflow_status',
          partitionKey: { name: 'workflow_id', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
        },
        {
          indexName: 'gsi_tenant_created',
          partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
        },
      ]
    );

    // Table 5: Artifacts
    const artifactsTable = createTableWithGSI(
      this,
      'ArtifactsTable',
      {
        tableName: TABLE_NAMES.ARTIFACTS,
        partitionKey: { name: 'artifact_id', type: dynamodb.AttributeType.STRING },
      },
      [
        {
          indexName: 'gsi_job_id',
          partitionKey: { name: 'job_id', type: dynamodb.AttributeType.STRING },
        },
        {
          indexName: 'gsi_tenant_type',
          partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'artifact_type', type: dynamodb.AttributeType.STRING },
        },
      ]
    );

    // Table 6: Templates
    const templatesTable = createTableWithGSI(
      this,
      'TemplatesTable',
      {
        tableName: TABLE_NAMES.TEMPLATES,
        partitionKey: { name: 'template_id', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      },
      [
        {
          indexName: 'gsi_tenant_id',
          partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
        },
      ]
    );

    // Table 7: User Settings
    const userSettingsTable = createTable(
      this,
      'UserSettingsTable',
      {
        tableName: TABLE_NAMES.USER_SETTINGS,
        partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      }
    );

    // Table 8: Usage Records (for billing/usage tracking)
    // Note: Table already exists, referencing it instead of creating
    const usageRecordsTable = dynamodb.Table.fromTableName(
      this,
      'UsageRecordsTable',
      TABLE_NAMES.USAGE_RECORDS
    );

    // Table 9: Notifications
    const notificationsTable = createTableWithGSI(
      this,
      'NotificationsTable',
      {
        tableName: TABLE_NAMES.NOTIFICATIONS,
        partitionKey: { name: 'notification_id', type: dynamodb.AttributeType.STRING },
        timeToLiveAttribute: 'ttl',
      },
      [
        {
          indexName: 'gsi_tenant_created',
          partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
        },
        {
          indexName: 'gsi_tenant_read',
          partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'read_at', type: dynamodb.AttributeType.STRING },
        },
      ]
    );

    // Table 10: Users
    const usersTable = createTableWithGSI(
      this,
      'UsersTable',
      {
        tableName: TABLE_NAMES.USERS,
        partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      },
      [
        {
          indexName: 'gsi_customer_id',
          partitionKey: { name: 'customer_id', type: dynamodb.AttributeType.STRING },
        },
      ]
    );

    // Table 11: Customers
    const customersTable = createTable(
      this,
      'CustomersTable',
      {
        tableName: TABLE_NAMES.CUSTOMERS,
        partitionKey: { name: 'customer_id', type: dynamodb.AttributeType.STRING },
      }
    );

    // Table 12: Files
    const filesTable = createTableWithGSI(
      this,
      'FilesTable',
      {
        tableName: TABLE_NAMES.FILES,
        partitionKey: { name: 'file_id', type: dynamodb.AttributeType.STRING },
      },
      [
        {
          indexName: 'gsi_customer_id',
          partitionKey: { name: 'customer_id', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
        },
      ]
    );

    // Table 13: Impersonation Logs
    const impersonationLogsTable = createTable(
      this,
      'ImpersonationLogsTable',
      {
        tableName: TABLE_NAMES.IMPERSONATION_LOGS,
        partitionKey: { name: 'log_id', type: dynamodb.AttributeType.STRING },
      }
    );

    // Table 14: Sessions (for impersonation state)
    const sessionsTable = createTable(
      this,
      'SessionsTable',
      {
        tableName: TABLE_NAMES.SESSIONS,
        partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
        timeToLiveAttribute: 'expires_at', // Unix timestamp
      }
    );

    // Table 15: Folders (for organizing workflows)
    const foldersTable = createTableWithGSI(
      this,
      'FoldersTable',
      {
        tableName: TABLE_NAMES.FOLDERS,
        partitionKey: { name: 'folder_id', type: dynamodb.AttributeType.STRING },
      },
      [
        {
          indexName: 'gsi_tenant_created',
          partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
        },
      ]
    );

    // Export table names and references using TableKey enum for type safety
    this.tablesMap = {
      [TableKey.WORKFLOWS]: workflowsTable,
      [TableKey.FORMS]: formsTable,
      [TableKey.SUBMISSIONS]: submissionsTable,
      [TableKey.JOBS]: jobsTable,
      [TableKey.ARTIFACTS]: artifactsTable,
      [TableKey.TEMPLATES]: templatesTable,
      [TableKey.USER_SETTINGS]: userSettingsTable,
      [TableKey.USAGE_RECORDS]: usageRecordsTable,
      [TableKey.NOTIFICATIONS]: notificationsTable,
      [TableKey.USERS]: usersTable,
      [TableKey.CUSTOMERS]: customersTable,
      [TableKey.FILES]: filesTable,
      [TableKey.IMPERSONATION_LOGS]: impersonationLogsTable,
      [TableKey.SESSIONS]: sessionsTable,
      [TableKey.FOLDERS]: foldersTable,
    };

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'WorkflowsTableName', {
      value: workflowsTable.tableName,
      exportName: `${EXPORT_PREFIX}WorkflowsTableName`,
    });

    new cdk.CfnOutput(this, 'FormsTableName', {
      value: formsTable.tableName,
      exportName: `${EXPORT_PREFIX}FormsTableName`,
    });

    new cdk.CfnOutput(this, 'JobsTableName', {
      value: jobsTable.tableName,
      exportName: `${EXPORT_PREFIX}JobsTableName`,
    });
  }
}

