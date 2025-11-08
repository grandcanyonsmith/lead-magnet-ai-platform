import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { TableMap } from './types';
import { createLambdaWithTables, grantSecretsAccess, grantDynamoDBPermissions, grantS3Permissions } from './utils/lambda-helpers';
import { createJobProcessorStateMachine } from './stepfunctions/job-processor-state-machine';

export interface ComputeStackProps extends cdk.StackProps {
  tablesMap: TableMap;
  artifactsBucket: s3.Bucket;
  cloudfrontDomain?: string;  // Optional CloudFront distribution domain
}

export class ComputeStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine;
  public readonly stateMachineArn: string;
  public readonly jobProcessorLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // Create Lambda function for job processing
    const logGroup = new logs.LogGroup(this, 'JobProcessorLogGroup', {
      logGroupName: '/aws/lambda/leadmagnet-job-processor',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.jobProcessorLambda = createLambdaWithTables(
      this,
      'JobProcessorLambda',
      props.tablesMap,
      props.artifactsBucket,
      {
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: 'lambda_handler.lambda_handler',
        code: lambda.Code.fromAsset('../backend/worker', {
          // Use bundling without Docker if available, otherwise skip bundling
          // If Docker is not available, you can pre-build the package using:
          // ./scripts/build-lambda-worker.sh
          bundling: {
            image: lambda.Runtime.PYTHON_3_11.bundlingImage,
            command: [
              'bash', '-c',
              'pip install --platform manylinux2014_x86_64 --implementation cp --python-version 3.11 --only-binary=:all: --upgrade --target /asset-output -r requirements.txt && cp -r /asset-input/*.py /asset-output/ 2>/dev/null || true && cp -r /asset-input/services /asset-output/ 2>/dev/null || true && cp -r /asset-input/utils /asset-output/ 2>/dev/null || true'
            ],
          },
          // If Docker is not available during CDK synth, you can:
          // 1. Pre-build using: ./scripts/build-lambda-worker.sh
          // 2. Use the zip file directly: lambda.Code.fromAsset('path/to/pre-built.zip')
        }),
        timeout: cdk.Duration.minutes(15), // Maximum Lambda timeout
        memorySize: 2048,
        environment: {
          CLOUDFRONT_DOMAIN: props.cloudfrontDomain || '',
          OPENAI_SECRET_NAME: 'leadmagnet/openai-api-key',
          TWILIO_SECRET_NAME: 'leadmagnet/twilio-credentials',
          LOG_LEVEL: 'info',
          // AWS_REGION is automatically set by Lambda runtime
        },
        logGroup: logGroup,
      }
    );

    // Explicitly ensure usage_records table has PutItem permission (for usage tracking)
    props.tablesMap.usageRecords.grantWriteData(this.jobProcessorLambda);

    // Grant Secrets Manager permissions
    grantSecretsAccess(
      this.jobProcessorLambda,
      this,
      ['leadmagnet/openai-api-key', 'leadmagnet/twilio-credentials']
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
    this.jobProcessorLambda.grantInvoke(stateMachineRole);

    // Create Step Functions state machine definition
    const definition = createJobProcessorStateMachine(this, {
      jobsTable: props.tablesMap.jobs,
      workflowsTable: props.tablesMap.workflows,
      jobProcessorLambda: this.jobProcessorLambda,
    });

    // Create State Machine
    this.stateMachine = new sfn.StateMachine(this, 'JobProcessorStateMachine', {
      stateMachineName: 'leadmagnet-job-processor',
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      role: stateMachineRole,
      logs: {
        destination: new logs.LogGroup(this, 'StateMachineLogGroup', {
          logGroupName: '/aws/stepfunctions/leadmagnet-job-processor',
          retention: logs.RetentionDays.ONE_WEEK,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
        level: sfn.LogLevel.ALL,
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
