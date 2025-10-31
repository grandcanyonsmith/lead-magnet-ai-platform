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
exports.WorkerStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
class WorkerStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create ECR Repository for worker image
        this.ecrRepository = new ecr.Repository(this, 'WorkerRepository', {
            repositoryName: 'leadmagnet/worker',
            imageScanOnPush: true,
            imageTagMutability: ecr.TagMutability.MUTABLE,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            lifecycleRules: [
                {
                    description: 'Keep last 10 images',
                    maxImageCount: 10,
                },
            ],
        });
        // Create Task Execution Role
        const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
            ],
        });
        // Grant ECR permissions
        this.ecrRepository.grantPull(taskExecutionRole);
        // Grant Secrets Manager permissions
        taskExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['secretsmanager:GetSecretValue'],
            resources: [
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:leadmagnet/*`,
            ],
        }));
        // Create Task Role
        const taskRole = new iam.Role(this, 'TaskRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
            ],
        });
        // Grant DynamoDB permissions
        Object.values(props.tablesMap).forEach((table) => {
            table.grantReadWriteData(taskRole);
        });
        // Grant S3 permissions
        props.artifactsBucket.grantReadWrite(taskRole);
        // Grant Secrets Manager permissions
        taskRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['secretsmanager:GetSecretValue'],
            resources: [
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:leadmagnet/*`,
            ],
        }));
        // Create Fargate Task Definition
        this.taskDefinition = new ecs.FargateTaskDefinition(this, 'WorkerTaskDefinition', {
            memoryLimitMiB: 4096,
            cpu: 2048,
            executionRole: taskExecutionRole,
            taskRole: taskRole,
            family: 'leadmagnet-worker',
        });
        // Create Log Group
        const logGroup = new logs.LogGroup(this, 'WorkerLogGroup', {
            logGroupName: '/ecs/leadmagnet-worker',
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Add Container to Task Definition
        const container = this.taskDefinition.addContainer('WorkerContainer', {
            image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, 'latest'),
            memoryLimitMiB: 4096,
            cpu: 2048,
            environment: {
                AWS_REGION: this.region,
                WORKFLOWS_TABLE: props.tablesMap.workflows.tableName,
                FORMS_TABLE: props.tablesMap.forms.tableName,
                SUBMISSIONS_TABLE: props.tablesMap.submissions.tableName,
                JOBS_TABLE: props.tablesMap.jobs.tableName,
                ARTIFACTS_TABLE: props.tablesMap.artifacts.tableName,
                TEMPLATES_TABLE: props.tablesMap.templates.tableName,
                ARTIFACTS_BUCKET: props.artifactsBucket.bucketName,
                OPENAI_SECRET_NAME: 'leadmagnet/openai-api-key',
                LOG_LEVEL: 'info',
            },
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'worker',
                logGroup: logGroup,
            }),
        });
        // CloudFormation outputs
        new cdk.CfnOutput(this, 'TaskDefinitionArn', {
            value: this.taskDefinition.taskDefinitionArn,
            exportName: 'WorkerTaskDefinitionArn',
        });
        new cdk.CfnOutput(this, 'EcrRepositoryUri', {
            value: this.ecrRepository.repositoryUri,
            exportName: 'WorkerEcrRepositoryUri',
        });
        new cdk.CfnOutput(this, 'EcrRepositoryName', {
            value: this.ecrRepository.repositoryName,
            exportName: 'WorkerEcrRepositoryName',
        });
    }
}
exports.WorkerStack = WorkerStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid29ya2VyLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5REFBMkM7QUFHM0MseURBQTJDO0FBQzNDLDJEQUE2QztBQUM3Qyx5REFBMkM7QUFTM0MsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFJeEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF1QjtRQUMvRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qix5Q0FBeUM7UUFDekMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ2hFLGNBQWMsRUFBRSxtQkFBbUI7WUFDbkMsZUFBZSxFQUFFLElBQUk7WUFDckIsa0JBQWtCLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQzdDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07WUFDdkMsY0FBYyxFQUFFO2dCQUNkO29CQUNFLFdBQVcsRUFBRSxxQkFBcUI7b0JBQ2xDLGFBQWEsRUFBRSxFQUFFO2lCQUNsQjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsNkJBQTZCO1FBQzdCLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUNoRSxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMseUJBQXlCLENBQUM7WUFDOUQsZUFBZSxFQUFFO2dCQUNmLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsK0NBQStDLENBQUM7YUFDNUY7U0FDRixDQUFDLENBQUM7UUFFSCx3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLGFBQWEsQ0FB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LFNBQVM7Z0JBQzFDLGVBQWUsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTO2dCQUNwRCxlQUFlLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUztnQkFDcEQsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLGVBQWUsQ0FBQyxVQUFVO2dCQUNsRCxrQkFBa0IsRUFBRSwyQkFBMkI7Z0JBQy9DLFNBQVMsRUFBRSxNQUFNO2FBQ2xCO1lBQ0QsT0FBTyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDO2dCQUM5QixZQUFZLEVBQUUsUUFBUTtnQkFDdEIsUUFBUSxFQUFFLFFBQVE7YUFDbkIsQ0FBQztTQUNILENBQUMsQ0FBQztRQUVILHlCQUF5QjtRQUN6QixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQjtZQUM1QyxVQUFVLEVBQUUseUJBQXlCO1NBQ3RDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYTtZQUN2QyxVQUFVLEVBQUUsd0JBQXdCO1NBQ3JDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYztZQUN4QyxVQUFVLEVBQUUseUJBQXlCO1NBQ3RDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTdIRCxrQ0E2SEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGVjciBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdvcmtlclN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGNsdXN0ZXI6IGVjcy5DbHVzdGVyO1xuICB0YWJsZXNNYXA6IFJlY29yZDxzdHJpbmcsIGR5bmFtb2RiLlRhYmxlPjtcbiAgYXJ0aWZhY3RzQnVja2V0OiBzMy5CdWNrZXQ7XG59XG5cbmV4cG9ydCBjbGFzcyBXb3JrZXJTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSB0YXNrRGVmaW5pdGlvbjogZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGVjclJlcG9zaXRvcnk6IGVjci5SZXBvc2l0b3J5O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBXb3JrZXJTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBDcmVhdGUgRUNSIFJlcG9zaXRvcnkgZm9yIHdvcmtlciBpbWFnZVxuICAgIHRoaXMuZWNyUmVwb3NpdG9yeSA9IG5ldyBlY3IuUmVwb3NpdG9yeSh0aGlzLCAnV29ya2VyUmVwb3NpdG9yeScsIHtcbiAgICAgIHJlcG9zaXRvcnlOYW1lOiAnbGVhZG1hZ25ldC93b3JrZXInLFxuICAgICAgaW1hZ2VTY2FuT25QdXNoOiB0cnVlLFxuICAgICAgaW1hZ2VUYWdNdXRhYmlsaXR5OiBlY3IuVGFnTXV0YWJpbGl0eS5NVVRBQkxFLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnS2VlcCBsYXN0IDEwIGltYWdlcycsXG4gICAgICAgICAgbWF4SW1hZ2VDb3VudDogMTAsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFRhc2sgRXhlY3V0aW9uIFJvbGVcbiAgICBjb25zdCB0YXNrRXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnVGFza0V4ZWN1dGlvblJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZWNzLXRhc2tzLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BbWF6b25FQ1NUYXNrRXhlY3V0aW9uUm9sZVBvbGljeScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IEVDUiBwZXJtaXNzaW9uc1xuICAgIHRoaXMuZWNyUmVwb3NpdG9yeS5ncmFudFB1bGwodGFza0V4ZWN1dGlvblJvbGUpO1xuXG4gICAgLy8gR3JhbnQgU2VjcmV0cyBNYW5hZ2VyIHBlcm1pc3Npb25zXG4gICAgdGFza0V4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogWydzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZSddLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpzZWNyZXRzbWFuYWdlcjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06c2VjcmV0OmxlYWRtYWduZXQvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgVGFzayBSb2xlXG4gICAgY29uc3QgdGFza1JvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1Rhc2tSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Vjcy10YXNrcy5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBV1NYUmF5RGFlbW9uV3JpdGVBY2Nlc3MnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9uc1xuICAgIE9iamVjdC52YWx1ZXMocHJvcHMudGFibGVzTWFwKS5mb3JFYWNoKCh0YWJsZSkgPT4ge1xuICAgICAgdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRhc2tSb2xlKTtcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IFMzIHBlcm1pc3Npb25zXG4gICAgcHJvcHMuYXJ0aWZhY3RzQnVja2V0LmdyYW50UmVhZFdyaXRlKHRhc2tSb2xlKTtcblxuICAgIC8vIEdyYW50IFNlY3JldHMgTWFuYWdlciBwZXJtaXNzaW9uc1xuICAgIHRhc2tSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFsnc2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWUnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6c2VjcmV0c21hbmFnZXI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnNlY3JldDpsZWFkbWFnbmV0LypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIEZhcmdhdGUgVGFzayBEZWZpbml0aW9uXG4gICAgdGhpcy50YXNrRGVmaW5pdGlvbiA9IG5ldyBlY3MuRmFyZ2F0ZVRhc2tEZWZpbml0aW9uKHRoaXMsICdXb3JrZXJUYXNrRGVmaW5pdGlvbicsIHtcbiAgICAgIG1lbW9yeUxpbWl0TWlCOiA0MDk2LFxuICAgICAgY3B1OiAyMDQ4LFxuICAgICAgZXhlY3V0aW9uUm9sZTogdGFza0V4ZWN1dGlvblJvbGUsXG4gICAgICB0YXNrUm9sZTogdGFza1JvbGUsXG4gICAgICBmYW1pbHk6ICdsZWFkbWFnbmV0LXdvcmtlcicsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgTG9nIEdyb3VwXG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnV29ya2VyTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6ICcvZWNzL2xlYWRtYWduZXQtd29ya2VyJyxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBDb250YWluZXIgdG8gVGFzayBEZWZpbml0aW9uXG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy50YXNrRGVmaW5pdGlvbi5hZGRDb250YWluZXIoJ1dvcmtlckNvbnRhaW5lcicsIHtcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUVjclJlcG9zaXRvcnkodGhpcy5lY3JSZXBvc2l0b3J5LCAnbGF0ZXN0JyksXG4gICAgICBtZW1vcnlMaW1pdE1pQjogNDA5NixcbiAgICAgIGNwdTogMjA0OCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEFXU19SRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICBXT1JLRkxPV1NfVEFCTEU6IHByb3BzLnRhYmxlc01hcC53b3JrZmxvd3MudGFibGVOYW1lLFxuICAgICAgICBGT1JNU19UQUJMRTogcHJvcHMudGFibGVzTWFwLmZvcm1zLnRhYmxlTmFtZSxcbiAgICAgICAgU1VCTUlTU0lPTlNfVEFCTEU6IHByb3BzLnRhYmxlc01hcC5zdWJtaXNzaW9ucy50YWJsZU5hbWUsXG4gICAgICAgIEpPQlNfVEFCTEU6IHByb3BzLnRhYmxlc01hcC5qb2JzLnRhYmxlTmFtZSxcbiAgICAgICAgQVJUSUZBQ1RTX1RBQkxFOiBwcm9wcy50YWJsZXNNYXAuYXJ0aWZhY3RzLnRhYmxlTmFtZSxcbiAgICAgICAgVEVNUExBVEVTX1RBQkxFOiBwcm9wcy50YWJsZXNNYXAudGVtcGxhdGVzLnRhYmxlTmFtZSxcbiAgICAgICAgQVJUSUZBQ1RTX0JVQ0tFVDogcHJvcHMuYXJ0aWZhY3RzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIE9QRU5BSV9TRUNSRVRfTkFNRTogJ2xlYWRtYWduZXQvb3BlbmFpLWFwaS1rZXknLFxuICAgICAgICBMT0dfTEVWRUw6ICdpbmZvJyxcbiAgICAgIH0sXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHtcbiAgICAgICAgc3RyZWFtUHJlZml4OiAnd29ya2VyJyxcbiAgICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBvdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Rhc2tEZWZpbml0aW9uQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMudGFza0RlZmluaXRpb24udGFza0RlZmluaXRpb25Bcm4sXG4gICAgICBleHBvcnROYW1lOiAnV29ya2VyVGFza0RlZmluaXRpb25Bcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0VjclJlcG9zaXRvcnlVcmknLCB7XG4gICAgICB2YWx1ZTogdGhpcy5lY3JSZXBvc2l0b3J5LnJlcG9zaXRvcnlVcmksXG4gICAgICBleHBvcnROYW1lOiAnV29ya2VyRWNyUmVwb3NpdG9yeVVyaScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRWNyUmVwb3NpdG9yeU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5lY3JSZXBvc2l0b3J5LnJlcG9zaXRvcnlOYW1lLFxuICAgICAgZXhwb3J0TmFtZTogJ1dvcmtlckVjclJlcG9zaXRvcnlOYW1lJyxcbiAgICB9KTtcbiAgfVxufVxuXG4iXX0=