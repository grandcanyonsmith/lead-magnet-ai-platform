import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { RESOURCE_PREFIXES, SHELL_EXECUTOR_TASK_FAMILY } from './config/constants';

export interface ShellExecutorStackProps extends cdk.StackProps {
  // No cross-stack dependencies required for the executor itself.
}

/**
 * ShellExecutorStack
 *
 * Provisions an isolated ECS Fargate environment + S3 result bucket for running
 * model-requested shell commands as one-shot tasks.
 */
export class ShellExecutorStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly cluster: ecs.Cluster;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  public readonly resultsBucket: s3.Bucket;
  public readonly subnetIds: string[];

  constructor(scope: Construct, id: string, props?: ShellExecutorStackProps) {
    super(scope, id, props);

    // Isolated VPC with private subnets + NAT for outbound internet access.
    this.vpc = new ec2.Vpc(this, 'ShellExecutorVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    this.subnetIds = this.vpc.privateSubnets.map((s) => s.subnetId);

    this.cluster = new ecs.Cluster(this, 'ShellExecutorCluster', {
      vpc: this.vpc,
      containerInsights: true,
      clusterName: SHELL_EXECUTOR_TASK_FAMILY,
    });

    // Private, short-lived results bucket (executor uploads via presigned PUT).
    this.resultsBucket = new s3.Bucket(this, 'ShellExecutorResultsBucket', {
      bucketName: `${RESOURCE_PREFIXES.BUCKET}-shell-results-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'expire-shell-results-fast',
          enabled: true,
          expiration: cdk.Duration.days(1),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
        {
          id: 'expire-shell-jobs-fast',
          enabled: true,
          prefix: 'shell-jobs/',
          expiration: cdk.Duration.days(1),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Security group: no inbound; outbound limited (HTTPS + DNS).
    this.securityGroup = new ec2.SecurityGroup(this, 'ShellExecutorSg', {
      vpc: this.vpc,
      allowAllOutbound: false,
      description: 'Egress-restricted SG for shell executor tasks',
    });

    // HTTPS egress only (S3 presigned PUT, ECR, Logs, etc.)
    this.securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS outbound');
    this.securityGroup.addEgressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(443), 'Allow HTTPS outbound (IPv6)');

    // DNS to VPC resolver (required for hostname resolution when egress is restricted).
    // Note: AWS resolver is available at the VPC base+2 IP; allowing to the VPC CIDR is the simplest.
    this.securityGroup.addEgressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.udp(53), 'Allow DNS UDP within VPC');
    this.securityGroup.addEgressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(53), 'Allow DNS TCP within VPC');

    const logGroup = new logs.LogGroup(this, 'ShellExecutorLogGroup', {
      logGroupName: `/aws/ecs/${SHELL_EXECUTOR_TASK_FAMILY}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'ShellExecutorTaskDef', {
      cpu: 512,
      memoryLimitMiB: 1024,
      family: SHELL_EXECUTOR_TASK_FAMILY,
      // NOTE: CDK will create a task role by default. We will remove TaskRoleArn
      // from the synthesized CFN so tasks run without an attached IAM role.
    });

    // Escape hatch: remove taskRoleArn to avoid injecting AWS credentials into the task.
    const cfnTaskDef = this.taskDefinition.node.defaultChild as ecs.CfnTaskDefinition;
    cfnTaskDef.addPropertyDeletionOverride('TaskRoleArn');

    // Ephemeral writable volume for /workspace (root FS is read-only).
    this.taskDefinition.addVolume({ name: 'workspace' });

    const container = this.taskDefinition.addContainer('runner', {
      // IMPORTANT: Force-build an x86_64 (linux/amd64) image. Without this, Docker
      // may build an ARM64 image on Apple Silicon, which will fail on x86_64
      // Fargate with: "exec /usr/local/bin/node: exec format error".
      image: ecs.ContainerImage.fromAsset('../backend/shell-executor', {
        platform: ecrAssets.Platform.LINUX_AMD64,
      }),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'shell-executor',
        logGroup,
      }),
      // Allow writing to /tmp and other standard paths. We still mount /workspace,
      // drop ALL Linux capabilities, remove taskRoleArn, and restrict egress.
      readonlyRootFilesystem: false,
      environment: {
        // Defaults; job request can override via timeout_ms.
        SHELL_EXECUTOR_TIMEOUT_MS: String(1_200_000), // 20 minutes
        SHELL_EXECUTOR_MAX_STDOUT_BYTES: String(10 * 1024 * 1024), // 10MB
        SHELL_EXECUTOR_MAX_STDERR_BYTES: String(10 * 1024 * 1024), // 10MB
      },
    });

    container.addMountPoints({
      containerPath: '/workspace',
      sourceVolume: 'workspace',
      readOnly: false,
    });

    // Defense-in-depth: drop all Linux capabilities.
    // CDK doesn't currently expose `capabilities.drop`, so use an L1 override.
    // We only have a single container, so index 0 is stable.
    cfnTaskDef.addPropertyOverride('ContainerDefinitions.0.LinuxParameters.Capabilities.Drop', ['ALL']);

    new cdk.CfnOutput(this, 'ShellExecutorClusterArn', {
      value: this.cluster.clusterArn,
      exportName: 'ShellExecutorClusterArn',
    });

    // Export a stable identifier (family), NOT the revisioned TaskDefinition ARN.
    new cdk.CfnOutput(this, 'ShellExecutorTaskDefinitionFamily', {
      value: SHELL_EXECUTOR_TASK_FAMILY,
      exportName: 'ShellExecutorTaskDefinitionFamily',
    });

    new cdk.CfnOutput(this, 'ShellExecutorSecurityGroupId', {
      value: this.securityGroup.securityGroupId,
      exportName: 'ShellExecutorSecurityGroupId',
    });

    new cdk.CfnOutput(this, 'ShellExecutorSubnetIds', {
      value: this.subnetIds.join(','),
      exportName: 'ShellExecutorSubnetIds',
    });

    new cdk.CfnOutput(this, 'ShellExecutorResultsBucketName', {
      value: this.resultsBucket.bucketName,
      exportName: 'ShellExecutorResultsBucketName',
    });

    // Aggressive-ish alarms (best-effort; adjust thresholds to your traffic).
    const runningTasksMetric = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'RunningTaskCount',
      dimensionsMap: {
        ClusterName: this.cluster.clusterName,
      },
      statistic: 'Maximum',
      period: cdk.Duration.minutes(5),
    });

    new cloudwatch.Alarm(this, 'ShellExecutorRunningTasksHigh', {
      alarmName: 'leadmagnet-shell-executor-running-tasks-high',
      alarmDescription: 'Shell executor running task count is unusually high (possible abuse/cost spike)',
      metric: runningTasksMetric,
      threshold: 25,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const pendingTasksMetric = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'PendingTaskCount',
      dimensionsMap: {
        ClusterName: this.cluster.clusterName,
      },
      statistic: 'Maximum',
      period: cdk.Duration.minutes(5),
    });

    new cloudwatch.Alarm(this, 'ShellExecutorPendingTasksHigh', {
      alarmName: 'leadmagnet-shell-executor-pending-tasks-high',
      alarmDescription: 'Shell executor pending tasks are backing up (capacity/concurrency issue)',
      metric: pendingTasksMetric,
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}


