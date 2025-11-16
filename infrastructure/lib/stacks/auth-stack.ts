import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { RESOURCE_PREFIXES, LAMBDA_DEFAULTS, COGNITO_CONFIG, TABLE_NAMES } from '../config/constants';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Lambda function to auto-confirm users and set tenant_id
    // Path is relative to infrastructure directory (where CDK is executed from)
    const autoConfirmLambda = new lambda.Function(this, 'AutoConfirmLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/lambdas'),
    });

    // Create Lambda function for PostConfirmation to set customer_id
    const postConfirmationLambda = new lambda.Function(this, 'PostConfirmationLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'postConfirmation.handler',
      code: lambda.Code.fromAsset('lib/lambdas'),
      environment: {
        USERS_TABLE: TABLE_NAMES.USERS,
        CUSTOMERS_TABLE: TABLE_NAMES.CUSTOMERS,
        // Note: AWS_REGION is automatically provided by Lambda runtime, don't set it manually
      },
    });

    // Create User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: RESOURCE_PREFIXES.USER_POOL,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: false, // We'll handle this via Lambda
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        tenant_id: new cognito.StringAttribute({ mutable: false }),
        role: new cognito.StringAttribute({ mutable: true }),
        customer_id: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: COGNITO_CONFIG.PASSWORD_MIN_LENGTH,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lambdaTriggers: {
        preSignUp: autoConfirmLambda,
        postConfirmation: postConfirmationLambda,
      },
    });

    // Note: CDK automatically grants Lambda invoke permissions when added to lambdaTriggers
    // No need to manually add permissions for Cognito to invoke the Lambdas

    // Grant PostConfirmation Lambda permission to update user attributes
    // Use wildcard pattern to avoid circular dependency - Lambda will only be invoked by this User Pool
    postConfirmationLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminUpdateUserAttributes',
        ],
        resources: [
          cdk.Stack.of(this).formatArn({
            service: 'cognito-idp',
            resource: 'userpool',
            resourceName: '*',
          }),
        ],
      })
    );

    // Grant PostConfirmation Lambda permission to access DynamoDB tables
    // Reference tables by name (they should exist from DatabaseStack)
    const usersTable = dynamodb.Table.fromTableName(this, 'UsersTableRef', TABLE_NAMES.USERS);
    const customersTable = dynamodb.Table.fromTableName(this, 'CustomersTableRef', TABLE_NAMES.CUSTOMERS);
    
    usersTable.grantReadWriteData(postConfirmationLambda);
    customersTable.grantReadWriteData(postConfirmationLambda);

    // Add domain for hosted UI
    this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `${RESOURCE_PREFIXES.COGNITO_DOMAIN}-${this.account}`,
      },
    });

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: RESOURCE_PREFIXES.USER_POOL_CLIENT,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:3000/auth/callback',
          'https://app.yourdomain.com/auth/callback',
        ],
        logoutUrls: [
          'http://localhost:3000/',
          'https://app.yourdomain.com/',
        ],
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(COGNITO_CONFIG.ACCESS_TOKEN_VALIDITY_HOURS),
      idTokenValidity: cdk.Duration.hours(COGNITO_CONFIG.ID_TOKEN_VALIDITY_HOURS),
      refreshTokenValidity: cdk.Duration.days(COGNITO_CONFIG.REFRESH_TOKEN_VALIDITY_DAYS),
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: 'UserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: 'UserPoolClientId',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      exportName: 'UserPoolArn',
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: `${RESOURCE_PREFIXES.COGNITO_DOMAIN}-${this.account}.auth.${this.region}.amazoncognito.com`,
      exportName: 'CognitoDomain',
    });
  }
}

