import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
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

    // Access point ensures a stable root directory and correct ownership.
    // Use a versioned path to avoid stale permissions from previous deployments.
    const accessPoint = new efs.AccessPoint(this, 'ShellExecutorEfsAccessPoint', {
      fileSystem: this.fileSystem,
      path: '/shell-executor-v2',
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
      // AWS Lambda max memory is 10,240 MB (10 GB).
      memorySize: 10240,
      // Give /tmp fallback extra headroom if EFS is unavailable.
      ephemeralStorageSize: cdk.Size.gibibytes(10),
      timeout: cdk.Duration.minutes(15), // Max allowed by Lambda
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSecurityGroup],
      filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/shell-executor'),
      environment: {
        EFS_MOUNT_POINT: '/mnt/shell-executor',
        HOME: '/mnt/shell-executor', // Useful for some tools
        SHELL_EXECUTOR_UPLOAD_MODE: process.env.SHELL_EXECUTOR_UPLOAD_MODE || 'dist',
        SHELL_EXECUTOR_UPLOAD_BUCKET: process.env.SHELL_EXECUTOR_UPLOAD_BUCKET || 'coursecreator360-rich-snippet-booster',
        SHELL_EXECUTOR_MANIFEST_NAME: process.env.SHELL_EXECUTOR_MANIFEST_NAME || 'shell_executor_manifest.json',
        SHELL_EXECUTOR_UPLOAD_PREFIX: process.env.SHELL_EXECUTOR_UPLOAD_PREFIX || '',
        SHELL_EXECUTOR_UPLOAD_PREFIX_TEMPLATE: process.env.SHELL_EXECUTOR_UPLOAD_PREFIX_TEMPLATE || 'jobs/{tenant_id}/{job_id}/',
        SHELL_EXECUTOR_UPLOAD_DIST_SUBDIR: process.env.SHELL_EXECUTOR_UPLOAD_DIST_SUBDIR || 'dist',
        SHELL_EXECUTOR_UPLOAD_ACL: process.env.SHELL_EXECUTOR_UPLOAD_ACL || '',
        SHELL_EXECUTOR_REWRITE_WORK_PATHS: process.env.SHELL_EXECUTOR_REWRITE_WORK_PATHS || 'true',
        SHELL_EXECUTOR_WORK_ROOT: process.env.SHELL_EXECUTOR_WORK_ROOT || '/work',
        // Clean up stale workspaces to avoid unbounded EFS growth.
        SHELL_EXECUTOR_WORKSPACE_TTL_HOURS: process.env.SHELL_EXECUTOR_WORKSPACE_TTL_HOURS || '168',
      },
      logGroup,
    });

    // Grant IAM permissions for S3 access (including cross-region)
    // The shell executor needs to upload files to S3 buckets
    this.executorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:PutObject',
          's3:GetObject',
          's3:DeleteObject',
          's3:ListBucket',
          's3:PutObjectAcl',
        ],
        resources: [
          // Allow access to all S3 buckets (including cross-region)
          'arn:aws:s3:::*',
          'arn:aws:s3:::*/*',
        ],
      })
    );

    const uploadBucketName = (process.env.SHELL_EXECUTOR_UPLOAD_BUCKET || 'coursecreator360-rich-snippet-booster').trim();
    if (uploadBucketName) {
      const publicAccessBlock = new cr.AwsCustomResource(this, 'ShellExecutorUploadBucketPublicAccess', {
        onCreate: {
          service: 'S3',
          action: 'putPublicAccessBlock',
          parameters: {
            Bucket: uploadBucketName,
            PublicAccessBlockConfiguration: {
              BlockPublicAcls: false,
              IgnorePublicAcls: false,
              BlockPublicPolicy: false,
              RestrictPublicBuckets: false,
            },
          },
          physicalResourceId: cr.PhysicalResourceId.of(`${uploadBucketName}-public-access`),
        },
        onUpdate: {
          service: 'S3',
          action: 'putPublicAccessBlock',
          parameters: {
            Bucket: uploadBucketName,
            PublicAccessBlockConfiguration: {
              BlockPublicAcls: false,
              IgnorePublicAcls: false,
              BlockPublicPolicy: false,
              RestrictPublicBuckets: false,
            },
          },
          physicalResourceId: cr.PhysicalResourceId.of(`${uploadBucketName}-public-access`),
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:PutBucketPublicAccessBlock'],
            resources: [`arn:aws:s3:::${uploadBucketName}`],
          }),
        ]),
      });

      const publicReadPolicy = new s3.CfnBucketPolicy(this, 'ShellExecutorUploadBucketPolicy', {
        bucket: uploadBucketName,
        policyDocument: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: 'PublicReadShellExecutorUploads',
              effect: iam.Effect.ALLOW,
              principals: [new iam.AnyPrincipal()],
              actions: ['s3:GetObject'],
              resources: [`arn:aws:s3:::${uploadBucketName}/*`],
            }),
          ],
        }).toJSON(),
      });

      publicReadPolicy.node.addDependency(publicAccessBlock);
    }

    // Grant permissions for CloudWatch Logs (for logging)
    this.executorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:*`,
          // Also allow cross-region logging if needed
          'arn:aws:logs:*:*:*',
        ],
      })
    );

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

    // --------------------------------------------------------------------------------
    // TEMPORARY EXPORTS FOR MIGRATION (REMOVE AFTER DEPENDENT STACKS UPDATE)
    // --------------------------------------------------------------------------------

    // 1. ShellExecutorResultsBucket (Must match original bucket name to avoid update failure)
    const resultsBucketName =
      (process.env.SHELL_EXECUTOR_LEGACY_RESULTS_BUCKET || "").trim() ||
      (process.env.SHELL_EXECUTOR_RESULTS_BUCKET || "").trim() ||
      `leadmagnet-artifacts-shell-results-${this.account}`;
    const artifactsBucket = s3.Bucket.fromBucketName(this, 'ArtifactsBucket', resultsBucketName);
    new cdk.CfnOutput(this, 'ShellExecutorResultsBucket', {
      value: artifactsBucket.bucketName,
      exportName: 'leadmagnet-shell-executor:ExportsOutputRefShellExecutorResultsBucket1A1277A82A874BA3',
    });

    // 2. TaskDefExecutionRole (must match legacy ECS execution role ARN if still imported)
    const legacyExecutionRoleArn =
      (process.env.SHELL_EXECUTOR_LEGACY_TASK_EXECUTION_ROLE_ARN || "").trim() ||
      (process.env.SHELL_EXECUTOR_TASK_EXECUTION_ROLE_ARN || "").trim() ||
      this.executorFunction.role!.roleArn;
    new cdk.CfnOutput(this, 'TempTaskDefExecutionRoleExport', {
      value: legacyExecutionRoleArn, 
      exportName: 'leadmagnet-shell-executor:ExportsOutputFnGetAttShellExecutorTaskDefExecutionRole2061D40FArnEF3C7B62',
    });

    const legacySubnetIdsRaw =
      (process.env.SHELL_EXECUTOR_LEGACY_SUBNET_IDS || "").trim() ||
      (process.env.SHELL_EXECUTOR_SUBNET_IDS || "").trim();
    const legacySubnetIds = legacySubnetIdsRaw
      ? legacySubnetIdsRaw.split(',').map((id) => id.trim()).filter(Boolean)
      : [];
    const legacySubnet1 = legacySubnetIds[0] || this.vpc.privateSubnets[0].subnetId;
    const legacySubnet2 =
      legacySubnetIds[1] || this.vpc.privateSubnets[1]?.subnetId || legacySubnet1;

    // 3. Subnet (privateSubnet2)
    new cdk.CfnOutput(this, 'TempSubnetExport', {
      value: legacySubnet2, 
      exportName: 'leadmagnet-shell-executor:ExportsOutputRefShellExecutorVpcprivateSubnet2Subnet9C03EAE70B440DB7',
    });

    // 4. Subnet 1 (privateSubnet1)
    new cdk.CfnOutput(this, 'TempSubnet1Export', {
      value: legacySubnet1, 
      exportName: 'leadmagnet-shell-executor:ExportsOutputRefShellExecutorVpcprivateSubnet1Subnet3CF6940C36DE374C',
    });

    const legacyClusterName =
      (process.env.SHELL_EXECUTOR_LEGACY_CLUSTER_NAME || "").trim() ||
      'leadmagnet-shell-executor';
    const legacyClusterArn =
      (process.env.SHELL_EXECUTOR_LEGACY_CLUSTER_ARN || "").trim() ||
      `arn:aws:ecs:${this.region}:${this.account}:cluster/${legacyClusterName}`;

    // 5. Cluster (ARN)
    new cdk.CfnOutput(this, 'TempClusterExport', {
      value: legacyClusterArn, 
      exportName: 'leadmagnet-shell-executor:ExportsOutputFnGetAttShellExecutorClusterDAF8CA4DArnE9D855C2',
    });

    // 6. Cluster (Ref/Name)
    new cdk.CfnOutput(this, 'TempClusterRefExport', {
      value: legacyClusterName, 
      exportName: 'leadmagnet-shell-executor:ExportsOutputRefShellExecutorClusterDAF8CA4D8DB2C0E8',
    });

    const legacySecurityGroupId =
      (process.env.SHELL_EXECUTOR_LEGACY_SECURITY_GROUP_ID || "").trim() ||
      (process.env.SHELL_EXECUTOR_SECURITY_GROUP_ID || "").trim() ||
      lambdaSecurityGroup.securityGroupId;

    // 7. Security Group
    new cdk.CfnOutput(this, 'TempSgExport', {
      value: legacySecurityGroupId, 
      exportName: 'leadmagnet-shell-executor:ExportsOutputFnGetAttShellExecutorSgC8E8070CGroupIdDB92116B',
    });
  }
}
