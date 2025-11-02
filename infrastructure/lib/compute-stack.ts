import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ComputeStackProps extends cdk.StackProps {
  tablesMap: Record<string, dynamodb.Table>;
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

    this.jobProcessorLambda = new lambda.Function(this, 'JobProcessorLambda', {
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
            'pip install --platform manylinux2014_x86_64 --implementation cp --python-version 3.11 --only-binary=:all: --upgrade --target /asset-output -r requirements.txt && cp -r /asset-input/* /asset-output/'
          ],
        },
        // If Docker is not available during CDK synth, you can:
        // 1. Pre-build using: ./scripts/build-lambda-worker.sh
        // 2. Use the zip file directly: lambda.Code.fromAsset('path/to/pre-built.zip')
      }),
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      environment: {
        WORKFLOWS_TABLE: props.tablesMap.workflows.tableName,
        FORMS_TABLE: props.tablesMap.forms.tableName,
        SUBMISSIONS_TABLE: props.tablesMap.submissions.tableName,
        JOBS_TABLE: props.tablesMap.jobs.tableName,
        ARTIFACTS_TABLE: props.tablesMap.artifacts.tableName,
        TEMPLATES_TABLE: props.tablesMap.templates.tableName,
        USER_SETTINGS_TABLE: props.tablesMap.userSettings.tableName,
        USAGE_RECORDS_TABLE: props.tablesMap.usageRecords.tableName,
        ARTIFACTS_BUCKET: props.artifactsBucket.bucketName,
        CLOUDFRONT_DOMAIN: props.cloudfrontDomain || '',
        OPENAI_SECRET_NAME: 'leadmagnet/openai-api-key',
        LOG_LEVEL: 'info',
        AWS_REGION: this.region,
      },
      logGroup: logGroup,
    });

    // Grant DynamoDB permissions
    Object.values(props.tablesMap).forEach((table) => {
      table.grantReadWriteData(this.jobProcessorLambda);
    });

    // Grant S3 permissions
    props.artifactsBucket.grantReadWrite(this.jobProcessorLambda);

    // Grant Secrets Manager permissions
    const openaiSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'OpenAISecret',
      'leadmagnet/openai-api-key'
    );
    openaiSecret.grantRead(this.jobProcessorLambda);

    // Create IAM role for Step Functions
    const stateMachineRole = new iam.Role(this, 'StateMachineRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });

    // Grant DynamoDB permissions to Step Functions
    Object.values(props.tablesMap).forEach((table) => {
      table.grantReadWriteData(stateMachineRole);
    });

    // Grant S3 permissions to Step Functions
    props.artifactsBucket.grantReadWrite(stateMachineRole);

    // Grant Lambda invoke permissions to Step Functions
    this.jobProcessorLambda.grantInvoke(stateMachineRole);

    // Simple Step Functions State Machine
    // Update job status to processing
    const updateJobStatus = new tasks.DynamoUpdateItem(this, 'UpdateJobStatus', {
      table: props.tablesMap.jobs,
      key: {
        job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.job_id')),
      },
      updateExpression: 'SET #status = :status, updated_at = :updated_at',
      expressionAttributeNames: {
        '#status': 'status',
      },
      expressionAttributeValues: {
        ':status': tasks.DynamoAttributeValue.fromString('processing'),
        ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
      },
      resultPath: '$.updateResult',
    });

    // Update job status to failed
    const handleFailure = new tasks.DynamoUpdateItem(this, 'HandleFailure', {
      table: props.tablesMap.jobs,
      key: {
        job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.job_id')),
      },
      updateExpression: 'SET #status = :status, error_message = :error, updated_at = :updated_at',
      expressionAttributeNames: {
        '#status': 'status',
      },
      expressionAttributeValues: {
        ':status': tasks.DynamoAttributeValue.fromString('failed'),
        ':error': tasks.DynamoAttributeValue.fromString('Error occurred'),
        ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
      },
    });

    // Process job using Lambda function
    const processJob = new tasks.LambdaInvoke(this, 'ProcessJob', {
      lambdaFunction: this.jobProcessorLambda,
      payload: sfn.TaskInput.fromObject({
        'job_id': sfn.JsonPath.stringAt('$.job_id'),
      }),
      resultPath: '$.processResult',
      retryOnServiceExceptions: false,
    });
    
    // Add error handling for Lambda failures
    processJob.addCatch(handleFailure, {
      resultPath: '$.error',
      errors: ['States.ALL'],
    });

    // Update job status to completed
    const handleSuccess = new tasks.DynamoUpdateItem(this, 'HandleSuccess', {
      table: props.tablesMap.jobs,
      key: {
        job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.job_id')),
      },
      updateExpression: 'SET #status = :status, completed_at = :completed_at, updated_at = :updated_at',
      expressionAttributeNames: {
        '#status': 'status',
      },
      expressionAttributeValues: {
        ':status': tasks.DynamoAttributeValue.fromString('completed'),
        ':completed_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
        ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
      },
    });

    // Define workflow: Update status -> Process job -> Handle success
    const definition = updateJobStatus
      .next(processJob)
      .next(handleSuccess);

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
