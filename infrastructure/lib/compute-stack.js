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
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class ComputeStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create VPC for ECS
        const vpc = new ec2.Vpc(this, 'Vpc', {
            maxAzs: 2,
            natGateways: 1,
        });
        // Create ECS Cluster
        this.cluster = new ecs.Cluster(this, 'Cluster', {
            clusterName: 'leadmagnet-cluster',
            vpc,
            containerInsights: true,
        });
        // Create IAM role for Step Functions
        const stateMachineRole = new iam.Role(this, 'StateMachineRole', {
            assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
        });
        // Grant DynamoDB permissions
        Object.values(props.tablesMap).forEach((table) => {
            table.grantReadWriteData(stateMachineRole);
        });
        // Grant S3 permissions
        props.artifactsBucket.grantReadWrite(stateMachineRole);
        // Grant ECS permissions
        stateMachineRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ecs:RunTask',
                'ecs:StopTask',
                'ecs:DescribeTasks',
            ],
            resources: ['*'],
        }));
        stateMachineRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iam:PassRole'],
            resources: ['*'],
        }));
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
        // Get subnets for ECS task
        const subnets = vpc.privateSubnets.map(s => s.subnetId);
        // Process job using ECS task
        // Use CloudFormation import to get task definition ARN from WorkerStack
        const taskDefinitionArn = props.taskDefinitionArn ||
            cdk.Fn.importValue('WorkerTaskDefinitionArn');
        // Invoke ECS task to process the job
        const processJob = new tasks.EcsRunTask(this, 'ProcessJob', {
            cluster: this.cluster,
            taskDefinition: ecs.TaskDefinition.fromTaskDefinitionArn(this, 'WorkerTaskDef', taskDefinitionArn),
            launchTarget: new tasks.EcsFargateLaunchTarget(),
            assignPublicIp: false,
            subnets: { subnets: vpc.privateSubnets },
            containerOverrides: [
                {
                    containerDefinition: ecs.ContainerDefinition.fromContainerDefinitionName(ecs.TaskDefinition.fromTaskDefinitionArn(this, 'WorkerTaskDefRef', taskDefinitionArn), 'WorkerContainer'),
                    environment: [
                        {
                            name: 'JOB_ID',
                            value: sfn.JsonPath.stringAt('$.job_id'),
                        },
                    ],
                },
            ],
            integrationPattern: sfn.IntegrationPattern.RUN_JOB,
            resultPath: '$.processResult',
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
        // Define workflow with error handling
        // Wrap the process in a parallel state for error handling
        const tryProcess = new sfn.Parallel(this, 'TryProcess', {
            resultPath: '$.parallelResult',
        });
        tryProcess.branch(processJob);
        tryProcess.addCatch(handleFailure, {
            resultPath: '$.error',
        });
        const definition = updateJobStatus
            .next(tryProcess)
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
        new cdk.CfnOutput(this, 'ClusterName', {
            value: this.cluster.clusterName,
            exportName: 'ClusterName',
        });
        new cdk.CfnOutput(this, 'VpcId', {
            value: vpc.vpcId,
            exportName: 'VpcId',
        });
    }
}
exports.ComputeStack = ComputeStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbXB1dGUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBR25DLG1FQUFxRDtBQUNyRCwyRUFBNkQ7QUFDN0QseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsMkRBQTZDO0FBUzdDLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBS3pDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIscUJBQXFCO1FBQ3JCLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO1lBQ25DLE1BQU0sRUFBRSxDQUFDO1lBQ1QsV0FBVyxFQUFFLENBQUM7U0FDZixDQUFDLENBQUM7UUFFSCxxQkFBcUI7UUFDckIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUM5QyxXQUFXLEVBQUUsb0JBQW9CO1lBQ2pDLEdBQUc7WUFDSCxpQkFBaUIsRUFBRSxJQUFJO1NBQ3hCLENBQUMsQ0FBQztRQUVILHFDQUFxQztRQUNyQyxNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDOUQsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1NBQzVELENBQUMsQ0FBQztRQUVILDZCQUE2QjtRQUM3QixNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUMv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LENBQUM7WUFDNUQsSUFBSSxFQUFFLGdCQUFnQjtZQUN0QixJQUFJLEVBQUU7Z0JBQ0osV0FBVyxFQUFFLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7b0JBQzNELFlBQVksRUFBRSw2Q0FBNkM7b0JBQzNELFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVE7b0JBQ3RDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87aUJBQ3pDLENBQUM7Z0JBQ0YsS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRztnQkFDdkIsb0JBQW9CLEVBQUUsSUFBSTthQUMzQjtZQUNELGNBQWMsRUFBRSxJQUFJO1NBQ3JCLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUM7UUFFekQseUJBQXlCO1FBQ3pCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDekMsS0FBSyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZTtZQUN4QyxVQUFVLEVBQUUsaUJBQWlCO1NBQzlCLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3JDLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDL0IsVUFBVSxFQUFFLGFBQWE7U0FDMUIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7WUFDL0IsS0FBSyxFQUFFLEdBQUcsQ0FBQyxLQUFLO1lBQ2hCLFVBQVUsRUFBRSxPQUFPO1NBQ3BCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWxNRCxvQ0FrTUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgdGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgZWNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBDb21wdXRlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgdGFibGVzTWFwOiBSZWNvcmQ8c3RyaW5nLCBkeW5hbW9kYi5UYWJsZT47XG4gIGFydGlmYWN0c0J1Y2tldDogczMuQnVja2V0O1xuICB0YXNrRGVmaW5pdGlvbkFybj86IHN0cmluZzsgLy8gT3B0aW9uYWwgLSB3aWxsIGJlIHNldCBhZnRlciB3b3JrZXIgc3RhY2sgaXMgY3JlYXRlZFxufVxuXG5leHBvcnQgY2xhc3MgQ29tcHV0ZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHN0YXRlTWFjaGluZTogc2ZuLlN0YXRlTWFjaGluZTtcbiAgcHVibGljIHJlYWRvbmx5IHN0YXRlTWFjaGluZUFybjogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgY2x1c3RlcjogZWNzLkNsdXN0ZXI7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IENvbXB1dGVTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBDcmVhdGUgVlBDIGZvciBFQ1NcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCAnVnBjJywge1xuICAgICAgbWF4QXpzOiAyLFxuICAgICAgbmF0R2F0ZXdheXM6IDEsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgRUNTIENsdXN0ZXJcbiAgICB0aGlzLmNsdXN0ZXIgPSBuZXcgZWNzLkNsdXN0ZXIodGhpcywgJ0NsdXN0ZXInLCB7XG4gICAgICBjbHVzdGVyTmFtZTogJ2xlYWRtYWduZXQtY2x1c3RlcicsXG4gICAgICB2cGMsXG4gICAgICBjb250YWluZXJJbnNpZ2h0czogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBJQU0gcm9sZSBmb3IgU3RlcCBGdW5jdGlvbnNcbiAgICBjb25zdCBzdGF0ZU1hY2hpbmVSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdTdGF0ZU1hY2hpbmVSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ3N0YXRlcy5hbWF6b25hd3MuY29tJyksXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9uc1xuICAgIE9iamVjdC52YWx1ZXMocHJvcHMudGFibGVzTWFwKS5mb3JFYWNoKCh0YWJsZSkgPT4ge1xuICAgICAgdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHN0YXRlTWFjaGluZVJvbGUpO1xuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgUzMgcGVybWlzc2lvbnNcbiAgICBwcm9wcy5hcnRpZmFjdHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoc3RhdGVNYWNoaW5lUm9sZSk7XG5cbiAgICAvLyBHcmFudCBFQ1MgcGVybWlzc2lvbnNcbiAgICBzdGF0ZU1hY2hpbmVSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnZWNzOlJ1blRhc2snLFxuICAgICAgICAgICdlY3M6U3RvcFRhc2snLFxuICAgICAgICAgICdlY3M6RGVzY3JpYmVUYXNrcycsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBzdGF0ZU1hY2hpbmVSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFsnaWFtOlBhc3NSb2xlJ10sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBTaW1wbGUgU3RlcCBGdW5jdGlvbnMgU3RhdGUgTWFjaGluZVxuICAgIC8vIFVwZGF0ZSBqb2Igc3RhdHVzIHRvIHByb2Nlc3NpbmdcbiAgICBjb25zdCB1cGRhdGVKb2JTdGF0dXMgPSBuZXcgdGFza3MuRHluYW1vVXBkYXRlSXRlbSh0aGlzLCAnVXBkYXRlSm9iU3RhdHVzJywge1xuICAgICAgdGFibGU6IHByb3BzLnRhYmxlc01hcC5qb2JzLFxuICAgICAga2V5OiB7XG4gICAgICAgIGpvYl9pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJykpLFxuICAgICAgfSxcbiAgICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIHVwZGF0ZWRfYXQgPSA6dXBkYXRlZF9hdCcsXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICAgIH0sXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygncHJvY2Vzc2luZycpLFxuICAgICAgICAnOnVwZGF0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICB9LFxuICAgICAgcmVzdWx0UGF0aDogJyQudXBkYXRlUmVzdWx0JyxcbiAgICB9KTtcblxuICAgIC8vIEdldCBzdWJuZXRzIGZvciBFQ1MgdGFza1xuICAgIGNvbnN0IHN1Ym5ldHMgPSB2cGMucHJpdmF0ZVN1Ym5ldHMubWFwKHMgPT4gcy5zdWJuZXRJZCk7XG5cbiAgICAvLyBQcm9jZXNzIGpvYiB1c2luZyBFQ1MgdGFza1xuICAgIC8vIFVzZSBDbG91ZEZvcm1hdGlvbiBpbXBvcnQgdG8gZ2V0IHRhc2sgZGVmaW5pdGlvbiBBUk4gZnJvbSBXb3JrZXJTdGFja1xuICAgIGNvbnN0IHRhc2tEZWZpbml0aW9uQXJuID0gcHJvcHMudGFza0RlZmluaXRpb25Bcm4gfHwgXG4gICAgICBjZGsuRm4uaW1wb3J0VmFsdWUoJ1dvcmtlclRhc2tEZWZpbml0aW9uQXJuJyk7XG4gICAgXG4gICAgLy8gSW52b2tlIEVDUyB0YXNrIHRvIHByb2Nlc3MgdGhlIGpvYlxuICAgIGNvbnN0IHByb2Nlc3NKb2IgPSBuZXcgdGFza3MuRWNzUnVuVGFzayh0aGlzLCAnUHJvY2Vzc0pvYicsIHtcbiAgICAgIGNsdXN0ZXI6IHRoaXMuY2x1c3RlcixcbiAgICAgIHRhc2tEZWZpbml0aW9uOiBlY3MuVGFza0RlZmluaXRpb24uZnJvbVRhc2tEZWZpbml0aW9uQXJuKFxuICAgICAgICB0aGlzLFxuICAgICAgICAnV29ya2VyVGFza0RlZicsXG4gICAgICAgIHRhc2tEZWZpbml0aW9uQXJuXG4gICAgICApLFxuICAgICAgbGF1bmNoVGFyZ2V0OiBuZXcgdGFza3MuRWNzRmFyZ2F0ZUxhdW5jaFRhcmdldCgpLFxuICAgICAgYXNzaWduUHVibGljSXA6IGZhbHNlLFxuICAgICAgc3VibmV0czogeyBzdWJuZXRzOiB2cGMucHJpdmF0ZVN1Ym5ldHMgfSxcbiAgICAgIGNvbnRhaW5lck92ZXJyaWRlczogW1xuICAgICAgICB7XG4gICAgICAgICAgY29udGFpbmVyRGVmaW5pdGlvbjogZWNzLkNvbnRhaW5lckRlZmluaXRpb24uZnJvbUNvbnRhaW5lckRlZmluaXRpb25OYW1lKFxuICAgICAgICAgICAgZWNzLlRhc2tEZWZpbml0aW9uLmZyb21UYXNrRGVmaW5pdGlvbkFybih0aGlzLCAnV29ya2VyVGFza0RlZlJlZicsIHRhc2tEZWZpbml0aW9uQXJuKSxcbiAgICAgICAgICAgICdXb3JrZXJDb250YWluZXInXG4gICAgICAgICAgKSxcbiAgICAgICAgICBlbnZpcm9ubWVudDogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBuYW1lOiAnSk9CX0lEJyxcbiAgICAgICAgICAgICAgdmFsdWU6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBpbnRlZ3JhdGlvblBhdHRlcm46IHNmbi5JbnRlZ3JhdGlvblBhdHRlcm4uUlVOX0pPQixcbiAgICAgIHJlc3VsdFBhdGg6ICckLnByb2Nlc3NSZXN1bHQnLFxuICAgIH0pO1xuXG4gICAgLy8gVXBkYXRlIGpvYiBzdGF0dXMgdG8gY29tcGxldGVkXG4gICAgY29uc3QgaGFuZGxlU3VjY2VzcyA9IG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHRoaXMsICdIYW5kbGVTdWNjZXNzJywge1xuICAgICAgdGFibGU6IHByb3BzLnRhYmxlc01hcC5qb2JzLFxuICAgICAga2V5OiB7XG4gICAgICAgIGpvYl9pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJykpLFxuICAgICAgfSxcbiAgICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIGNvbXBsZXRlZF9hdCA9IDpjb21wbGV0ZWRfYXQsIHVwZGF0ZWRfYXQgPSA6dXBkYXRlZF9hdCcsXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICAgIH0sXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygnY29tcGxldGVkJyksXG4gICAgICAgICc6Y29tcGxldGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICAgICAgICAnOnVwZGF0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gVXBkYXRlIGpvYiBzdGF0dXMgdG8gZmFpbGVkXG4gICAgY29uc3QgaGFuZGxlRmFpbHVyZSA9IG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHRoaXMsICdIYW5kbGVGYWlsdXJlJywge1xuICAgICAgdGFibGU6IHByb3BzLnRhYmxlc01hcC5qb2JzLFxuICAgICAga2V5OiB7XG4gICAgICAgIGpvYl9pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuam9iX2lkJykpLFxuICAgICAgfSxcbiAgICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIGVycm9yX21lc3NhZ2UgPSA6ZXJyb3IsIHVwZGF0ZWRfYXQgPSA6dXBkYXRlZF9hdCcsXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICAgIH0sXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygnZmFpbGVkJyksXG4gICAgICAgICc6ZXJyb3InOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdFcnJvciBvY2N1cnJlZCcpLFxuICAgICAgICAnOnVwZGF0ZWRfYXQnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gRGVmaW5lIHdvcmtmbG93IHdpdGggZXJyb3IgaGFuZGxpbmdcbiAgICAvLyBXcmFwIHRoZSBwcm9jZXNzIGluIGEgcGFyYWxsZWwgc3RhdGUgZm9yIGVycm9yIGhhbmRsaW5nXG4gICAgY29uc3QgdHJ5UHJvY2VzcyA9IG5ldyBzZm4uUGFyYWxsZWwodGhpcywgJ1RyeVByb2Nlc3MnLCB7XG4gICAgICByZXN1bHRQYXRoOiAnJC5wYXJhbGxlbFJlc3VsdCcsXG4gICAgfSk7XG4gICAgXG4gICAgdHJ5UHJvY2Vzcy5icmFuY2gocHJvY2Vzc0pvYik7XG4gICAgdHJ5UHJvY2Vzcy5hZGRDYXRjaChoYW5kbGVGYWlsdXJlLCB7XG4gICAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkZWZpbml0aW9uID0gdXBkYXRlSm9iU3RhdHVzXG4gICAgICAubmV4dCh0cnlQcm9jZXNzKVxuICAgICAgLm5leHQoaGFuZGxlU3VjY2Vzcyk7XG5cbiAgICAvLyBDcmVhdGUgU3RhdGUgTWFjaGluZVxuICAgIHRoaXMuc3RhdGVNYWNoaW5lID0gbmV3IHNmbi5TdGF0ZU1hY2hpbmUodGhpcywgJ0pvYlByb2Nlc3NvclN0YXRlTWFjaGluZScsIHtcbiAgICAgIHN0YXRlTWFjaGluZU5hbWU6ICdsZWFkbWFnbmV0LWpvYi1wcm9jZXNzb3InLFxuICAgICAgZGVmaW5pdGlvbkJvZHk6IHNmbi5EZWZpbml0aW9uQm9keS5mcm9tQ2hhaW5hYmxlKGRlZmluaXRpb24pLFxuICAgICAgcm9sZTogc3RhdGVNYWNoaW5lUm9sZSxcbiAgICAgIGxvZ3M6IHtcbiAgICAgICAgZGVzdGluYXRpb246IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdTdGF0ZU1hY2hpbmVMb2dHcm91cCcsIHtcbiAgICAgICAgICBsb2dHcm91cE5hbWU6ICcvYXdzL3N0ZXBmdW5jdGlvbnMvbGVhZG1hZ25ldC1qb2ItcHJvY2Vzc29yJyxcbiAgICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgICB9KSxcbiAgICAgICAgbGV2ZWw6IHNmbi5Mb2dMZXZlbC5BTEwsXG4gICAgICAgIGluY2x1ZGVFeGVjdXRpb25EYXRhOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHRyYWNpbmdFbmFibGVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5zdGF0ZU1hY2hpbmVBcm4gPSB0aGlzLnN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm47XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBvdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N0YXRlTWFjaGluZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm4sXG4gICAgICBleHBvcnROYW1lOiAnU3RhdGVNYWNoaW5lQXJuJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbHVzdGVyTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNsdXN0ZXIuY2x1c3Rlck5hbWUsXG4gICAgICBleHBvcnROYW1lOiAnQ2x1c3Rlck5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZwY0lkJywge1xuICAgICAgdmFsdWU6IHZwYy52cGNJZCxcbiAgICAgIGV4cG9ydE5hbWU6ICdWcGNJZCcsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==