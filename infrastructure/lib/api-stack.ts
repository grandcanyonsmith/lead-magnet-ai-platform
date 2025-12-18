import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { TableMap } from './types';
import { createLambdaRole, grantDynamoDBPermissions, grantS3Permissions, grantSecretsAccess } from './utils/lambda-helpers';
import { createTableEnvironmentVars } from './utils/environment-helpers';
import { FUNCTION_NAMES, SECRET_NAMES, LAMBDA_DEFAULTS, ENV_VAR_NAMES, DEFAULT_LOG_LEVEL, RESOURCE_PREFIXES } from './config/constants';

export interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  tablesMap: TableMap;
  stateMachineArn: string;
  artifactsBucket: s3.Bucket;
  cloudfrontDomain?: string;
  shellExecutor: {
    cluster: ecs.ICluster;
    taskDefinition: ecs.ITaskDefinition;
    securityGroup: ec2.ISecurityGroup;
    subnetIds: string[];
    resultsBucket: s3.IBucket;
  };
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.HttpApi;
  public readonly apiFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Create Lambda execution role
    const lambdaRole = createLambdaRole(this, 'ApiLambdaRole', {
      includeXRay: true,
    });

    // Grant DynamoDB permissions
    grantDynamoDBPermissions(lambdaRole, props.tablesMap);

    // Grant S3 permissions
    grantS3Permissions(lambdaRole, props.artifactsBucket);
    // Shell executor results bucket (presigned PUT + polling GET)
    props.shellExecutor.resultsBucket.grantReadWrite(lambdaRole);

    // Allow API Lambda to run ECS tasks (shell executor) and pass the execution role.
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ecs:RunTask', 'ecs:DescribeTaskDefinition'],
        resources: [props.shellExecutor.taskDefinition.taskDefinitionArn],
      })
    );
    // DescribeTasks and StopTask don't support resource-level permissions reliably; scope to *.
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ecs:DescribeTasks', 'ecs:StopTask'],
        resources: ['*'],
      })
    );
    // Pass the task execution role to ECS so it can pull the image and write logs.
    const execRoleArn = (props.shellExecutor.taskDefinition as any).executionRole?.roleArn;
    if (execRoleArn) {
      lambdaRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['iam:PassRole'],
          resources: [execRoleArn],
        })
      );
    }

    // Grant Step Functions permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['states:StartExecution', 'states:DescribeExecution'],
        resources: [props.stateMachineArn],
      })
    );

    // Grant Secrets Manager permissions
    grantSecretsAccess(lambdaRole, this, [
      SECRET_NAMES.OPENAI_API_KEY,
      SECRET_NAMES.TWILIO_CREDENTIALS,
      SECRET_NAMES.STRIPE_API_KEY,
    ]);

    // Grant Lambda invoke permissions for async workflow generation
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: ['*'], // Allow invoking itself for async workflow generation
      })
    );

    // Create environment variables from tables
    const tableEnvVars = createTableEnvironmentVars(props.tablesMap);

    // Create API Lambda function
    // Note: Initially deploying with placeholder code, will update after building the app
    this.apiFunction = new lambda.Function(this, 'ApiFunction', {
      functionName: FUNCTION_NAMES.API_HANDLER,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'API not yet deployed. Deploy backend/api first.' })
          };
        };
      `),
      memorySize: LAMBDA_DEFAULTS.API.MEMORY_SIZE,
      timeout: cdk.Duration.seconds(LAMBDA_DEFAULTS.API.TIMEOUT_SECONDS),
      role: lambdaRole,
      environment: {
        ...tableEnvVars,
        [ENV_VAR_NAMES.STEP_FUNCTIONS_ARN]: props.stateMachineArn,
        [ENV_VAR_NAMES.ARTIFACTS_BUCKET]: props.artifactsBucket.bucketName,
        [ENV_VAR_NAMES.CLOUDFRONT_DOMAIN]: props.cloudfrontDomain || '',
        [ENV_VAR_NAMES.LAMBDA_FUNCTION_NAME]: FUNCTION_NAMES.API_HANDLER,
        // Shell tool configuration (defaults can be overridden at deploy time)
        [ENV_VAR_NAMES.SHELL_TOOL_ENABLED]: process.env.SHELL_TOOL_ENABLED || 'false',
        [ENV_VAR_NAMES.SHELL_TOOL_IP_LIMIT_PER_HOUR]: process.env.SHELL_TOOL_IP_LIMIT_PER_HOUR || '10',
        [ENV_VAR_NAMES.SHELL_TOOL_MAX_IN_FLIGHT]: process.env.SHELL_TOOL_MAX_IN_FLIGHT || '5',
        [ENV_VAR_NAMES.SHELL_TOOL_QUEUE_WAIT_MS]: process.env.SHELL_TOOL_QUEUE_WAIT_MS || '0',
        [ENV_VAR_NAMES.SHELL_EXECUTOR_RESULTS_BUCKET]: props.shellExecutor.resultsBucket.bucketName,
        [ENV_VAR_NAMES.SHELL_EXECUTOR_CLUSTER_ARN]: props.shellExecutor.cluster.clusterArn,
        [ENV_VAR_NAMES.SHELL_EXECUTOR_TASK_DEFINITION_ARN]: props.shellExecutor.taskDefinition.taskDefinitionArn,
        [ENV_VAR_NAMES.SHELL_EXECUTOR_SECURITY_GROUP_ID]: props.shellExecutor.securityGroup.securityGroupId,
        [ENV_VAR_NAMES.SHELL_EXECUTOR_SUBNET_IDS]: props.shellExecutor.subnetIds.join(','),
        // AWS_REGION is automatically set by Lambda runtime, don't set it manually
        [ENV_VAR_NAMES.LOG_LEVEL]: DEFAULT_LOG_LEVEL,
        // Stripe configuration (values should be set via CDK context or environment variables)
        [ENV_VAR_NAMES.STRIPE_SECRET_NAME]: SECRET_NAMES.STRIPE_API_KEY,
        [ENV_VAR_NAMES.STRIPE_PRICE_ID]: process.env.STRIPE_PRICE_ID || '',
        [ENV_VAR_NAMES.STRIPE_METERED_PRICE_ID]: process.env.STRIPE_METERED_PRICE_ID || '',
        [ENV_VAR_NAMES.STRIPE_METERED_PRICE_MAP]: process.env.STRIPE_METERED_PRICE_MAP || '',
        [ENV_VAR_NAMES.STRIPE_WEBHOOK_SECRET]: process.env.STRIPE_WEBHOOK_SECRET || '',
        [ENV_VAR_NAMES.STRIPE_PORTAL_RETURN_URL]: process.env.STRIPE_PORTAL_RETURN_URL || '',
        // Optional error reporting webhook (e.g. Slack/Discord/custom collector)
        [ENV_VAR_NAMES.ERROR_WEBHOOK_URL]: process.env.ERROR_WEBHOOK_URL || '',
        [ENV_VAR_NAMES.ERROR_WEBHOOK_HEADERS]: process.env.ERROR_WEBHOOK_HEADERS || '',
        [ENV_VAR_NAMES.ERROR_WEBHOOK_TIMEOUT_MS]: process.env.ERROR_WEBHOOK_TIMEOUT_MS || '',
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Create HTTP API
    this.api = new apigateway.HttpApi(this, 'HttpApi', {
      apiName: RESOURCE_PREFIXES.API_NAME,
      description: 'Lead Magnet Platform API',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.PUT,
          apigateway.CorsHttpMethod.DELETE,
          apigateway.CorsHttpMethod.PATCH,
          apigateway.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['content-type', 'authorization', 'x-api-key', 'x-session-id', 'x-view-mode', 'x-selected-customer-id'],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Provide the API base URL to the Lambda itself so it can persist it onto Jobs for downstream
    // worker-side tracking injection (avoids cyclic cross-stack dependency with ComputeStack).
    this.apiFunction.addEnvironment(ENV_VAR_NAMES.API_GATEWAY_URL, this.api.url!);

    // NOTE: We intentionally do NOT associate an AWS WAFv2 WebACL with the API Gateway HTTP API here.
    // In practice, WAFv2 WebACLAssociation can fail for HTTP API $default stages due to ARN validation
    // (e.g., arn:aws:apigateway:region::/apis/<apiId>/stages/$default) depending on AWS/WAF support.
    //
    // Protections in place instead:
    // - DynamoDB-backed per-IP/per-form rate limiting on POST /v1/forms/:slug/submit
    // - CloudFront WAF (attached in StorageStack) for the frontend distribution
    //
    // If you later move to an API Gateway type/stage that supports WAF association cleanly,
    // you can re-introduce a regional WebACL and attach it to that stage ARN.

    // Create JWT Authorizer
    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'JwtAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`,
      {
        jwtAudience: [props.userPoolClient.userPoolClientId],
      }
    );

    // Lambda Integration
    const lambdaIntegration = new integrations.HttpLambdaIntegration(
      'LambdaIntegration',
      this.apiFunction
    );

    // Public Routes (no auth) - catch-all for /v1/*
    this.api.addRoutes({
      path: '/v1/{proxy+}',
      methods: [
        apigateway.HttpMethod.GET,
        apigateway.HttpMethod.POST,
      ],
      integration: lambdaIntegration,
    });

    // Authenticated Routes (require JWT auth) - /files and /me
    // Add route for /files (exact match)
    this.api.addRoutes({
      path: '/files',
      methods: [
        apigateway.HttpMethod.GET,
        apigateway.HttpMethod.POST,
      ],
      integration: lambdaIntegration,
      authorizer: jwtAuthorizer,
    });
    
    // Add route for /files/{proxy+} (for /files/:fileId, /files/search, etc.)
    this.api.addRoutes({
      path: '/files/{proxy+}',
      methods: [
        apigateway.HttpMethod.GET,
        apigateway.HttpMethod.POST,
        apigateway.HttpMethod.DELETE,
      ],
      integration: lambdaIntegration,
      authorizer: jwtAuthorizer,
    });

    this.api.addRoutes({
      path: '/me',
      methods: [apigateway.HttpMethod.GET],
      integration: lambdaIntegration,
      authorizer: jwtAuthorizer,
    });

    // Admin Routes (require JWT auth) - catch-all for /admin/*
    this.api.addRoutes({
      path: '/admin/{proxy+}',
      methods: [
        apigateway.HttpMethod.GET,
        apigateway.HttpMethod.POST,
        apigateway.HttpMethod.PUT,
        apigateway.HttpMethod.PATCH,
        apigateway.HttpMethod.DELETE,
      ],
      integration: lambdaIntegration,
      authorizer: jwtAuthorizer,
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url!,
      exportName: 'ApiUrl',
    });

    new cdk.CfnOutput(this, 'ApiFunctionArn', {
      value: this.apiFunction.functionArn,
      exportName: 'ApiFunctionArn',
    });
  }
}

