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
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
class WorkerStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create ECR Repository for worker image (optional, kept for potential future containerized workloads)
        // Note: Worker is now implemented as Lambda function in ComputeStack
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
        // CloudFormation outputs
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid29ya2VyLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUduQyx5REFBMkM7QUFRM0MsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFHeEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF1QjtRQUMvRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qix1R0FBdUc7UUFDdkcscUVBQXFFO1FBQ3JFLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUNoRSxjQUFjLEVBQUUsbUJBQW1CO1lBQ25DLGVBQWUsRUFBRSxJQUFJO1lBQ3JCLGtCQUFrQixFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUM3QyxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO1lBQ3ZDLGNBQWMsRUFBRTtnQkFDZDtvQkFDRSxXQUFXLEVBQUUscUJBQXFCO29CQUNsQyxhQUFhLEVBQUUsRUFBRTtpQkFDbEI7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILHlCQUF5QjtRQUN6QixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWE7WUFDdkMsVUFBVSxFQUFFLHdCQUF3QjtTQUNyQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWM7WUFDeEMsVUFBVSxFQUFFLHlCQUF5QjtTQUN0QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFoQ0Qsa0NBZ0NDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgZWNyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3InO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgV29ya2VyU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgdGFibGVzTWFwOiBSZWNvcmQ8c3RyaW5nLCBkeW5hbW9kYi5UYWJsZT47XG4gIGFydGlmYWN0c0J1Y2tldDogczMuQnVja2V0O1xufVxuXG5leHBvcnQgY2xhc3MgV29ya2VyU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgZWNyUmVwb3NpdG9yeTogZWNyLlJlcG9zaXRvcnk7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFdvcmtlclN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBFQ1IgUmVwb3NpdG9yeSBmb3Igd29ya2VyIGltYWdlIChvcHRpb25hbCwga2VwdCBmb3IgcG90ZW50aWFsIGZ1dHVyZSBjb250YWluZXJpemVkIHdvcmtsb2FkcylcbiAgICAvLyBOb3RlOiBXb3JrZXIgaXMgbm93IGltcGxlbWVudGVkIGFzIExhbWJkYSBmdW5jdGlvbiBpbiBDb21wdXRlU3RhY2tcbiAgICB0aGlzLmVjclJlcG9zaXRvcnkgPSBuZXcgZWNyLlJlcG9zaXRvcnkodGhpcywgJ1dvcmtlclJlcG9zaXRvcnknLCB7XG4gICAgICByZXBvc2l0b3J5TmFtZTogJ2xlYWRtYWduZXQvd29ya2VyJyxcbiAgICAgIGltYWdlU2Nhbk9uUHVzaDogdHJ1ZSxcbiAgICAgIGltYWdlVGFnTXV0YWJpbGl0eTogZWNyLlRhZ011dGFiaWxpdHkuTVVUQUJMRSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0tlZXAgbGFzdCAxMCBpbWFnZXMnLFxuICAgICAgICAgIG1heEltYWdlQ291bnQ6IDEwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9uIG91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRWNyUmVwb3NpdG9yeVVyaScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmVjclJlcG9zaXRvcnkucmVwb3NpdG9yeVVyaSxcbiAgICAgIGV4cG9ydE5hbWU6ICdXb3JrZXJFY3JSZXBvc2l0b3J5VXJpJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFY3JSZXBvc2l0b3J5TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmVjclJlcG9zaXRvcnkucmVwb3NpdG9yeU5hbWUsXG4gICAgICBleHBvcnROYW1lOiAnV29ya2VyRWNyUmVwb3NpdG9yeU5hbWUnLFxuICAgIH0pO1xuICB9XG59XG5cbiJdfQ==