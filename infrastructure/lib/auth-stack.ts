import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Lambda function to auto-confirm users and set tenant_id
    const autoConfirmLambda = new lambda.Function(this, 'AutoConfirmLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          try {
            console.log('PreSignUp Lambda triggered', JSON.stringify(event, null, 2));
            
            // Ensure event structure is correct
            if (!event) {
              throw new Error('Event is null or undefined');
            }
            
            // Initialize response object if it doesn't exist
            if (!event.response) {
              event.response = {};
            }
            
            // Auto-confirm user and auto-verify email
            // These are the only fields allowed in PreSignUp response
            event.response.autoConfirmUser = true;
            event.response.autoVerifyEmail = true;
            
            // Note: Custom attributes cannot be set in PreSignUp trigger response
            // They must be set via PostConfirmation trigger or AdminUpdateUserAttributes
            
            console.log('PreSignUp Lambda response', JSON.stringify(event.response, null, 2));
            
            // Return the event object - Cognito expects the full event object back
            return event;
          } catch (error) {
            console.error('PreSignUp Lambda error:', error);
            // Return a valid response even on error to prevent Cognito from failing
            // Must return the full event object structure
            if (!event) {
              event = {};
            }
            if (!event.response) {
              event.response = {};
            }
            event.response.autoConfirmUser = true;
            event.response.autoVerifyEmail = true;
            return event;
          }
        };
      `),
    });

    // Create User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'leadmagnet-users',
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
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lambdaTriggers: {
        preSignUp: autoConfirmLambda,
      },
    });

    // Grant the Lambda permission to be invoked by Cognito
    autoConfirmLambda.addPermission('CognitoInvoke', {
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      sourceArn: this.userPool.userPoolArn,
    });

    // Add domain for hosted UI
    this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `leadmagnet-${this.account}`,
      },
    });

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'web-app',
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
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
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
      value: `leadmagnet-${this.account}.auth.${this.region}.amazoncognito.com`,
      exportName: 'CognitoDomain',
    });
  }
}

