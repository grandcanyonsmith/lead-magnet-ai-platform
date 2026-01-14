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
import * as sqs from 'aws-cdk-lib/aws-sqs';
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
  cloudfrontDistributionId?: string;
  shellExecutor?: {
    functionArn: string;
    functionName: string;
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

    // Shell executor permissions: allow API Lambda to invoke the executor Lambda directly
    if (props.shellExecutor) {
      const shellFunction = lambda.Function.fromFunctionAttributes(this, 'ShellExecutorFunc', {
        functionArn: props.shellExecutor.functionArn,
        sameEnvironment: true,
      });
      shellFunction.grantInvoke(lambdaRole);
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

    // Allow API Lambda to invalidate CloudFront paths (for saved lead magnet HTML updates).
    if (props.cloudfrontDistributionId) {
      const distributionArn = `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${props.cloudfrontDistributionId}`;
      lambdaRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['cloudfront:CreateInvalidation'],
          resources: [distributionArn],
        })
      );
    }

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

    // Create Dead Letter Queue for async failures
    const dlq = new sqs.Queue(this, 'ApiDlq', {
      queueName: `${RESOURCE_PREFIXES.API_NAME}-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
    });

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
        // CORS origins for Lambda-side CORS header injection (API Gateway also has CORS configured).
        // In production, prefer explicitly setting CORS_ORIGINS, but default to '*' to match HttpApi CORS.
        CORS_ORIGINS: process.env.CORS_ORIGINS || '*',
        [ENV_VAR_NAMES.STEP_FUNCTIONS_ARN]: props.stateMachineArn,
        [ENV_VAR_NAMES.ARTIFACTS_BUCKET]: props.artifactsBucket.bucketName,
        [ENV_VAR_NAMES.CLOUDFRONT_DOMAIN]: props.cloudfrontDomain || '',
        [ENV_VAR_NAMES.CLOUDFRONT_DISTRIBUTION_ID]: props.cloudfrontDistributionId || '',
        [ENV_VAR_NAMES.LAMBDA_FUNCTION_NAME]: FUNCTION_NAMES.API_HANDLER,
        // Admin streaming worker lambdas (can be overridden at deploy time)
        [ENV_VAR_NAMES.CUA_LAMBDA_FUNCTION_NAME]: process.env.CUA_LAMBDA_FUNCTION_NAME || FUNCTION_NAMES.CUA_WORKER,
        [ENV_VAR_NAMES.SHELL_LAMBDA_FUNCTION_NAME]: process.env.SHELL_LAMBDA_FUNCTION_NAME || FUNCTION_NAMES.SHELL_WORKER,
        // Shell tool configuration (defaults can be overridden at deploy time)
        // Enable shell tool by default if shellExecutor is provided, otherwise respect env var or default to false
        [ENV_VAR_NAMES.SHELL_TOOL_ENABLED]: process.env.SHELL_TOOL_ENABLED || (props.shellExecutor ? 'true' : 'false'),
        [ENV_VAR_NAMES.SHELL_TOOL_IP_LIMIT_PER_HOUR]: process.env.SHELL_TOOL_IP_LIMIT_PER_HOUR || '10',
        [ENV_VAR_NAMES.SHELL_TOOL_MAX_IN_FLIGHT]: process.env.SHELL_TOOL_MAX_IN_FLIGHT || '5',
        [ENV_VAR_NAMES.SHELL_TOOL_QUEUE_WAIT_MS]: process.env.SHELL_TOOL_QUEUE_WAIT_MS || '0',
        ...(props.shellExecutor ? {
          [ENV_VAR_NAMES.SHELL_EXECUTOR_FUNCTION_NAME]: props.shellExecutor.functionName,
        } : {}),
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
      deadLetterQueue: dlq,
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

    // Access logging
    const logGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName: `/aws/http-api/${RESOURCE_PREFIXES.API_NAME}-access-logs`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const stage = this.api.defaultStage?.node.defaultChild as apigateway.CfnStage;
    if (stage) {
      stage.accessLogSettings = {
        destinationArn: logGroup.logGroupArn,
        format: JSON.stringify({
          requestId: '$context.requestId',
          ip: '$context.identity.sourceIp',
          requestTime: '$context.requestTime',
          httpMethod: '$context.httpMethod',
          routeKey: '$context.routeKey',
          status: '$context.status',
          protocol: '$context.protocol',
          responseLength: '$context.responseLength',
          integrationError: '$context.integrationErrorMessage',
          errorMessage: '$context.error.message',
          user: '$context.authorizer.claims.sub',
        }),
      };

      stage.defaultRouteSettings = {
        throttlingBurstLimit: 500,
        throttlingRateLimit: 1000,
      };
    }

    // Provide the API base URL to the Lambda itself so it can persist it onto Jobs for downstream
    // worker-side tracking injection (avoids cyclic cross-stack dependency with ComputeStack).
    this.apiFunction.addEnvironment(ENV_VAR_NAMES.API_GATEWAY_URL, this.api.url!);

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
