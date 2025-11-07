import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DatabaseStack extends cdk.Stack {
  public readonly tablesMap: Record<string, dynamodb.ITable>;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Table 1: Workflows
    const workflowsTable = new dynamodb.Table(this, 'WorkflowsTable', {
      tableName: 'leadmagnet-workflows',
      partitionKey: { name: 'workflow_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    workflowsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_tenant_status',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    workflowsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_form_id',
      partitionKey: { name: 'form_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Table 2: Forms
    const formsTable = new dynamodb.Table(this, 'FormsTable', {
      tableName: 'leadmagnet-forms',
      partitionKey: { name: 'form_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    formsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_tenant_id',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    formsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_public_slug',
      partitionKey: { name: 'public_slug', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    formsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_workflow_id',
      partitionKey: { name: 'workflow_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Table 3: Form Submissions
    const submissionsTable = new dynamodb.Table(this, 'SubmissionsTable', {
      tableName: 'leadmagnet-submissions',
      partitionKey: { name: 'submission_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
    });

    submissionsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_form_created',
      partitionKey: { name: 'form_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    submissionsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_tenant_created',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Table 4: Jobs
    const jobsTable = new dynamodb.Table(this, 'JobsTable', {
      tableName: 'leadmagnet-jobs',
      partitionKey: { name: 'job_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    jobsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_workflow_status',
      partitionKey: { name: 'workflow_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    jobsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_tenant_created',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Table 5: Artifacts
    const artifactsTable = new dynamodb.Table(this, 'ArtifactsTable', {
      tableName: 'leadmagnet-artifacts',
      partitionKey: { name: 'artifact_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    artifactsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_job_id',
      partitionKey: { name: 'job_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    artifactsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_tenant_type',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'artifact_type', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Table 6: Templates
    const templatesTable = new dynamodb.Table(this, 'TemplatesTable', {
      tableName: 'leadmagnet-templates',
      partitionKey: { name: 'template_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    templatesTable.addGlobalSecondaryIndex({
      indexName: 'gsi_tenant_id',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Table 7: User Settings
    const userSettingsTable = new dynamodb.Table(this, 'UserSettingsTable', {
      tableName: 'leadmagnet-user-settings',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Table 8: Usage Records (for billing/usage tracking)
    // Note: Table already exists, referencing it instead of creating
    const usageRecordsTable = dynamodb.Table.fromTableName(
      this,
      'UsageRecordsTable',
      'leadmagnet-usage-records'
    );

    // Table 9: Notifications
    const notificationsTable = new dynamodb.Table(this, 'NotificationsTable', {
      tableName: 'leadmagnet-notifications',
      partitionKey: { name: 'notification_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
    });

    notificationsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_tenant_created',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    notificationsTable.addGlobalSecondaryIndex({
      indexName: 'gsi_tenant_read',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'read_at', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Export table names and references
    this.tablesMap = {
      workflows: workflowsTable,
      forms: formsTable,
      submissions: submissionsTable,
      jobs: jobsTable,
      artifacts: artifactsTable,
      templates: templatesTable,
      userSettings: userSettingsTable,
      usageRecords: usageRecordsTable,
      notifications: notificationsTable,
    };

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'WorkflowsTableName', {
      value: workflowsTable.tableName,
      exportName: 'WorkflowsTableName',
    });

    new cdk.CfnOutput(this, 'FormsTableName', {
      value: formsTable.tableName,
      exportName: 'FormsTableName',
    });

    new cdk.CfnOutput(this, 'JobsTableName', {
      value: jobsTable.tableName,
      exportName: 'JobsTableName',
    });
  }
}

