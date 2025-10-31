#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const database_stack_1 = require("../lib/database-stack");
const auth_stack_1 = require("../lib/auth-stack");
const storage_stack_1 = require("../lib/storage-stack");
const compute_stack_1 = require("../lib/compute-stack");
const api_stack_1 = require("../lib/api-stack");
const worker_stack_1 = require("../lib/worker-stack");
const app = new cdk.App();
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};
// Stack 1: Database (DynamoDB Tables)
const databaseStack = new database_stack_1.DatabaseStack(app, 'LeadMagnetDatabaseStack', {
    env,
    stackName: 'leadmagnet-database',
    description: 'DynamoDB tables for lead magnet platform',
});
// Stack 2: Authentication (Cognito)
const authStack = new auth_stack_1.AuthStack(app, 'LeadMagnetAuthStack', {
    env,
    stackName: 'leadmagnet-auth',
    description: 'Cognito User Pool for authentication',
});
// Stack 3: Storage (S3 + CloudFront)
const storageStack = new storage_stack_1.StorageStack(app, 'LeadMagnetStorageStack', {
    env,
    stackName: 'leadmagnet-storage',
    description: 'S3 buckets and CloudFront for artifact storage',
});
// Stack 4: Compute (Step Functions + ECS Cluster)
const computeStack = new compute_stack_1.ComputeStack(app, 'LeadMagnetComputeStack', {
    env,
    stackName: 'leadmagnet-compute',
    description: 'Step Functions state machine and ECS cluster',
    tablesMap: databaseStack.tablesMap,
    artifactsBucket: storageStack.artifactsBucket,
});
// Stack 5: API Gateway + Lambda
const apiStack = new api_stack_1.ApiStack(app, 'LeadMagnetApiStack', {
    env,
    stackName: 'leadmagnet-api',
    description: 'API Gateway and Lambda functions',
    userPool: authStack.userPool,
    userPoolClient: authStack.userPoolClient,
    tablesMap: databaseStack.tablesMap,
    stateMachineArn: computeStack.stateMachineArn,
    artifactsBucket: storageStack.artifactsBucket,
});
// Stack 6: Worker (ECS Task Definition)
const workerStack = new worker_stack_1.WorkerStack(app, 'LeadMagnetWorkerStack', {
    env,
    stackName: 'leadmagnet-worker',
    description: 'ECS Fargate task for AI worker',
    cluster: computeStack.cluster,
    tablesMap: databaseStack.tablesMap,
    artifactsBucket: storageStack.artifactsBucket,
});
// Update compute stack with task definition ARN
computeStack.node.addDependency(workerStack);
// Note: To fully enable ECS task invocation, you'll need to redeploy compute stack
// with the task definition ARN. For now, we'll use CloudFormation import.
// Add dependencies
computeStack.addDependency(databaseStack);
computeStack.addDependency(storageStack);
apiStack.addDependency(databaseStack);
apiStack.addDependency(authStack);
apiStack.addDependency(computeStack);
workerStack.addDependency(computeStack);
workerStack.addDependency(databaseStack);
workerStack.addDependency(storageStack);
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsMERBQXNEO0FBQ3RELGtEQUE4QztBQUM5Qyx3REFBb0Q7QUFDcEQsd0RBQW9EO0FBQ3BELGdEQUE0QztBQUM1QyxzREFBa0Q7QUFFbEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7SUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVztDQUN0RCxDQUFDO0FBRUYsc0NBQXNDO0FBQ3RDLE1BQU0sYUFBYSxHQUFHLElBQUksOEJBQWEsQ0FBQyxHQUFHLEVBQUUseUJBQXlCLEVBQUU7SUFDdEUsR0FBRztJQUNILFNBQVMsRUFBRSxxQkFBcUI7SUFDaEMsV0FBVyxFQUFFLDBDQUEwQztDQUN4RCxDQUFDLENBQUM7QUFFSCxvQ0FBb0M7QUFDcEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxzQkFBUyxDQUFDLEdBQUcsRUFBRSxxQkFBcUIsRUFBRTtJQUMxRCxHQUFHO0lBQ0gsU0FBUyxFQUFFLGlCQUFpQjtJQUM1QixXQUFXLEVBQUUsc0NBQXNDO0NBQ3BELENBQUMsQ0FBQztBQUVILHFDQUFxQztBQUNyQyxNQUFNLFlBQVksR0FBRyxJQUFJLDRCQUFZLENBQUMsR0FBRyxFQUFFLHdCQUF3QixFQUFFO0lBQ25FLEdBQUc7SUFDSCxTQUFTLEVBQUUsb0JBQW9CO0lBQy9CLFdBQVcsRUFBRSxnREFBZ0Q7Q0FDOUQsQ0FBQyxDQUFDO0FBRUgsa0RBQWtEO0FBQ2xELE1BQU0sWUFBWSxHQUFHLElBQUksNEJBQVksQ0FBQyxHQUFHLEVBQUUsd0JBQXdCLEVBQUU7SUFDbkUsR0FBRztJQUNILFNBQVMsRUFBRSxvQkFBb0I7SUFDL0IsV0FBVyxFQUFFLDhDQUE4QztJQUMzRCxTQUFTLEVBQUUsYUFBYSxDQUFDLFNBQVM7SUFDbEMsZUFBZSxFQUFFLFlBQVksQ0FBQyxlQUFlO0NBQzlDLENBQUMsQ0FBQztBQUVILGdDQUFnQztBQUNoQyxNQUFNLFFBQVEsR0FBRyxJQUFJLG9CQUFRLENBQUMsR0FBRyxFQUFFLG9CQUFvQixFQUFFO0lBQ3ZELEdBQUc7SUFDSCxTQUFTLEVBQUUsZ0JBQWdCO0lBQzNCLFdBQVcsRUFBRSxrQ0FBa0M7SUFDL0MsUUFBUSxFQUFFLFNBQVMsQ0FBQyxRQUFRO0lBQzVCLGNBQWMsRUFBRSxTQUFTLENBQUMsY0FBYztJQUN4QyxTQUFTLEVBQUUsYUFBYSxDQUFDLFNBQVM7SUFDbEMsZUFBZSxFQUFFLFlBQVksQ0FBQyxlQUFlO0lBQzdDLGVBQWUsRUFBRSxZQUFZLENBQUMsZUFBZTtDQUM5QyxDQUFDLENBQUM7QUFFSCx3Q0FBd0M7QUFDeEMsTUFBTSxXQUFXLEdBQUcsSUFBSSwwQkFBVyxDQUFDLEdBQUcsRUFBRSx1QkFBdUIsRUFBRTtJQUNoRSxHQUFHO0lBQ0gsU0FBUyxFQUFFLG1CQUFtQjtJQUM5QixXQUFXLEVBQUUsZ0NBQWdDO0lBQzdDLE9BQU8sRUFBRSxZQUFZLENBQUMsT0FBTztJQUM3QixTQUFTLEVBQUUsYUFBYSxDQUFDLFNBQVM7SUFDbEMsZUFBZSxFQUFFLFlBQVksQ0FBQyxlQUFlO0NBQzlDLENBQUMsQ0FBQztBQUVILGdEQUFnRDtBQUNoRCxZQUFZLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUM3QyxtRkFBbUY7QUFDbkYsMEVBQTBFO0FBRTFFLG1CQUFtQjtBQUNuQixZQUFZLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQzFDLFlBQVksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDekMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUN0QyxRQUFRLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ2xDLFFBQVEsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDckMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN4QyxXQUFXLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ3pDLFdBQVcsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7QUFFeEMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IERhdGFiYXNlU3RhY2sgfSBmcm9tICcuLi9saWIvZGF0YWJhc2Utc3RhY2snO1xuaW1wb3J0IHsgQXV0aFN0YWNrIH0gZnJvbSAnLi4vbGliL2F1dGgtc3RhY2snO1xuaW1wb3J0IHsgU3RvcmFnZVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0b3JhZ2Utc3RhY2snO1xuaW1wb3J0IHsgQ29tcHV0ZVN0YWNrIH0gZnJvbSAnLi4vbGliL2NvbXB1dGUtc3RhY2snO1xuaW1wb3J0IHsgQXBpU3RhY2sgfSBmcm9tICcuLi9saWIvYXBpLXN0YWNrJztcbmltcG9ydCB7IFdvcmtlclN0YWNrIH0gZnJvbSAnLi4vbGliL3dvcmtlci1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbmNvbnN0IGVudiA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMScsXG59O1xuXG4vLyBTdGFjayAxOiBEYXRhYmFzZSAoRHluYW1vREIgVGFibGVzKVxuY29uc3QgZGF0YWJhc2VTdGFjayA9IG5ldyBEYXRhYmFzZVN0YWNrKGFwcCwgJ0xlYWRNYWduZXREYXRhYmFzZVN0YWNrJywge1xuICBlbnYsXG4gIHN0YWNrTmFtZTogJ2xlYWRtYWduZXQtZGF0YWJhc2UnLFxuICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHRhYmxlcyBmb3IgbGVhZCBtYWduZXQgcGxhdGZvcm0nLFxufSk7XG5cbi8vIFN0YWNrIDI6IEF1dGhlbnRpY2F0aW9uIChDb2duaXRvKVxuY29uc3QgYXV0aFN0YWNrID0gbmV3IEF1dGhTdGFjayhhcHAsICdMZWFkTWFnbmV0QXV0aFN0YWNrJywge1xuICBlbnYsXG4gIHN0YWNrTmFtZTogJ2xlYWRtYWduZXQtYXV0aCcsXG4gIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgZm9yIGF1dGhlbnRpY2F0aW9uJyxcbn0pO1xuXG4vLyBTdGFjayAzOiBTdG9yYWdlIChTMyArIENsb3VkRnJvbnQpXG5jb25zdCBzdG9yYWdlU3RhY2sgPSBuZXcgU3RvcmFnZVN0YWNrKGFwcCwgJ0xlYWRNYWduZXRTdG9yYWdlU3RhY2snLCB7XG4gIGVudixcbiAgc3RhY2tOYW1lOiAnbGVhZG1hZ25ldC1zdG9yYWdlJyxcbiAgZGVzY3JpcHRpb246ICdTMyBidWNrZXRzIGFuZCBDbG91ZEZyb250IGZvciBhcnRpZmFjdCBzdG9yYWdlJyxcbn0pO1xuXG4vLyBTdGFjayA0OiBDb21wdXRlIChTdGVwIEZ1bmN0aW9ucyArIEVDUyBDbHVzdGVyKVxuY29uc3QgY29tcHV0ZVN0YWNrID0gbmV3IENvbXB1dGVTdGFjayhhcHAsICdMZWFkTWFnbmV0Q29tcHV0ZVN0YWNrJywge1xuICBlbnYsXG4gIHN0YWNrTmFtZTogJ2xlYWRtYWduZXQtY29tcHV0ZScsXG4gIGRlc2NyaXB0aW9uOiAnU3RlcCBGdW5jdGlvbnMgc3RhdGUgbWFjaGluZSBhbmQgRUNTIGNsdXN0ZXInLFxuICB0YWJsZXNNYXA6IGRhdGFiYXNlU3RhY2sudGFibGVzTWFwLFxuICBhcnRpZmFjdHNCdWNrZXQ6IHN0b3JhZ2VTdGFjay5hcnRpZmFjdHNCdWNrZXQsXG59KTtcblxuLy8gU3RhY2sgNTogQVBJIEdhdGV3YXkgKyBMYW1iZGFcbmNvbnN0IGFwaVN0YWNrID0gbmV3IEFwaVN0YWNrKGFwcCwgJ0xlYWRNYWduZXRBcGlTdGFjaycsIHtcbiAgZW52LFxuICBzdGFja05hbWU6ICdsZWFkbWFnbmV0LWFwaScsXG4gIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgYW5kIExhbWJkYSBmdW5jdGlvbnMnLFxuICB1c2VyUG9vbDogYXV0aFN0YWNrLnVzZXJQb29sLFxuICB1c2VyUG9vbENsaWVudDogYXV0aFN0YWNrLnVzZXJQb29sQ2xpZW50LFxuICB0YWJsZXNNYXA6IGRhdGFiYXNlU3RhY2sudGFibGVzTWFwLFxuICBzdGF0ZU1hY2hpbmVBcm46IGNvbXB1dGVTdGFjay5zdGF0ZU1hY2hpbmVBcm4sXG4gIGFydGlmYWN0c0J1Y2tldDogc3RvcmFnZVN0YWNrLmFydGlmYWN0c0J1Y2tldCxcbn0pO1xuXG4vLyBTdGFjayA2OiBXb3JrZXIgKEVDUyBUYXNrIERlZmluaXRpb24pXG5jb25zdCB3b3JrZXJTdGFjayA9IG5ldyBXb3JrZXJTdGFjayhhcHAsICdMZWFkTWFnbmV0V29ya2VyU3RhY2snLCB7XG4gIGVudixcbiAgc3RhY2tOYW1lOiAnbGVhZG1hZ25ldC13b3JrZXInLFxuICBkZXNjcmlwdGlvbjogJ0VDUyBGYXJnYXRlIHRhc2sgZm9yIEFJIHdvcmtlcicsXG4gIGNsdXN0ZXI6IGNvbXB1dGVTdGFjay5jbHVzdGVyLFxuICB0YWJsZXNNYXA6IGRhdGFiYXNlU3RhY2sudGFibGVzTWFwLFxuICBhcnRpZmFjdHNCdWNrZXQ6IHN0b3JhZ2VTdGFjay5hcnRpZmFjdHNCdWNrZXQsXG59KTtcblxuLy8gVXBkYXRlIGNvbXB1dGUgc3RhY2sgd2l0aCB0YXNrIGRlZmluaXRpb24gQVJOXG5jb21wdXRlU3RhY2subm9kZS5hZGREZXBlbmRlbmN5KHdvcmtlclN0YWNrKTtcbi8vIE5vdGU6IFRvIGZ1bGx5IGVuYWJsZSBFQ1MgdGFzayBpbnZvY2F0aW9uLCB5b3UnbGwgbmVlZCB0byByZWRlcGxveSBjb21wdXRlIHN0YWNrXG4vLyB3aXRoIHRoZSB0YXNrIGRlZmluaXRpb24gQVJOLiBGb3Igbm93LCB3ZSdsbCB1c2UgQ2xvdWRGb3JtYXRpb24gaW1wb3J0LlxuXG4vLyBBZGQgZGVwZW5kZW5jaWVzXG5jb21wdXRlU3RhY2suYWRkRGVwZW5kZW5jeShkYXRhYmFzZVN0YWNrKTtcbmNvbXB1dGVTdGFjay5hZGREZXBlbmRlbmN5KHN0b3JhZ2VTdGFjayk7XG5hcGlTdGFjay5hZGREZXBlbmRlbmN5KGRhdGFiYXNlU3RhY2spO1xuYXBpU3RhY2suYWRkRGVwZW5kZW5jeShhdXRoU3RhY2spO1xuYXBpU3RhY2suYWRkRGVwZW5kZW5jeShjb21wdXRlU3RhY2spO1xud29ya2VyU3RhY2suYWRkRGVwZW5kZW5jeShjb21wdXRlU3RhY2spO1xud29ya2VyU3RhY2suYWRkRGVwZW5kZW5jeShkYXRhYmFzZVN0YWNrKTtcbndvcmtlclN0YWNrLmFkZERlcGVuZGVuY3koc3RvcmFnZVN0YWNrKTtcblxuYXBwLnN5bnRoKCk7XG5cbiJdfQ==