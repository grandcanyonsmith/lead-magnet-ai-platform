import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface ShellExecutorStackProps extends cdk.StackProps {
  // No cross-stack dependencies required for the executor itself.
}

/**
 * ShellExecutorStack
 *
 * Provisions an isolated Lambda environment + EFS for running
 * model-requested shell commands as synchronous invocations.
 * Replaces the legacy ECS Fargate implementation.
 */
export class ShellExecutorStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly fileSystem: efs.FileSystem;
  public readonly executorFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: ShellExecutorStackProps) {
    super(scope, id, props);

    // Isolated VPC with private subnets + NAT for outbound internet access.
    // Required for pip install, curl, etc.
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
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3,
        },
      },
    });

    // Security group for Lambda
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'ShellExecutorLambdaSg', {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'SG for shell executor lambda',
    });

    // EFS Security Group
    const efsSecurityGroup = new ec2.SecurityGroup(this, 'ShellExecutorEfsSg', {
      vpc: this.vpc,
      description: 'Security group for shell executor EFS filesystem',
    });

    // Allow Lambda to access EFS via NFS (TCP 2049)
    efsSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(2049),
      'Allow NFS from shell executor lambda',
    );

    this.fileSystem = new efs.FileSystem(this, 'ShellExecutorEfs', {
      vpc: this.vpc,
      encrypted: true,
      securityGroup: efsSecurityGroup,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Access point ensures a stable root directory and correct ownership
    const accessPoint = new efs.AccessPoint(this, 'ShellExecutorEfsAccessPoint', {
      fileSystem: this.fileSystem,
      path: '/shell-executor',
      posixUser: { uid: '1000', gid: '1000' },
      createAcl: {
        ownerUid: '1000',
        ownerGid: '1000',
        permissions: '750',
      },
    });

    const logGroup = new logs.LogGroup(this, 'ShellExecutorLogGroup', {
      logGroupName: `/aws/lambda/leadmagnet-shell-executor`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // The Executor Lambda
    // Mounts EFS to /mnt/shell-executor
    this.executorFunction = new lambda.Function(this, 'ShellExecutorFunction', {
      functionName: 'leadmagnet-shell-executor',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'services.shell.executor_handler.handler',
      code: lambda.Code.fromAsset('../backend/worker', {
        exclude: [
          '**/.venv', 
          '**/venv', 
          '**/__pycache__', 
          '**/*.pyc', 
          '**/node_modules',
          '**/tests',
          'Dockerfile',
          '.dockerignore',
          'README.md',
          'shell-executor' // Exclude the old runner code if it exists there
        ]
      }),
      memorySize: 1024,
      timeout: cdk.Duration.minutes(60), // Increased to 60 minutes
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSecurityGroup],
      filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/shell-executor'),
      environment: {
        EFS_MOUNT_POINT: '/mnt/shell-executor',
        HOME: '/mnt/shell-executor', // Useful for some tools
      },
      logGroup,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ShellExecutorFunctionArn', {
      value: this.executorFunction.functionArn,
      exportName: 'ShellExecutorFunctionArn',
    });

    new cdk.CfnOutput(this, 'ShellExecutorFunctionName', {
      value: this.executorFunction.functionName,
      exportName: 'ShellExecutorFunctionName',
    });

    // NOTE: ShellExecutorResultsBucket export was removed as the shell executor
    // was migrated from ECS Fargate (which used S3) to Lambda (which doesn't need S3).
    // If deployment fails with "Cannot delete export... as it is in use", you need to:
    // 1. Manually remove the import references from leadmagnet-api and leadmagnet-compute stacks in CloudFormation
    // 2. Or temporarily add back the export below, deploy, then remove imports, then remove export again
    
    // Temporary fix for circular dependency during migration
    const artifactsBucket = s3.Bucket.fromBucketName(this, 'ArtifactsBucket', 'leadmagnet-artifacts-471112574622');
    new cdk.CfnOutput(this, 'ShellExecutorResultsBucket', {
      value: artifactsBucket.bucketName,
      exportName: 'leadmagnet-shell-executor:ExportsOutputRefShellExecutorResultsBucket1A1277A82A874BA3',
    });
  }
}
