"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const integrations = __importStar(require("aws-cdk-lib/aws-apigatewayv2-integrations"));
const authorizers = __importStar(require("aws-cdk-lib/aws-apigatewayv2-authorizers"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class ApiStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create Lambda execution role
        const lambdaRole = new iam.Role(this, 'ApiLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
            ],
        });
        // Grant DynamoDB permissions
        Object.values(props.tablesMap).forEach((table) => {
            table.grantReadWriteData(lambdaRole);
        });
        // Grant S3 permissions
        props.artifactsBucket.grantReadWrite(lambdaRole);
        // Grant Step Functions permissions
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['states:StartExecution', 'states:DescribeExecution'],
            resources: [props.stateMachineArn],
        }));
        // Grant Secrets Manager permissions
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['secretsmanager:GetSecretValue'],
            resources: [
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:leadmagnet/*`,
            ],
        }));
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
            timeout: cdk.Duration.seconds(30),
            role: lambdaRole,
            environment: {
                WORKFLOWS_TABLE: props.tablesMap.workflows.tableName,
                FORMS_TABLE: props.tablesMap.forms.tableName,
                SUBMISSIONS_TABLE: props.tablesMap.submissions.tableName,
                JOBS_TABLE: props.tablesMap.jobs.tableName,
                ARTIFACTS_TABLE: props.tablesMap.artifacts.tableName,
                TEMPLATES_TABLE: props.tablesMap.templates.tableName,
                USER_SETTINGS_TABLE: props.tablesMap.userSettings.tableName,
                STEP_FUNCTIONS_ARN: props.stateMachineArn,
                ARTIFACTS_BUCKET: props.artifactsBucket.bucketName,
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
        const jwtAuthorizer = new authorizers.HttpJwtAuthorizer('JwtAuthorizer', `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`, {
            jwtAudience: [props.userPoolClient.userPoolClientId],
        });
        // Lambda Integration
        const lambdaIntegration = new integrations.HttpLambdaIntegration('LambdaIntegration', this.apiFunction);
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
            value: this.api.url,
            exportName: 'ApiUrl',
        });
        new cdk.CfnOutput(this, 'ApiFunctionArn', {
            value: this.apiFunction.functionArn,
            exportName: 'ApiFunctionArn',
        });
    }
}
exports.ApiStack = ApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5RUFBMkQ7QUFDM0Qsd0ZBQTBFO0FBQzFFLHNGQUF3RTtBQUN4RSwrREFBaUQ7QUFJakQseURBQTJDO0FBQzNDLDJEQUE2QztBQVc3QyxNQUFhLFFBQVMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUlyQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQW9CO1FBQzVELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLCtCQUErQjtRQUMvQixNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUNyRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUM7WUFDM0QsZUFBZSxFQUFFO2dCQUNmLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsMENBQTBDLENBQUM7Z0JBQ3RGLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsMEJBQTBCLENBQUM7YUFDdkU7U0FDRixDQUFDLENBQUM7UUFFSCw2QkFBNkI7UUFDN0IsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7WUFDL0MsS0FBSyxDQUFDLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZDLENBQUMsQ0FBQyxDQUFDO1FBRUgsdUJBQXVCO1FBQ3ZCLEtBQUssQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRWpELG1DQUFtQztRQUNuQyxVQUFVLENBQUMsV0FBVyxDQUNwQixJQUFJLEdBQUcsQ0FBQyxl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LFFBQVEsRUFBRTtZQUNoQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFJO1lBQ3BCLFVBQVUsRUFBRSxRQUFRO1NBQ3JCLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVztZQUNuQyxVQUFVLEVBQUUsZ0JBQWdCO1NBQzdCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWxKRCw0QkFrSkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyJztcbmltcG9ydCAqIGFzIGludGVncmF0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWludGVncmF0aW9ucyc7XG5pbXBvcnQgKiBhcyBhdXRob3JpemVycyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWF1dGhvcml6ZXJzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFwaVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xuICB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgdGFibGVzTWFwOiBSZWNvcmQ8c3RyaW5nLCBkeW5hbW9kYi5UYWJsZT47XG4gIHN0YXRlTWFjaGluZUFybjogc3RyaW5nO1xuICBhcnRpZmFjdHNCdWNrZXQ6IHMzLkJ1Y2tldDtcbn1cblxuZXhwb3J0IGNsYXNzIEFwaVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGFwaTogYXBpZ2F0ZXdheS5IdHRwQXBpO1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXBpU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBleGVjdXRpb24gcm9sZVxuICAgIGNvbnN0IGxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0FwaUxhbWJkYVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBV1NYUmF5RGFlbW9uV3JpdGVBY2Nlc3MnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9uc1xuICAgIE9iamVjdC52YWx1ZXMocHJvcHMudGFibGVzTWFwKS5mb3JFYWNoKCh0YWJsZSkgPT4ge1xuICAgICAgdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYVJvbGUpO1xuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgUzMgcGVybWlzc2lvbnNcbiAgICBwcm9wcy5hcnRpZmFjdHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUobGFtYmRhUm9sZSk7XG5cbiAgICAvLyBHcmFudCBTdGVwIEZ1bmN0aW9ucyBwZXJtaXNzaW9uc1xuICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogWydzdGF0ZXM6U3RhcnRFeGVjdXRpb24nLCAnc3RhdGVzOkRlc2NyaWJlRXhlY3V0aW9uJ10sXG4gICAgICAgIHJlc291cmNlczogW3Byb3BzLnN0YXRlTWFjaGluZUFybl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBTZWNyZXRzIE1hbmFnZXIgcGVybWlzc2lvbnNcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFsnc2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWUnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6c2VjcmV0c21hbmFnZXI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnNlY3JldDpsZWFkbWFnbmV0LypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIEFQSSBMYW1iZGEgZnVuY3Rpb25cbiAgICAvLyBOb3RlOiBJbml0aWFsbHkgZGVwbG95aW5nIHdpdGggcGxhY2Vob2xkZXIgY29kZSwgd2lsbCB1cGRhdGUgYWZ0ZXIgYnVpbGRpbmcgdGhlIGFwcFxuICAgIHRoaXMuYXBpRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcGlGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ2xlYWRtYWduZXQtYXBpLWhhbmRsZXInLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgbWVzc2FnZTogJ0FQSSBub3QgeWV0IGRlcGxveWVkLiBEZXBsb3kgYmFja2VuZC9hcGkgZmlyc3QuJyB9KVxuICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIG1lbW9yeVNpemU6IDIwNDgsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgV09SS0ZMT1dTX1RBQkxFOiBwcm9wcy50YWJsZXNNYXAud29ya2Zsb3dzLnRhYmxlTmFtZSxcbiAgICAgICAgRk9STVNfVEFCTEU6IHByb3BzLnRhYmxlc01hcC5mb3Jtcy50YWJsZU5hbWUsXG4gICAgICAgIFNVQk1JU1NJT05TX1RBQkxFOiBwcm9wcy50YWJsZXNNYXAuc3VibWlzc2lvbnMudGFibGVOYW1lLFxuICAgICAgICBKT0JTX1RBQkxFOiBwcm9wcy50YWJsZXNNYXAuam9icy50YWJsZU5hbWUsXG4gICAgICAgIEFSVElGQUNUU19UQUJMRTogcHJvcHMudGFibGVzTWFwLmFydGlmYWN0cy50YWJsZU5hbWUsXG4gICAgICAgIFRFTVBMQVRFU19UQUJMRTogcHJvcHMudGFibGVzTWFwLnRlbXBsYXRlcy50YWJsZU5hbWUsXG4gICAgICAgIFVTRVJfU0VUVElOR1NfVEFCTEU6IHByb3BzLnRhYmxlc01hcC51c2VyU2V0dGluZ3MudGFibGVOYW1lLFxuICAgICAgICBTVEVQX0ZVTkNUSU9OU19BUk46IHByb3BzLnN0YXRlTWFjaGluZUFybixcbiAgICAgICAgQVJUSUZBQ1RTX0JVQ0tFVDogcHJvcHMuYXJ0aWZhY3RzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIExPR19MRVZFTDogJ2luZm8nLFxuICAgICAgfSxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIEhUVFAgQVBJXG4gICAgdGhpcy5hcGkgPSBuZXcgYXBpZ2F0ZXdheS5IdHRwQXBpKHRoaXMsICdIdHRwQXBpJywge1xuICAgICAgYXBpTmFtZTogJ2xlYWRtYWduZXQtYXBpJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGVhZCBNYWduZXQgUGxhdGZvcm0gQVBJJyxcbiAgICAgIGNvcnNQcmVmbGlnaHQ6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbXG4gICAgICAgICAgYXBpZ2F0ZXdheS5Db3JzSHR0cE1ldGhvZC5HRVQsXG4gICAgICAgICAgYXBpZ2F0ZXdheS5Db3JzSHR0cE1ldGhvZC5QT1NULFxuICAgICAgICAgIGFwaWdhdGV3YXkuQ29yc0h0dHBNZXRob2QuUFVULFxuICAgICAgICAgIGFwaWdhdGV3YXkuQ29yc0h0dHBNZXRob2QuREVMRVRFLFxuICAgICAgICAgIGFwaWdhdGV3YXkuQ29yc0h0dHBNZXRob2QuUEFUQ0gsXG4gICAgICAgICAgYXBpZ2F0ZXdheS5Db3JzSHR0cE1ldGhvZC5PUFRJT05TLFxuICAgICAgICBdLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnY29udGVudC10eXBlJywgJ2F1dGhvcml6YXRpb24nLCAneC1hcGkta2V5J10sXG4gICAgICAgIG1heEFnZTogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIEpXVCBBdXRob3JpemVyXG4gICAgY29uc3Qgand0QXV0aG9yaXplciA9IG5ldyBhdXRob3JpemVycy5IdHRwSnd0QXV0aG9yaXplcihcbiAgICAgICdKd3RBdXRob3JpemVyJyxcbiAgICAgIGBodHRwczovL2NvZ25pdG8taWRwLiR7dGhpcy5yZWdpb259LmFtYXpvbmF3cy5jb20vJHtwcm9wcy51c2VyUG9vbC51c2VyUG9vbElkfWAsXG4gICAgICB7XG4gICAgICAgIGp3dEF1ZGllbmNlOiBbcHJvcHMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZF0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIExhbWJkYSBJbnRlZ3JhdGlvblxuICAgIGNvbnN0IGxhbWJkYUludGVncmF0aW9uID0gbmV3IGludGVncmF0aW9ucy5IdHRwTGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICAnTGFtYmRhSW50ZWdyYXRpb24nLFxuICAgICAgdGhpcy5hcGlGdW5jdGlvblxuICAgICk7XG5cbiAgICAvLyBQdWJsaWMgUm91dGVzIChubyBhdXRoKSAtIGNhdGNoLWFsbCBmb3IgL3YxLypcbiAgICB0aGlzLmFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy92MS97cHJveHkrfScsXG4gICAgICBtZXRob2RzOiBbXG4gICAgICAgIGFwaWdhdGV3YXkuSHR0cE1ldGhvZC5HRVQsXG4gICAgICAgIGFwaWdhdGV3YXkuSHR0cE1ldGhvZC5QT1NULFxuICAgICAgXSxcbiAgICAgIGludGVncmF0aW9uOiBsYW1iZGFJbnRlZ3JhdGlvbixcbiAgICB9KTtcblxuICAgIC8vIEFkbWluIFJvdXRlcyAocmVxdWlyZSBKV1QgYXV0aCkgLSBjYXRjaC1hbGwgZm9yIC9hZG1pbi8qXG4gICAgdGhpcy5hcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcvYWRtaW4ve3Byb3h5K30nLFxuICAgICAgbWV0aG9kczogW1xuICAgICAgICBhcGlnYXRld2F5Lkh0dHBNZXRob2QuR0VULFxuICAgICAgICBhcGlnYXRld2F5Lkh0dHBNZXRob2QuUE9TVCxcbiAgICAgICAgYXBpZ2F0ZXdheS5IdHRwTWV0aG9kLlBVVCxcbiAgICAgICAgYXBpZ2F0ZXdheS5IdHRwTWV0aG9kLlBBVENILFxuICAgICAgICBhcGlnYXRld2F5Lkh0dHBNZXRob2QuREVMRVRFLFxuICAgICAgXSxcbiAgICAgIGludGVncmF0aW9uOiBsYW1iZGFJbnRlZ3JhdGlvbixcbiAgICAgIGF1dGhvcml6ZXI6IGp3dEF1dGhvcml6ZXIsXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBvdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaS51cmwhLFxuICAgICAgZXhwb3J0TmFtZTogJ0FwaVVybCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGV4cG9ydE5hbWU6ICdBcGlGdW5jdGlvbkFybicsXG4gICAgfSk7XG4gIH1cbn1cblxuIl19