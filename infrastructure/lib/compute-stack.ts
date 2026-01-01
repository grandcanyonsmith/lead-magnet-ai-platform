import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { TableMap, TableKey } from './types';
import { createLambdaWithTables, grantSecretsAccess, grantDynamoDBPermissions, grantS3Permissions } from './utils/lambda-helpers';
import { createJobProcessorStateMachine } from './stepfunctions/job-processor-state-machine';
import { SECRET_NAMES, LAMBDA_DEFAULTS, ENV_VAR_NAMES, DEFAULT_LOG_LEVEL, PLAYWRIGHT_BROWSERS_PATH, RESOURCE_PREFIXES, STEP_FUNCTIONS_DEFAULTS } from './config/constants';

export interface ComputeStackProps extends cdk.StackProps {
  tablesMap: TableMap;
  artifactsBucket: s3.Bucket;
  cloudfrontDomain?: string;  // Optional CloudFront distribution domain
  ecrRepository?: ecr.IRepository;  // Optional ECR repository for container image
  shellExecutor?: {
    clusterArn: string;
    taskDefinitionFamily: string;
    executionRoleArn?: string;
    securityGroupId: string;
    subnetIds: string[];
    resultsBucketName: string;
  };
}

export class ComputeStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine;
  public readonly stateMachineArn: string;
  public readonly jobProcessorLambda: lambda.IFunction;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // Create Lambda function for job processing
    const logGroup = new logs.LogGroup(this, 'JobProcessorLogGroup', {
      logGroupName: '/aws/lambda/leadmagnet-job-processor',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Dead Letter Queue for job processor
    const dlq = new sqs.Queue(this, 'JobProcessorDlq', {
      queueName: 'leadmagnet-job-processor-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
    });

        // Use container image if ECR repository is provided, otherwise use zip deployment
        const lambdaEnv = {
          [ENV_VAR_NAMES.CLOUDFRONT_DOMAIN]: props.cloudfrontDomain || '',
          [ENV_VAR_NAMES.OPENAI_SECRET_NAME]: SECRET_NAMES.OPENAI_API_KEY,
          [ENV_VAR_NAMES.TWILIO_SECRET_NAME]: SECRET_NAMES.TWILIO_CREDENTIALS,
          [ENV_VAR_NAMES.LOG_LEVEL]: DEFAULT_LOG_LEVEL,
          // AWS_REGION is automatically set by Lambda runtime
          // Playwright environment variables
          // Set browsers path to match Dockerfile installation location
          [ENV_VAR_NAMES.PLAYWRIGHT_BROWSERS_PATH]: PLAYWRIGHT_BROWSERS_PATH,
          ...(props.shellExecutor ? {
            [ENV_VAR_NAMES.SHELL_EXECUTOR_RESULTS_BUCKET]: props.shellExecutor.resultsBucketName,
            [ENV_VAR_NAMES.SHELL_EXECUTOR_CLUSTER_ARN]: props.shellExecutor.clusterArn,
            // ECS RunTask accepts either full ARN or family[:revision]. We intentionally use the stable family.
            [ENV_VAR_NAMES.SHELL_EXECUTOR_TASK_DEFINITION_ARN]: props.shellExecutor.taskDefinitionFamily,
            [ENV_VAR_NAMES.SHELL_EXECUTOR_SECURITY_GROUP_ID]: props.shellExecutor.securityGroupId,
            [ENV_VAR_NAMES.SHELL_EXECUTOR_SUBNET_IDS]: props.shellExecutor.subnetIds.join(','),
          } : {}),
        };
        
        if (props.ecrRepository) {
          // Use container image (required for Playwright with proper GLIBC)
          // Explicitly type as DockerImageCode to ensure type is preserved
          const dockerCode: lambda.DockerImageCode = lambda.DockerImageCode.fromEcr(props.ecrRepository, {
            tagOrDigest: 'latest',
          });
          
          this.jobProcessorLambda = createLambdaWithTables(
            this,
            'JobProcessorLambda',
            props.tablesMap,
            props.artifactsBucket,
            {
              code: dockerCode,
              timeout: cdk.Duration.minutes(LAMBDA_DEFAULTS.JOB_PROCESSOR.TIMEOUT_MINUTES),
              memorySize: LAMBDA_DEFAULTS.JOB_PROCESSOR.MEMORY_SIZE,
              environment: lambdaEnv,
              logGroup: logGroup,
              tracing: lambda.Tracing.ACTIVE,
              deadLetterQueue: dlq,
            }
          );
        } else {
          // Fallback to zip deployment (will have GLIBC issues with Playwright)
          const zipCode = lambda.Code.fromAsset('../backend/worker', {
            bundling: {
              image: lambda.Runtime.PYTHON_3_11.bundlingImage,
              command: [
                'bash', '-c',
                'pip install --platform manylinux2014_x86_64 --implementation cp --python-version 3.11 --only-binary=:all: --upgrade --target /asset-output -r requirements.txt && cp -r /asset-input/*.py /asset-output/ 2>/dev/null || true && cp -r /asset-input/services /asset-output/ 2>/dev/null || true && cp -r /asset-input/utils /asset-output/ 2>/dev/null || true'
              ],
            },
          });
          
          this.jobProcessorLambda = createLambdaWithTables(
            this,
            'JobProcessorLambda',
            props.tablesMap,
            props.artifactsBucket,
            {
              runtime: lambda.Runtime.PYTHON_3_11,
              handler: 'lambda_handler.lambda_handler',
              code: zipCode,
              timeout: cdk.Duration.minutes(LAMBDA_DEFAULTS.JOB_PROCESSOR.TIMEOUT_MINUTES),
              memorySize: LAMBDA_DEFAULTS.JOB_PROCESSOR.MEMORY_SIZE,
              environment: lambdaEnv,
              logGroup: logGroup,
              tracing: lambda.Tracing.ACTIVE,
              deadLetterQueue: dlq,
            }
          );
        }

    // Explicitly ensure usage_records table has PutItem permission (for usage tracking)
    props.tablesMap[TableKey.USAGE_RECORDS].grantWriteData(this.jobProcessorLambda);

    // Grant Secrets Manager permissions
    grantSecretsAccess(
      this.jobProcessorLambda,
      this,
      [SECRET_NAMES.OPENAI_API_KEY, SECRET_NAMES.TWILIO_CREDENTIALS]
    );

    // Shell executor permissions (if configured): allow job processor to run ECS tasks and poll the results bucket.
    if (props.shellExecutor) {
      const shellResultsBucket = s3.Bucket.fromBucketName(this, 'ShellExecutorResultsBucket', props.shellExecutor.resultsBucketName);
      shellResultsBucket.grantReadWrite(this.jobProcessorLambda);

      this.jobProcessorLambda.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ecs:RunTask', 'ecs:DescribeTaskDefinition'],
          resources: [
            cdk.Stack.of(this).formatArn({
              service: 'ecs',
              resource: 'task-definition',
              resourceName: `${props.shellExecutor.taskDefinitionFamily}:*`,
            }),
          ],
        })
      );
      this.jobProcessorLambda.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ecs:DescribeTasks', 'ecs:StopTask'],
          resources: ['*'],
        })
      );

      const execRoleArn = props.shellExecutor.executionRoleArn;
      if (execRoleArn) {
        this.jobProcessorLambda.addToRolePolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iam:PassRole'],
            resources: [execRoleArn],
          })
        );
      }
    }

    // Shell tool: allow the worker to sign presigned PUT URLs for controlled uploads to an allowlisted bucket.
    // This is required because presigned URLs are authorized as the signing principal at request time.
    // Scope tightly to a dedicated prefix.
    this.jobProcessorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject'],
        resources: ['arn:aws:s3:::cc360-pages/leadmagnet/*'],
      })
    );

    // Create IAM role for Step Functions
    const stateMachineRole = new iam.Role(this, 'StateMachineRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });

    // Grant DynamoDB permissions to Step Functions
    grantDynamoDBPermissions(stateMachineRole, props.tablesMap);

    // Grant S3 permissions to Step Functions
    grantS3Permissions(stateMachineRole, props.artifactsBucket);

    // Grant Lambda invoke permissions to Step Functions
    stateMachineRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [this.jobProcessorLambda.functionArn],
      })
    );

    // Create Step Functions state machine definition
    const definition = createJobProcessorStateMachine(this, {
      jobsTable: props.tablesMap[TableKey.JOBS],
      workflowsTable: props.tablesMap[TableKey.WORKFLOWS],
      jobProcessorLambda: this.jobProcessorLambda,
    });

    // Create State Machine
    this.stateMachine = new sfn.StateMachine(this, 'JobProcessorStateMachine', {
      stateMachineName: RESOURCE_PREFIXES.STATE_MACHINE,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      role: stateMachineRole,
      logs: {
        destination: new logs.LogGroup(this, 'StateMachineLogGroup', {
          logGroupName: `/aws/stepfunctions/${RESOURCE_PREFIXES.STATE_MACHINE}`,
          retention: logs.RetentionDays.ONE_WEEK,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
        level: sfn.LogLevel[STEP_FUNCTIONS_DEFAULTS.LOG_LEVEL as keyof typeof sfn.LogLevel],
        includeExecutionData: true,
      },
      tracingEnabled: true,
    });

    this.stateMachineArn = this.stateMachine.stateMachineArn;

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      exportName: 'StateMachineArn',
    });

    new cdk.CfnOutput(this, 'JobProcessorLambdaArn', {
      value: this.jobProcessorLambda.functionArn,
      exportName: 'JobProcessorLambdaArn',
    });
  }
}
