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
exports.ComputeStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const tasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
class ComputeStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        const openaiSecret = secretsmanager.Secret.fromSecretNameV2(this, 'OpenAISecret', 'leadmagnet/openai-api-key');
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
exports.ComputeStack = ComputeStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbXB1dGUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBR25DLG1FQUFxRDtBQUNyRCwyRUFBNkQ7QUFDN0QseURBQTJDO0FBQzNDLCtEQUFpRDtBQUNqRCwyREFBNkM7QUFDN0MsK0VBQWlFO0FBU2pFLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBS3pDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsNENBQTRDO1FBQzVDLE1BQU0sUUFBUSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDL0QsWUFBWSxFQUFFLHNDQUFzQztZQUNwRCxTQUFTLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRO1lBQ3RDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDeEUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsK0JBQStCO1lBQ3hDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsRUFBRTtnQkFDL0Msb0VBQW9FO2dCQUNwRSxtRUFBbUU7Z0JBQ25FLG1DQUFtQztnQkFDbkMsUUFBUSxFQUFFO29CQUNSLEtBQUssRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxhQUFhO29CQUMvQyxPQUFPLEVBQUU7d0JBQ1AsTUFBTSxFQUFF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QUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFdBQVc7WUFDMUMsVUFBVSxFQUFFLHVCQUF1QjtTQUNwQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUEzTEQsb0NBMkxDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgc2ZuIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zJztcbmltcG9ydCAqIGFzIHRhc2tzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbXB1dGVTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICB0YWJsZXNNYXA6IFJlY29yZDxzdHJpbmcsIGR5bmFtb2RiLlRhYmxlPjtcbiAgYXJ0aWZhY3RzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIGNsb3VkZnJvbnREb21haW4/OiBzdHJpbmc7ICAvLyBPcHRpb25hbCBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBkb21haW5cbn1cblxuZXhwb3J0IGNsYXNzIENvbXB1dGVTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBzdGF0ZU1hY2hpbmU6IHNmbi5TdGF0ZU1hY2hpbmU7XG4gIHB1YmxpYyByZWFkb25seSBzdGF0ZU1hY2hpbmVBcm46IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IGpvYlByb2Nlc3NvckxhbWJkYTogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDb21wdXRlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbiBmb3Igam9iIHByb2Nlc3NpbmdcbiAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdKb2JQcm9jZXNzb3JMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9hd3MvbGFtYmRhL2xlYWRtYWduZXQtam9iLXByb2Nlc3NvcicsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICB0aGlzLmpvYlByb2Nlc3NvckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0pvYlByb2Nlc3NvckxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2xhbWJkYV9oYW5kbGVyLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC93b3JrZXInLCB7XG4gICAgICAgIC8vIFVzZSBidW5kbGluZyB3aXRob3V0IERvY2tlciBpZiBhdmFpbGFibGUsIG90aGVyd2lzZSBza2lwIGJ1bmRsaW5nXG4gICAgICAgIC8vIElmIERvY2tlciBpcyBub3QgYXZhaWxhYmxlLCB5b3UgY2FuIHByZS1idWlsZCB0aGUgcGFja2FnZSB1c2luZzpcbiAgICAgICAgLy8gLi9zY3JpcHRzL2J1aWxkLWxhbWJkYS13b3JrZXIuc2hcbiAgICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgICBpbWFnZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEuYnVuZGxpbmdJbWFnZSxcbiAgICAgICAgICBjb21tYW5kOiBbXG4gICAgICAgICAgICAnYmFzaCcsICctYycsXG4gICAgICAgICAgICAncGlwIGluc3RhbGwgLS1wbGF0Zm9ybSBtYW55bGludXgyMDE0X3g4Nl82NCAtLWltcGxlbWVudGF0aW9uIGNwIC0tcHl0aG9uLXZlcnNpb24gMy4xMSAtLW9ubHktYmluYXJ5PTphbGw6IC0tdXBncmFkZSAtLXRhcmdldCAvYXNzZXQtb3V0cHV0IC1yIHJlcXVpcmVtZW50cy50eHQgJiYgY3AgLXIgL2Fzc2V0LWlucHV0LyogL2Fzc2V0LW91dHB1dC8nXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gSWYgRG9ja2VyIGlzIG5vdCBhdmFpbGFibGUgZHVyaW5nIENESyBzeW50aCwgeW91IGNhbjpcbiAgICAgICAgLy8gMS4gUHJlLWJ1aWxkIHVzaW5nOiAuL3NjcmlwdHMvYnVpbGQtbGFtYmRhLXdvcmtlci5zaFxuICAgICAgICAvLyAyLiBVc2UgdGhlIHppcCBmaWxlIGRpcmVjdGx5OiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ3BhdGgvdG8vcHJlLWJ1aWx0LnppcCcpXG4gICAgICB9KSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIG1lbW9yeVNpemU6IDIwNDgsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBXT1JLRkxPV1NfVEFCTEU6IHByb3BzLnRhYmxlc01hcC53b3JrZmxvd3MudGFibGVOYW1lLFxuICAgICAgICBGT1JNU19UQUJMRTogcHJvcHMudGFibGVzTWFwLmZvcm1zLnRhYmxlTmFtZSxcbiAgICAgICAgU1VCTUlTU0lPTlNfVEFCTEU6IHByb3BzLnRhYmxlc01hcC5zdWJtaXNzaW9ucy50YWJsZU5hbWUsXG4gICAgICAgIEpPQlNfVEFCTEU6IHByb3BzLnRhYmxlc01hcC5qb2JzLnRhYmxlTmFtZSxcbiAgICAgICAgQVJUSUZBQ1RTX1RBQkxFOiBwcm9wcy50YWJsZXNNYXAuYXJ0aWZhY3RzLnRhYmxlTmFtZSxcbiAgICAgICAgVEVNUExBVEVTX1RBQkxFOiBwcm9wcy50YWJsZXNNYXAudGVtcGxhdGVzLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUl9TRVRUSU5HU19UQUJMRTogcHJvcHMudGFibGVzTWFwLnVzZXJTZXR0aW5ncy50YWJsZU5hbWUsXG4gICAgICAgIEFSVElGQUNUU19CVUNLRVQ6IHByb3BzLmFydGlmYWN0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBDTE9VREZST05UX0RPTUFJTjogcHJvcHMuY2xvdWRmcm9udERvbWFpbiB8fCAnJyxcbiAgICAgICAgT1BFTkFJX1NFQ1JFVF9OQU1FOiAnbGVhZG1hZ25ldC9vcGVuYWktYXBpLWtleScsXG4gICAgICAgIExPR19MRVZFTDogJ2luZm8nLFxuICAgICAgICBBV1NfUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgIH0sXG4gICAgICBsb2dHcm91cDogbG9nR3JvdXAsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9uc1xuICAgIE9iamVjdC52YWx1ZXMocHJvcHMudGFibGVzTWFwKS5mb3JFYWNoKCh0YWJsZSkgPT4ge1xuICAgICAgdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMuam9iUHJvY2Vzc29yTGFtYmRhKTtcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IFMzIHBlcm1pc3Npb25zXG4gICAgcHJvcHMuYXJ0aWZhY3RzQnVja2V0LmdyYW50UmVhZFdyaXRlKHRoaXMuam9iUHJvY2Vzc29yTGFtYmRhKTtcblxuICAgIC8vIEdyYW50IFNlY3JldHMgTWFuYWdlciBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IG9wZW5haVNlY3JldCA9IHNlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0TmFtZVYyKFxuICAgICAgdGhpcyxcbiAgICAgICdPcGVuQUlTZWNyZXQnLFxuICAgICAgJ2xlYWRtYWduZXQvb3BlbmFpLWFwaS1rZXknXG4gICAgKTtcbiAgICBvcGVuYWlTZWNyZXQuZ3JhbnRSZWFkKHRoaXMuam9iUHJvY2Vzc29yTGFtYmRhKTtcblxuICAgIC8vIENyZWF0ZSBJQU0gcm9sZSBmb3IgU3RlcCBGdW5jdGlvbnNcbiAgICBjb25zdCBzdGF0ZU1hY2hpbmVSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdTdGF0ZU1hY2hpbmVSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ3N0YXRlcy5hbWF6b25hd3MuY29tJyksXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9ucyB0byBTdGVwIEZ1bmN0aW9uc1xuICAgIE9iamVjdC52YWx1ZXMocHJvcHMudGFibGVzTWFwKS5mb3JFYWNoKCh0YWJsZSkgPT4ge1xuICAgICAgdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHN0YXRlTWFjaGluZVJvbGUpO1xuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgUzMgcGVybWlzc2lvbnMgdG8gU3RlcCBGdW5jdGlvbnNcbiAgICBwcm9wcy5hcnRpZmFjdHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoc3RhdGVNYWNoaW5lUm9sZSk7XG5cbiAgICAvLyBHcmFudCBMYW1iZGEgaW52b2tlIHBlcm1pc3Npb25zIHRvIFN0ZXAgRnVuY3Rpb25zXG4gICAgdGhpcy5qb2JQcm9jZXNzb3JMYW1iZGEuZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lUm9sZSk7XG5cbiAgICAvLyBTaW1wbGUgU3RlcCBGdW5jdGlvbnMgU3RhdGUgTWFjaGluZVxuICAgIC8vIFVwZGF0ZSBqb2Igc3RhdHVzIHRvIHByb2Nlc3NpbmdcbiAgICBjb25zdCB1cGRhdGVKb2JTdGF0dXMgPSBuZXcgdGFza3MuRHluYW1vVXBkYXRlSXRlbSh0aGlzLCAnVXBkYXRlSm9iU3RhdHVzJywge1xuICAgICAgdGFibGU6IHByb3BzLnRhYmxlc01hcC5qb2JzLFxuICAgICAga2V5OiB7XG4gICAgICAgIGpvYl9pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJykpLFxuICAgICAgfSxcbiAgICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIHVwZGF0ZWRfYXQgPSA6dXBkYXRlZF9hdCcsXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICAgIH0sXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygncHJvY2Vzc2luZycpLFxuICAgICAgICAnOnVwZGF0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICB9LFxuICAgICAgcmVzdWx0UGF0aDogJyQudXBkYXRlUmVzdWx0JyxcbiAgICB9KTtcblxuICAgIC8vIFVwZGF0ZSBqb2Igc3RhdHVzIHRvIGZhaWxlZFxuICAgIGNvbnN0IGhhbmRsZUZhaWx1cmUgPSBuZXcgdGFza3MuRHluYW1vVXBkYXRlSXRlbSh0aGlzLCAnSGFuZGxlRmFpbHVyZScsIHtcbiAgICAgIHRhYmxlOiBwcm9wcy50YWJsZXNNYXAuam9icyxcbiAgICAgIGtleToge1xuICAgICAgICBqb2JfaWQ6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpKSxcbiAgICAgIH0sXG4gICAgICB1cGRhdGVFeHByZXNzaW9uOiAnU0VUICNzdGF0dXMgPSA6c3RhdHVzLCBlcnJvcl9tZXNzYWdlID0gOmVycm9yLCB1cGRhdGVkX2F0ID0gOnVwZGF0ZWRfYXQnLFxuICAgICAgZXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAgICcjc3RhdHVzJzogJ3N0YXR1cycsXG4gICAgICB9LFxuICAgICAgZXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAnOnN0YXR1cyc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoJ2ZhaWxlZCcpLFxuICAgICAgICAnOmVycm9yJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygnRXJyb3Igb2NjdXJyZWQnKSxcbiAgICAgICAgJzp1cGRhdGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFByb2Nlc3Mgam9iIHVzaW5nIExhbWJkYSBmdW5jdGlvblxuICAgIGNvbnN0IHByb2Nlc3NKb2IgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdQcm9jZXNzSm9iJywge1xuICAgICAgbGFtYmRhRnVuY3Rpb246IHRoaXMuam9iUHJvY2Vzc29yTGFtYmRhLFxuICAgICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgJ2pvYl9pZCc6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgIH0pLFxuICAgICAgcmVzdWx0UGF0aDogJyQucHJvY2Vzc1Jlc3VsdCcsXG4gICAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IGZhbHNlLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBlcnJvciBoYW5kbGluZyBmb3IgTGFtYmRhIGZhaWx1cmVzXG4gICAgcHJvY2Vzc0pvYi5hZGRDYXRjaChoYW5kbGVGYWlsdXJlLCB7XG4gICAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgICBlcnJvcnM6IFsnU3RhdGVzLkFMTCddLFxuICAgIH0pO1xuXG4gICAgLy8gVXBkYXRlIGpvYiBzdGF0dXMgdG8gY29tcGxldGVkXG4gICAgY29uc3QgaGFuZGxlU3VjY2VzcyA9IG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHRoaXMsICdIYW5kbGVTdWNjZXNzJywge1xuICAgICAgdGFibGU6IHByb3BzLnRhYmxlc01hcC5qb2JzLFxuICAgICAga2V5OiB7XG4gICAgICAgIGpvYl9pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJykpLFxuICAgICAgfSxcbiAgICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIGNvbXBsZXRlZF9hdCA9IDpjb21wbGV0ZWRfYXQsIHVwZGF0ZWRfYXQgPSA6dXBkYXRlZF9hdCcsXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICAgIH0sXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygnY29tcGxldGVkJyksXG4gICAgICAgICc6Y29tcGxldGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgICAgICAnOnVwZGF0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gRGVmaW5lIHdvcmtmbG93OiBVcGRhdGUgc3RhdHVzIC0+IFByb2Nlc3Mgam9iIC0+IEhhbmRsZSBzdWNjZXNzXG4gICAgY29uc3QgZGVmaW5pdGlvbiA9IHVwZGF0ZUpvYlN0YXR1c1xuICAgICAgLm5leHQocHJvY2Vzc0pvYilcbiAgICAgIC5uZXh0KGhhbmRsZVN1Y2Nlc3MpO1xuXG4gICAgLy8gQ3JlYXRlIFN0YXRlIE1hY2hpbmVcbiAgICB0aGlzLnN0YXRlTWFjaGluZSA9IG5ldyBzZm4uU3RhdGVNYWNoaW5lKHRoaXMsICdKb2JQcm9jZXNzb3JTdGF0ZU1hY2hpbmUnLCB7XG4gICAgICBzdGF0ZU1hY2hpbmVOYW1lOiAnbGVhZG1hZ25ldC1qb2ItcHJvY2Vzc29yJyxcbiAgICAgIGRlZmluaXRpb25Cb2R5OiBzZm4uRGVmaW5pdGlvbkJvZHkuZnJvbUNoYWluYWJsZShkZWZpbml0aW9uKSxcbiAgICAgIHJvbGU6IHN0YXRlTWFjaGluZVJvbGUsXG4gICAgICBsb2dzOiB7XG4gICAgICAgIGRlc3RpbmF0aW9uOiBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnU3RhdGVNYWNoaW5lTG9nR3JvdXAnLCB7XG4gICAgICAgICAgbG9nR3JvdXBOYW1lOiAnL2F3cy9zdGVwZnVuY3Rpb25zL2xlYWRtYWduZXQtam9iLXByb2Nlc3NvcicsXG4gICAgICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgfSksXG4gICAgICAgIGxldmVsOiBzZm4uTG9nTGV2ZWwuQUxMLFxuICAgICAgICBpbmNsdWRlRXhlY3V0aW9uRGF0YTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICB0cmFjaW5nRW5hYmxlZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIHRoaXMuc3RhdGVNYWNoaW5lQXJuID0gdGhpcy5zdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuO1xuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb24gb3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdGF0ZU1hY2hpbmVBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxuICAgICAgZXhwb3J0TmFtZTogJ1N0YXRlTWFjaGluZUFybicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSm9iUHJvY2Vzc29yTGFtYmRhQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuam9iUHJvY2Vzc29yTGFtYmRhLmZ1bmN0aW9uQXJuLFxuICAgICAgZXhwb3J0TmFtZTogJ0pvYlByb2Nlc3NvckxhbWJkYUFybicsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==