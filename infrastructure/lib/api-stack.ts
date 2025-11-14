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
        // AWS_REGION is automatically set by Lambda runtime, don't set it manually
        [ENV_VAR_NAMES.LOG_LEVEL]: DEFAULT_LOG_LEVEL,
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
        allowHeaders: ['content-type', 'authorization', 'x-api-key', 'x-session-id'],
        maxAge: cdk.Duration.days(1),
      },
    });

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

