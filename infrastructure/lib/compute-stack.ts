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
  tablesMap: Record<string, dynamodb.ITable>;
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
      timeout: cdk.Duration.minutes(15), // Maximum Lambda timeout
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
        NOTIFICATIONS_TABLE: props.tablesMap.notifications.tableName,
        ARTIFACTS_BUCKET: props.artifactsBucket.bucketName,
        CLOUDFRONT_DOMAIN: props.cloudfrontDomain || '',
        OPENAI_SECRET_NAME: 'leadmagnet/openai-api-key',
        TWILIO_SECRET_NAME: 'leadmagnet/twilio-credentials',
        LOG_LEVEL: 'info',
        // AWS_REGION is automatically set by Lambda runtime
      },
      logGroup: logGroup,
    });

    // Grant DynamoDB permissions
    Object.values(props.tablesMap).forEach((table) => {
      table.grantReadWriteData(this.jobProcessorLambda);
    });
    
    // Explicitly ensure usage_records table has PutItem permission (for usage tracking)
    props.tablesMap.usageRecords.grantWriteData(this.jobProcessorLambda);

    // Grant S3 permissions
    props.artifactsBucket.grantReadWrite(this.jobProcessorLambda);

    // Grant Secrets Manager permissions
    const openaiSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'OpenAISecret',
      'leadmagnet/openai-api-key'
    );
    openaiSecret.grantRead(this.jobProcessorLambda);

    // Grant access to Twilio secret
    const twilioSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'TwilioSecret',
      'leadmagnet/twilio-credentials'
    );
    twilioSecret.grantRead(this.jobProcessorLambda);

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

    // Step Functions State Machine with per-step processing
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

    // Handle Lambda returning success: false (business logic failure)
    const handleStepFailure = new tasks.DynamoUpdateItem(this, 'HandleStepFailure', {
      table: props.tablesMap.jobs,
      key: {
        job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.job_id')),
      },
      updateExpression: 'SET #status = :status, error_message = :error, error_type = :error_type, updated_at = :updated_at',
      expressionAttributeNames: {
        '#status': 'status',
      },
      expressionAttributeValues: {
        ':status': tasks.DynamoAttributeValue.fromString('failed'),
        ':error': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.processResult.Payload.error')),
        ':error_type': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.processResult.Payload.error_type')),
        ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
      },
    });

    // Handle Lambda exception (timeout, etc.)
    const handleStepException = new tasks.DynamoUpdateItem(this, 'HandleStepException', {
      table: props.tablesMap.jobs,
      key: {
        job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.parsedError.job_id')),
      },
      updateExpression: 'SET #status = :status, error_message = :error, updated_at = :updated_at',
      expressionAttributeNames: {
        '#status': 'status',
      },
      expressionAttributeValues: {
        ':status': tasks.DynamoAttributeValue.fromString('failed'),
        ':error': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.parsedError.error_message')),
        ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
      },
    });

    // Parse error message from Lambda response (create separate instances for each catch handler)
    const parseErrorLegacy = new sfn.Pass(this, 'ParseErrorLegacy', {
      parameters: {
        'job_id.$': '$.job_id',
        'error_message': sfn.JsonPath.format(
          'Lambda execution failed: {} - {}',
          sfn.JsonPath.stringAt('$.error.Error'),
          sfn.JsonPath.stringAt('$.error.Cause')
        ),
      },
      resultPath: '$.parsedError',
    }).next(handleStepException);

    const parseErrorStep = new sfn.Pass(this, 'ParseErrorStep', {
      parameters: {
        'job_id.$': '$.job_id',
        'step_index.$': '$.step_index',
        'error_message': sfn.JsonPath.format(
          'Lambda execution failed: {} - {}',
          sfn.JsonPath.stringAt('$.error.Error'),
          sfn.JsonPath.stringAt('$.error.Cause')
        ),
      },
      resultPath: '$.parsedError',
    }).next(handleStepException);

    const parseErrorHTML = new sfn.Pass(this, 'ParseErrorHTML', {
      parameters: {
        'job_id.$': '$.job_id',
        'error_message': sfn.JsonPath.format(
          'Lambda execution failed: {} - {}',
          sfn.JsonPath.stringAt('$.error.Error'),
          sfn.JsonPath.stringAt('$.error.Cause')
        ),
      },
      resultPath: '$.parsedError',
    }).next(handleStepException);

    // Initialize steps: Load workflow and get step count
    const initializeSteps = new tasks.DynamoGetItem(this, 'InitializeSteps', {
      table: props.tablesMap.workflows,
      key: {
        workflow_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.workflow_id')),
      },
      resultPath: '$.workflowData',
    });

    // Process a single step using Lambda function (declared early for use in setupStepLoop)
    const processStep = new tasks.LambdaInvoke(this, 'ProcessStep', {
      lambdaFunction: this.jobProcessorLambda,
      payload: sfn.TaskInput.fromObject({
        'job_id': sfn.JsonPath.stringAt('$.job_id'),
        'step_index': sfn.JsonPath.numberAt('$.step_index'),
        'step_type': 'workflow_step',
      }),
      resultPath: '$.processResult',
      retryOnServiceExceptions: false,
    });

    // Add error handling for Lambda failures
    processStep.addCatch(parseErrorStep, {
      resultPath: '$.error',
      errors: ['States.ALL'],
    });

    // Check if more steps remain - loops back to processStep if more steps (declared before incrementStep)
    const checkMoreSteps = new sfn.Choice(this, 'CheckMoreSteps')
      .when(
        sfn.Condition.numberLessThanJsonPath('$.step_index', '$.total_steps'),
        processStep  // Loop back to process next step
      )
      .otherwise(
        new sfn.Choice(this, 'CheckTemplate')
          .when(
            sfn.Condition.booleanEquals('$.has_template', true),
            new tasks.LambdaInvoke(this, 'ProcessHTMLStep', {
              lambdaFunction: this.jobProcessorLambda,
              payload: sfn.TaskInput.fromObject({
                'job_id': sfn.JsonPath.stringAt('$.job_id'),
                'step_type': 'html_generation',
              }),
              resultPath: '$.htmlResult',
              retryOnServiceExceptions: false,
            })
              .addCatch(parseErrorHTML, {
                resultPath: '$.error',
                errors: ['States.ALL'],
              })
              .next(
                new sfn.Choice(this, 'CheckHTMLResult')
                  .when(
                    sfn.Condition.booleanEquals('$.htmlResult.Payload.success', false),
                    handleStepFailure
                  )
                  .otherwise(
                    new tasks.DynamoUpdateItem(this, 'FinalizeJobWithHTML', {
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
                    })
                  )
              )
          )
          .otherwise(
            new tasks.DynamoUpdateItem(this, 'FinalizeJobNoHTML', {
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
            })
          )
      );

    // Check if step succeeded - connects to incrementStep which connects to checkMoreSteps
    const incrementStep = new sfn.Pass(this, 'IncrementStep', {
      parameters: {
        'job_id.$': '$.job_id',
        'workflow_id.$': '$.workflow_id',
        'submission_id.$': '$.submission_id',
        'tenant_id.$': '$.tenant_id',
        'step_index.$': 'States.MathAdd($.step_index, 1)',
        'total_steps.$': '$.total_steps',
        'has_template.$': '$.has_template',
        'template_id.$': '$.template_id',
      },
      resultPath: '$',
    }).next(checkMoreSteps);

    const checkStepResult = new sfn.Choice(this, 'CheckStepResult')
      .when(
        sfn.Condition.booleanEquals('$.processResult.Payload.success', false),
        handleStepFailure
      )
      .otherwise(incrementStep);

    // Check workflow type and route accordingly (defined early for use in template checks)
    const checkWorkflowType = new sfn.Choice(this, 'CheckWorkflowType')
      .when(
        sfn.Condition.or(
          sfn.Condition.isNotPresent('$.workflowData.Item.steps'),
          sfn.Condition.numberEquals('$.steps_length', 0)
        ),
        processLegacyJob
      )
      .otherwise(setupStepLoop);

    // Set has_template to true when template exists
    const setHasTemplateTrue = new sfn.Pass(this, 'SetHasTemplateTrue', {
      parameters: {
        'job_id.$': '$.job_id',
        'workflow_id.$': '$.workflow_id',
        'submission_id.$': '$.submission_id',
        'tenant_id.$': '$.tenant_id',
        'workflowData.$': '$.workflowData',
        'steps_length.$': '$.steps_length',
        'has_template': true,
        'template_id.$': '$.template_id',
      },
      resultPath: '$',
    }).next(checkWorkflowType);

    // Set has_template to false when template doesn't exist
    const setHasTemplateFalse = new sfn.Pass(this, 'SetHasTemplateFalse', {
      parameters: {
        'job_id.$': '$.job_id',
        'workflow_id.$': '$.workflow_id',
        'submission_id.$': '$.submission_id',
        'tenant_id.$': '$.tenant_id',
        'workflowData.$': '$.workflowData',
        'steps_length.$': '$.steps_length',
        'has_template': false,
        'template_id': '',
      },
      resultPath: '$',
    }).next(checkWorkflowType);

    // Check if template exists and set has_template boolean
    const checkTemplateExists = new sfn.Choice(this, 'CheckTemplateExists')
      .when(
        sfn.Condition.isPresent('$.workflowData.Item.template_id.S'),
        setHasTemplateTrue
      )
      .otherwise(setHasTemplateFalse);

    // Compute steps length - handle both new (with steps) and legacy (without steps) workflows
    const computeStepsLengthWithSteps = new sfn.Pass(this, 'ComputeStepsLengthWithSteps', {
      parameters: {
        'job_id.$': '$.job_id',
        'workflow_id.$': '$.workflow_id',
        'submission_id.$': '$.submission_id',
        'tenant_id.$': '$.tenant_id',
        'workflowData.$': '$.workflowData',
        'steps_length.$': 'States.ArrayLength($.workflowData.Item.steps.L)',
        'template_id.$': '$.workflowData.Item.template_id.S',
      },
      resultPath: '$',
    }).next(checkTemplateExists);

    const computeStepsLengthLegacy = new sfn.Pass(this, 'ComputeStepsLengthLegacy', {
      parameters: {
        'job_id.$': '$.job_id',
        'workflow_id.$': '$.workflow_id',
        'submission_id.$': '$.submission_id',
        'tenant_id.$': '$.tenant_id',
        'workflowData.$': '$.workflowData',
        'steps_length': 0,
        'template_id.$': '$.workflowData.Item.template_id.S',
      },
      resultPath: '$',
    }).next(checkTemplateExists);

    const computeStepsLength = new sfn.Choice(this, 'ComputeStepsLength')
      .when(
        sfn.Condition.isPresent('$.workflowData.Item.steps'),
        computeStepsLengthWithSteps
      )
      .otherwise(computeStepsLengthLegacy);

    // Setup step loop for multi-step workflows
    const setupStepLoop = new sfn.Pass(this, 'SetupStepLoop', {
      parameters: {
        'job_id.$': '$.job_id',
        'workflow_id.$': '$.workflow_id',
        'submission_id.$': '$.submission_id',
        'tenant_id.$': '$.tenant_id',
        'step_index': 0,
        'total_steps.$': '$.steps_length',
        'has_template.$': '$.has_template',
        'template_id.$': '$.template_id',
      },
      resultPath: '$',
    }).next(processStep).next(checkStepResult);

    // Legacy workflow processing
    const processLegacyJob = new tasks.LambdaInvoke(this, 'ProcessLegacyJob', {
      lambdaFunction: this.jobProcessorLambda,
      payload: sfn.TaskInput.fromObject({
        'job_id': sfn.JsonPath.stringAt('$.job_id'),
      }),
      resultPath: '$.processResult',
      retryOnServiceExceptions: false,
    })
      .addCatch(parseErrorLegacy, {
        resultPath: '$.error',
        errors: ['States.ALL'],
      })
      .next(
        new sfn.Choice(this, 'CheckLegacyResult')
          .when(
            sfn.Condition.booleanEquals('$.processResult.Payload.success', false),
            handleStepFailure
          )
          .otherwise(
            new tasks.DynamoUpdateItem(this, 'FinalizeLegacyJob', {
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
            })
          )
      );

    // Define workflow: Update status -> Initialize steps -> Compute steps length -> Check template -> Check workflow type -> Process accordingly
    // Note: computeStepsLength internally connects to checkTemplateExists
    const definition = updateJobStatus
      .next(initializeSteps)
      .next(computeStepsLength);

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
