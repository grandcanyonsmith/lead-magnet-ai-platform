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
                bundling: {
                    image: lambda.Runtime.PYTHON_3_11.bundlingImage,
                    command: [
                        'bash', '-c',
                        'pip install --platform manylinux2014_x86_64 --implementation cp --python-version 3.11 --only-binary=:all: --upgrade --target /asset-output -r requirements.txt && cp -r /asset-input/* /asset-output/'
                    ],
                },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbXB1dGUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBR25DLG1FQUFxRDtBQUNyRCwyRUFBNkQ7QUFDN0QseURBQTJDO0FBQzNDLCtEQUFpRDtBQUNqRCwyREFBNkM7QUFDN0MsK0VBQWlFO0FBU2pFLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBS3pDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsNENBQTRDO1FBQzVDLE1BQU0sUUFBUSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDL0QsWUFBWSxFQUFFLHNDQUFzQztZQUNwRCxTQUFTLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRO1lBQ3RDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDeEUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsK0JBQStCO1lBQ3hDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsRUFBRTtnQkFDL0MsUUFBUSxFQUFFO29CQUNSLEtBQUssRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxhQUFhO29CQUMvQyxPQUFPLEVBQUU7d0JBQ1AsTUFBTSxFQUFFLElBQUk7d0JBQ1osdU1BQXVNO3FCQUN4TTtpQkFDRjthQUNGLENBQUM7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QUFwTEQsb0NBb0xDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgc2ZuIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zJztcbmltcG9ydCAqIGFzIHRhc2tzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbXB1dGVTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICB0YWJsZXNNYXA6IFJlY29yZDxzdHJpbmcsIGR5bmFtb2RiLlRhYmxlPjtcbiAgYXJ0aWZhY3RzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIGNsb3VkZnJvbnREb21haW4/OiBzdHJpbmc7ICAvLyBPcHRpb25hbCBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBkb21haW5cbn1cblxuZXhwb3J0IGNsYXNzIENvbXB1dGVTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBzdGF0ZU1hY2hpbmU6IHNmbi5TdGF0ZU1hY2hpbmU7XG4gIHB1YmxpYyByZWFkb25seSBzdGF0ZU1hY2hpbmVBcm46IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IGpvYlByb2Nlc3NvckxhbWJkYTogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDb21wdXRlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbiBmb3Igam9iIHByb2Nlc3NpbmdcbiAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdKb2JQcm9jZXNzb3JMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9hd3MvbGFtYmRhL2xlYWRtYWduZXQtam9iLXByb2Nlc3NvcicsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICB0aGlzLmpvYlByb2Nlc3NvckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0pvYlByb2Nlc3NvckxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2xhbWJkYV9oYW5kbGVyLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC93b3JrZXInLCB7XG4gICAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgICAgaW1hZ2U6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLmJ1bmRsaW5nSW1hZ2UsXG4gICAgICAgICAgY29tbWFuZDogW1xuICAgICAgICAgICAgJ2Jhc2gnLCAnLWMnLFxuICAgICAgICAgICAgJ3BpcCBpbnN0YWxsIC0tcGxhdGZvcm0gbWFueWxpbnV4MjAxNF94ODZfNjQgLS1pbXBsZW1lbnRhdGlvbiBjcCAtLXB5dGhvbi12ZXJzaW9uIDMuMTEgLS1vbmx5LWJpbmFyeT06YWxsOiAtLXVwZ3JhZGUgLS10YXJnZXQgL2Fzc2V0LW91dHB1dCAtciByZXF1aXJlbWVudHMudHh0ICYmIGNwIC1yIC9hc3NldC1pbnB1dC8qIC9hc3NldC1vdXRwdXQvJ1xuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIG1lbW9yeVNpemU6IDIwNDgsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBXT1JLRkxPV1NfVEFCTEU6IHByb3BzLnRhYmxlc01hcC53b3JrZmxvd3MudGFibGVOYW1lLFxuICAgICAgICBGT1JNU19UQUJMRTogcHJvcHMudGFibGVzTWFwLmZvcm1zLnRhYmxlTmFtZSxcbiAgICAgICAgU1VCTUlTU0lPTlNfVEFCTEU6IHByb3BzLnRhYmxlc01hcC5zdWJtaXNzaW9ucy50YWJsZU5hbWUsXG4gICAgICAgIEpPQlNfVEFCTEU6IHByb3BzLnRhYmxlc01hcC5qb2JzLnRhYmxlTmFtZSxcbiAgICAgICAgQVJUSUZBQ1RTX1RBQkxFOiBwcm9wcy50YWJsZXNNYXAuYXJ0aWZhY3RzLnRhYmxlTmFtZSxcbiAgICAgICAgVEVNUExBVEVTX1RBQkxFOiBwcm9wcy50YWJsZXNNYXAudGVtcGxhdGVzLnRhYmxlTmFtZSxcbiAgICAgICAgQVJUSUZBQ1RTX0JVQ0tFVDogcHJvcHMuYXJ0aWZhY3RzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIENMT1VERlJPTlRfRE9NQUlOOiBwcm9wcy5jbG91ZGZyb250RG9tYWluIHx8ICcnLFxuICAgICAgICBPUEVOQUlfU0VDUkVUX05BTUU6ICdsZWFkbWFnbmV0L29wZW5haS1hcGkta2V5JyxcbiAgICAgICAgTE9HX0xFVkVMOiAnaW5mbycsXG4gICAgICAgIEFXU19SRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgfSxcbiAgICAgIGxvZ0dyb3VwOiBsb2dHcm91cCxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zXG4gICAgT2JqZWN0LnZhbHVlcyhwcm9wcy50YWJsZXNNYXApLmZvckVhY2goKHRhYmxlKSA9PiB7XG4gICAgICB0YWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5qb2JQcm9jZXNzb3JMYW1iZGEpO1xuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgUzMgcGVybWlzc2lvbnNcbiAgICBwcm9wcy5hcnRpZmFjdHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUodGhpcy5qb2JQcm9jZXNzb3JMYW1iZGEpO1xuXG4gICAgLy8gR3JhbnQgU2VjcmV0cyBNYW5hZ2VyIHBlcm1pc3Npb25zXG4gICAgY29uc3Qgb3BlbmFpU2VjcmV0ID0gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIoXG4gICAgICB0aGlzLFxuICAgICAgJ09wZW5BSVNlY3JldCcsXG4gICAgICAnbGVhZG1hZ25ldC9vcGVuYWktYXBpLWtleSdcbiAgICApO1xuICAgIG9wZW5haVNlY3JldC5ncmFudFJlYWQodGhpcy5qb2JQcm9jZXNzb3JMYW1iZGEpO1xuXG4gICAgLy8gQ3JlYXRlIElBTSByb2xlIGZvciBTdGVwIEZ1bmN0aW9uc1xuICAgIGNvbnN0IHN0YXRlTWFjaGluZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1N0YXRlTWFjaGluZVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnc3RhdGVzLmFtYXpvbmF3cy5jb20nKSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zIHRvIFN0ZXAgRnVuY3Rpb25zXG4gICAgT2JqZWN0LnZhbHVlcyhwcm9wcy50YWJsZXNNYXApLmZvckVhY2goKHRhYmxlKSA9PiB7XG4gICAgICB0YWJsZS5ncmFudFJlYWRXcml0ZURhdGEoc3RhdGVNYWNoaW5lUm9sZSk7XG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBTMyBwZXJtaXNzaW9ucyB0byBTdGVwIEZ1bmN0aW9uc1xuICAgIHByb3BzLmFydGlmYWN0c0J1Y2tldC5ncmFudFJlYWRXcml0ZShzdGF0ZU1hY2hpbmVSb2xlKTtcblxuICAgIC8vIEdyYW50IExhbWJkYSBpbnZva2UgcGVybWlzc2lvbnMgdG8gU3RlcCBGdW5jdGlvbnNcbiAgICB0aGlzLmpvYlByb2Nlc3NvckxhbWJkYS5ncmFudEludm9rZShzdGF0ZU1hY2hpbmVSb2xlKTtcblxuICAgIC8vIFNpbXBsZSBTdGVwIEZ1bmN0aW9ucyBTdGF0ZSBNYWNoaW5lXG4gICAgLy8gVXBkYXRlIGpvYiBzdGF0dXMgdG8gcHJvY2Vzc2luZ1xuICAgIGNvbnN0IHVwZGF0ZUpvYlN0YXR1cyA9IG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHRoaXMsICdVcGRhdGVKb2JTdGF0dXMnLCB7XG4gICAgICB0YWJsZTogcHJvcHMudGFibGVzTWFwLmpvYnMsXG4gICAgICBrZXk6IHtcbiAgICAgICAgam9iX2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSksXG4gICAgICB9LFxuICAgICAgdXBkYXRlRXhwcmVzc2lvbjogJ1NFVCAjc3RhdHVzID0gOnN0YXR1cywgdXBkYXRlZF9hdCA9IDp1cGRhdGVkX2F0JyxcbiAgICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgICAgfSxcbiAgICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgJzpzdGF0dXMnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdwcm9jZXNzaW5nJyksXG4gICAgICAgICc6dXBkYXRlZF9hdCc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckJC5TdGF0ZS5FbnRlcmVkVGltZScpKSxcbiAgICAgIH0sXG4gICAgICByZXN1bHRQYXRoOiAnJC51cGRhdGVSZXN1bHQnLFxuICAgIH0pO1xuXG4gICAgLy8gVXBkYXRlIGpvYiBzdGF0dXMgdG8gZmFpbGVkXG4gICAgY29uc3QgaGFuZGxlRmFpbHVyZSA9IG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHRoaXMsICdIYW5kbGVGYWlsdXJlJywge1xuICAgICAgdGFibGU6IHByb3BzLnRhYmxlc01hcC5qb2JzLFxuICAgICAga2V5OiB7XG4gICAgICAgIGpvYl9pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJykpLFxuICAgICAgfSxcbiAgICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIGVycm9yX21lc3NhZ2UgPSA6ZXJyb3IsIHVwZGF0ZWRfYXQgPSA6dXBkYXRlZF9hdCcsXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICAgIH0sXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygnZmFpbGVkJyksXG4gICAgICAgICc6ZXJyb3InOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdFcnJvciBvY2N1cnJlZCcpLFxuICAgICAgICAnOnVwZGF0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gUHJvY2VzcyBqb2IgdXNpbmcgTGFtYmRhIGZ1bmN0aW9uXG4gICAgY29uc3QgcHJvY2Vzc0pvYiA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ1Byb2Nlc3NKb2InLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogdGhpcy5qb2JQcm9jZXNzb3JMYW1iZGEsXG4gICAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICAnam9iX2lkJzogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmpvYl9pZCcpLFxuICAgICAgfSksXG4gICAgICByZXN1bHRQYXRoOiAnJC5wcm9jZXNzUmVzdWx0JyxcbiAgICAgIHJldHJ5T25TZXJ2aWNlRXhjZXB0aW9uczogZmFsc2UsXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQWRkIGVycm9yIGhhbmRsaW5nIGZvciBMYW1iZGEgZmFpbHVyZXNcbiAgICBwcm9jZXNzSm9iLmFkZENhdGNoKGhhbmRsZUZhaWx1cmUsIHtcbiAgICAgIHJlc3VsdFBhdGg6ICckLmVycm9yJyxcbiAgICAgIGVycm9yczogWydTdGF0ZXMuQUxMJ10sXG4gICAgfSk7XG5cbiAgICAvLyBVcGRhdGUgam9iIHN0YXR1cyB0byBjb21wbGV0ZWRcbiAgICBjb25zdCBoYW5kbGVTdWNjZXNzID0gbmV3IHRhc2tzLkR5bmFtb1VwZGF0ZUl0ZW0odGhpcywgJ0hhbmRsZVN1Y2Nlc3MnLCB7XG4gICAgICB0YWJsZTogcHJvcHMudGFibGVzTWFwLmpvYnMsXG4gICAgICBrZXk6IHtcbiAgICAgICAgam9iX2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSksXG4gICAgICB9LFxuICAgICAgdXBkYXRlRXhwcmVzc2lvbjogJ1NFVCAjc3RhdHVzID0gOnN0YXR1cywgY29tcGxldGVkX2F0ID0gOmNvbXBsZXRlZF9hdCwgdXBkYXRlZF9hdCA9IDp1cGRhdGVkX2F0JyxcbiAgICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgICAgfSxcbiAgICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgJzpzdGF0dXMnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdjb21wbGV0ZWQnKSxcbiAgICAgICAgJzpjb21wbGV0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICAgICc6dXBkYXRlZF9hdCc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckJC5TdGF0ZS5FbnRlcmVkVGltZScpKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBEZWZpbmUgd29ya2Zsb3c6IFVwZGF0ZSBzdGF0dXMgLT4gUHJvY2VzcyBqb2IgLT4gSGFuZGxlIHN1Y2Nlc3NcbiAgICBjb25zdCBkZWZpbml0aW9uID0gdXBkYXRlSm9iU3RhdHVzXG4gICAgICAubmV4dChwcm9jZXNzSm9iKVxuICAgICAgLm5leHQoaGFuZGxlU3VjY2Vzcyk7XG5cbiAgICAvLyBDcmVhdGUgU3RhdGUgTWFjaGluZVxuICAgIHRoaXMuc3RhdGVNYWNoaW5lID0gbmV3IHNmbi5TdGF0ZU1hY2hpbmUodGhpcywgJ0pvYlByb2Nlc3NvclN0YXRlTWFjaGluZScsIHtcbiAgICAgIHN0YXRlTWFjaGluZU5hbWU6ICdsZWFkbWFnbmV0LWpvYi1wcm9jZXNzb3InLFxuICAgICAgZGVmaW5pdGlvbkJvZHk6IHNmbi5EZWZpbml0aW9uQm9keS5mcm9tQ2hhaW5hYmxlKGRlZmluaXRpb24pLFxuICAgICAgcm9sZTogc3RhdGVNYWNoaW5lUm9sZSxcbiAgICAgIGxvZ3M6IHtcbiAgICAgICAgZGVzdGluYXRpb246IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdTdGF0ZU1hY2hpbmVMb2dHcm91cCcsIHtcbiAgICAgICAgICBsb2dHcm91cE5hbWU6ICcvYXdzL3N0ZXBmdW5jdGlvbnMvbGVhZG1hZ25ldC1qb2ItcHJvY2Vzc29yJyxcbiAgICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgICB9KSxcbiAgICAgICAgbGV2ZWw6IHNmbi5Mb2dMZXZlbC5BTEwsXG4gICAgICAgIGluY2x1ZGVFeGVjdXRpb25EYXRhOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHRyYWNpbmdFbmFibGVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5zdGF0ZU1hY2hpbmVBcm4gPSB0aGlzLnN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm47XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBvdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N0YXRlTWFjaGluZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm4sXG4gICAgICBleHBvcnROYW1lOiAnU3RhdGVNYWNoaW5lQXJuJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdKb2JQcm9jZXNzb3JMYW1iZGFBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5qb2JQcm9jZXNzb3JMYW1iZGEuZnVuY3Rpb25Bcm4sXG4gICAgICBleHBvcnROYW1lOiAnSm9iUHJvY2Vzc29yTGFtYmRhQXJuJyxcbiAgICB9KTtcbiAgfVxufVxuIl19