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
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:leadmagnet/*`,
        ],
      })
    );

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
      functionName: 'leadmagnet-api-handler',
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
      memorySize: 2048,
      timeout: cdk.Duration.seconds(900),
      role: lambdaRole,
      environment: {
        ...tableEnvVars,
        STEP_FUNCTIONS_ARN: props.stateMachineArn,
        ARTIFACTS_BUCKET: props.artifactsBucket.bucketName,
        CLOUDFRONT_DOMAIN: props.cloudfrontDomain || '',
        LAMBDA_FUNCTION_NAME: 'leadmagnet-api-handler',
        // AWS_REGION is automatically set by Lambda runtime, don't set it manually
        LOG_LEVEL: 'info',
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Create HTTP API
    this.api = new apigateway.HttpApi(this, 'HttpApi', {
      apiName: 'leadmagnet-api',
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
        allowHeaders: ['content-type', 'authorization', 'x-api-key'],
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

