import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface WorkerStackProps extends cdk.StackProps {
  cluster: ecs.Cluster;
  tablesMap: Record<string, dynamodb.Table>;
  artifactsBucket: s3.Bucket;
}

export class WorkerStack extends cdk.Stack {
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: WorkerStackProps) {
    super(scope, id, props);

    // Create ECR Repository for worker image
    this.ecrRepository = new ecr.Repository(this, 'WorkerRepository', {
      repositoryName: 'leadmagnet/worker',
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
        },
      ],
    });

    // Create Task Execution Role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant ECR permissions
    this.ecrRepository.grantPull(taskExecutionRole);

    // Grant Secrets Manager permissions
    taskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:leadmagnet/*`,
        ],
      })
    );

    // Create Task Role
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    });

    // Grant DynamoDB permissions
    Object.values(props.tablesMap).forEach((table) => {
      table.grantReadWriteData(taskRole);
    });

    // Grant S3 permissions
    props.artifactsBucket.grantReadWrite(taskRole);

    // Grant Secrets Manager permissions
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:leadmagnet/*`,
        ],
      })
    );

    // Create Fargate Task Definition
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'WorkerTaskDefinition', {
      memoryLimitMiB: 4096,
      cpu: 2048,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      family: 'leadmagnet-worker',
    });

    // Create Log Group
    const logGroup = new logs.LogGroup(this, 'WorkerLogGroup', {
      logGroupName: '/ecs/leadmagnet-worker',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add Container to Task Definition
    const container = this.taskDefinition.addContainer('WorkerContainer', {
      image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, 'latest'),
      memoryLimitMiB: 4096,
      cpu: 2048,
      environment: {
        AWS_REGION: this.region,
        WORKFLOWS_TABLE: props.tablesMap.workflows.tableName,
        FORMS_TABLE: props.tablesMap.forms.tableName,
        SUBMISSIONS_TABLE: props.tablesMap.submissions.tableName,
        JOBS_TABLE: props.tablesMap.jobs.tableName,
        ARTIFACTS_TABLE: props.tablesMap.artifacts.tableName,
        TEMPLATES_TABLE: props.tablesMap.templates.tableName,
        ARTIFACTS_BUCKET: props.artifactsBucket.bucketName,
        OPENAI_SECRET_NAME: 'leadmagnet/openai-api-key',
        LOG_LEVEL: 'info',
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'worker',
        logGroup: logGroup,
      }),
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'TaskDefinitionArn', {
      value: this.taskDefinition.taskDefinitionArn,
      exportName: 'WorkerTaskDefinitionArn',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      exportName: 'WorkerEcrRepositoryUri',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryName', {
      value: this.ecrRepository.repositoryName,
      exportName: 'WorkerEcrRepositoryName',
    });
  }
}

