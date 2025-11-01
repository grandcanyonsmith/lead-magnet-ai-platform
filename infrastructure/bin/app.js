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
// Stack 4: Compute (Step Functions + Lambda)
const computeStack = new compute_stack_1.ComputeStack(app, 'LeadMagnetComputeStack', {
    env,
    stackName: 'leadmagnet-compute',
    description: 'Step Functions state machine and Lambda function for job processing',
    tablesMap: databaseStack.tablesMap,
    artifactsBucket: storageStack.artifactsBucket,
    cloudfrontDomain: storageStack.distribution.distributionDomainName,
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
// Stack 6: Worker (ECR Repository - Optional, kept for potential future use)
// Note: Worker is now implemented as Lambda function in ComputeStack
// ECR repository may be kept for potential future containerized workloads
const workerStack = new worker_stack_1.WorkerStack(app, 'LeadMagnetWorkerStack', {
    env,
    stackName: 'leadmagnet-worker',
    description: 'ECR repository for worker images (optional, Lambda is now primary)',
    tablesMap: databaseStack.tablesMap,
    artifactsBucket: storageStack.artifactsBucket,
});
// Add dependencies
computeStack.addDependency(databaseStack);
computeStack.addDependency(storageStack);
apiStack.addDependency(databaseStack);
apiStack.addDependency(authStack);
apiStack.addDependency(computeStack);
workerStack.addDependency(databaseStack);
workerStack.addDependency(storageStack);
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsMERBQXNEO0FBQ3RELGtEQUE4QztBQUM5Qyx3REFBb0Q7QUFDcEQsd0RBQW9EO0FBQ3BELGdEQUE0QztBQUM1QyxzREFBa0Q7QUFFbEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7SUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVztDQUN0RCxDQUFDO0FBRUYsc0NBQXNDO0FBQ3RDLE1BQU0sYUFBYSxHQUFHLElBQUksOEJBQWEsQ0FBQyxHQUFHLEVBQUUseUJBQXlCLEVBQUU7SUFDdEUsR0FBRztJQUNILFNBQVMsRUFBRSxxQkFBcUI7SUFDaEMsV0FBVyxFQUFFLDBDQUEwQztDQUN4RCxDQUFDLENBQUM7QUFFSCxvQ0FBb0M7QUFDcEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxzQkFBUyxDQUFDLEdBQUcsRUFBRSxxQkFBcUIsRUFBRTtJQUMxRCxHQUFHO0lBQ0gsU0FBUyxFQUFFLGlCQUFpQjtJQUM1QixXQUFXLEVBQUUsc0NBQXNDO0NBQ3BELENBQUMsQ0FBQztBQUVILHFDQUFxQztBQUNyQyxNQUFNLFlBQVksR0FBRyxJQUFJLDRCQUFZLENBQUMsR0FBRyxFQUFFLHdCQUF3QixFQUFFO0lBQ25FLEdBQUc7SUFDSCxTQUFTLEVBQUUsb0JBQW9CO0lBQy9CLFdBQVcsRUFBRSxnREFBZ0Q7Q0FDOUQsQ0FBQyxDQUFDO0FBRUgsNkNBQTZDO0FBQzdDLE1BQU0sWUFBWSxHQUFHLElBQUksNEJBQVksQ0FBQyxHQUFHLEVBQUUsd0JBQXdCLEVBQUU7SUFDbkUsR0FBRztJQUNILFNBQVMsRUFBRSxvQkFBb0I7SUFDL0IsV0FBVyxFQUFFLHFFQUFxRTtJQUNsRixTQUFTLEVBQUUsYUFBYSxDQUFDLFNBQVM7SUFDbEMsZUFBZSxFQUFFLFlBQVksQ0FBQyxlQUFlO0lBQzdDLGdCQUFnQixFQUFFLFlBQVksQ0FBQyxZQUFZLENBQUMsc0JBQXNCO0NBQ25FLENBQUMsQ0FBQztBQUVILGdDQUFnQztBQUNoQyxNQUFNLFFBQVEsR0FBRyxJQUFJLG9CQUFRLENBQUMsR0FBRyxFQUFFLG9CQUFvQixFQUFFO0lBQ3ZELEdBQUc7SUFDSCxTQUFTLEVBQUUsZ0JBQWdCO0lBQzNCLFdBQVcsRUFBRSxrQ0FBa0M7SUFDL0MsUUFBUSxFQUFFLFNBQVMsQ0FBQyxRQUFRO0lBQzVCLGNBQWMsRUFBRSxTQUFTLENBQUMsY0FBYztJQUN4QyxTQUFTLEVBQUUsYUFBYSxDQUFDLFNBQVM7SUFDbEMsZUFBZSxFQUFFLFlBQVksQ0FBQyxlQUFlO0lBQzdDLGVBQWUsRUFBRSxZQUFZLENBQUMsZUFBZTtDQUM5QyxDQUFDLENBQUM7QUFFSCw2RUFBNkU7QUFDN0UscUVBQXFFO0FBQ3JFLDBFQUEwRTtBQUMxRSxNQUFNLFdBQVcsR0FBRyxJQUFJLDBCQUFXLENBQUMsR0FBRyxFQUFFLHVCQUF1QixFQUFFO0lBQ2hFLEdBQUc7SUFDSCxTQUFTLEVBQUUsbUJBQW1CO0lBQzlCLFdBQVcsRUFBRSxvRUFBb0U7SUFDakYsU0FBUyxFQUFFLGFBQWEsQ0FBQyxTQUFTO0lBQ2xDLGVBQWUsRUFBRSxZQUFZLENBQUMsZUFBZTtDQUM5QyxDQUFDLENBQUM7QUFFSCxtQkFBbUI7QUFDbkIsWUFBWSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUMxQyxZQUFZLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3pDLFFBQVEsQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDdEMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNsQyxRQUFRLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3JDLFdBQVcsQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDekMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUV4QyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgRGF0YWJhc2VTdGFjayB9IGZyb20gJy4uL2xpYi9kYXRhYmFzZS1zdGFjayc7XG5pbXBvcnQgeyBBdXRoU3RhY2sgfSBmcm9tICcuLi9saWIvYXV0aC1zdGFjayc7XG5pbXBvcnQgeyBTdG9yYWdlU3RhY2sgfSBmcm9tICcuLi9saWIvc3RvcmFnZS1zdGFjayc7XG5pbXBvcnQgeyBDb21wdXRlU3RhY2sgfSBmcm9tICcuLi9saWIvY29tcHV0ZS1zdGFjayc7XG5pbXBvcnQgeyBBcGlTdGFjayB9IGZyb20gJy4uL2xpYi9hcGktc3RhY2snO1xuaW1wb3J0IHsgV29ya2VyU3RhY2sgfSBmcm9tICcuLi9saWIvd29ya2VyLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuY29uc3QgZW52ID0ge1xuICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAndXMtZWFzdC0xJyxcbn07XG5cbi8vIFN0YWNrIDE6IERhdGFiYXNlIChEeW5hbW9EQiBUYWJsZXMpXG5jb25zdCBkYXRhYmFzZVN0YWNrID0gbmV3IERhdGFiYXNlU3RhY2soYXBwLCAnTGVhZE1hZ25ldERhdGFiYXNlU3RhY2snLCB7XG4gIGVudixcbiAgc3RhY2tOYW1lOiAnbGVhZG1hZ25ldC1kYXRhYmFzZScsXG4gIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGVzIGZvciBsZWFkIG1hZ25ldCBwbGF0Zm9ybScsXG59KTtcblxuLy8gU3RhY2sgMjogQXV0aGVudGljYXRpb24gKENvZ25pdG8pXG5jb25zdCBhdXRoU3RhY2sgPSBuZXcgQXV0aFN0YWNrKGFwcCwgJ0xlYWRNYWduZXRBdXRoU3RhY2snLCB7XG4gIGVudixcbiAgc3RhY2tOYW1lOiAnbGVhZG1hZ25ldC1hdXRoJyxcbiAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBmb3IgYXV0aGVudGljYXRpb24nLFxufSk7XG5cbi8vIFN0YWNrIDM6IFN0b3JhZ2UgKFMzICsgQ2xvdWRGcm9udClcbmNvbnN0IHN0b3JhZ2VTdGFjayA9IG5ldyBTdG9yYWdlU3RhY2soYXBwLCAnTGVhZE1hZ25ldFN0b3JhZ2VTdGFjaycsIHtcbiAgZW52LFxuICBzdGFja05hbWU6ICdsZWFkbWFnbmV0LXN0b3JhZ2UnLFxuICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldHMgYW5kIENsb3VkRnJvbnQgZm9yIGFydGlmYWN0IHN0b3JhZ2UnLFxufSk7XG5cbi8vIFN0YWNrIDQ6IENvbXB1dGUgKFN0ZXAgRnVuY3Rpb25zICsgTGFtYmRhKVxuY29uc3QgY29tcHV0ZVN0YWNrID0gbmV3IENvbXB1dGVTdGFjayhhcHAsICdMZWFkTWFnbmV0Q29tcHV0ZVN0YWNrJywge1xuICBlbnYsXG4gIHN0YWNrTmFtZTogJ2xlYWRtYWduZXQtY29tcHV0ZScsXG4gIGRlc2NyaXB0aW9uOiAnU3RlcCBGdW5jdGlvbnMgc3RhdGUgbWFjaGluZSBhbmQgTGFtYmRhIGZ1bmN0aW9uIGZvciBqb2IgcHJvY2Vzc2luZycsXG4gIHRhYmxlc01hcDogZGF0YWJhc2VTdGFjay50YWJsZXNNYXAsXG4gIGFydGlmYWN0c0J1Y2tldDogc3RvcmFnZVN0YWNrLmFydGlmYWN0c0J1Y2tldCxcbiAgY2xvdWRmcm9udERvbWFpbjogc3RvcmFnZVN0YWNrLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lLFxufSk7XG5cbi8vIFN0YWNrIDU6IEFQSSBHYXRld2F5ICsgTGFtYmRhXG5jb25zdCBhcGlTdGFjayA9IG5ldyBBcGlTdGFjayhhcHAsICdMZWFkTWFnbmV0QXBpU3RhY2snLCB7XG4gIGVudixcbiAgc3RhY2tOYW1lOiAnbGVhZG1hZ25ldC1hcGknLFxuICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IGFuZCBMYW1iZGEgZnVuY3Rpb25zJyxcbiAgdXNlclBvb2w6IGF1dGhTdGFjay51c2VyUG9vbCxcbiAgdXNlclBvb2xDbGllbnQ6IGF1dGhTdGFjay51c2VyUG9vbENsaWVudCxcbiAgdGFibGVzTWFwOiBkYXRhYmFzZVN0YWNrLnRhYmxlc01hcCxcbiAgc3RhdGVNYWNoaW5lQXJuOiBjb21wdXRlU3RhY2suc3RhdGVNYWNoaW5lQXJuLFxuICBhcnRpZmFjdHNCdWNrZXQ6IHN0b3JhZ2VTdGFjay5hcnRpZmFjdHNCdWNrZXQsXG59KTtcblxuLy8gU3RhY2sgNjogV29ya2VyIChFQ1IgUmVwb3NpdG9yeSAtIE9wdGlvbmFsLCBrZXB0IGZvciBwb3RlbnRpYWwgZnV0dXJlIHVzZSlcbi8vIE5vdGU6IFdvcmtlciBpcyBub3cgaW1wbGVtZW50ZWQgYXMgTGFtYmRhIGZ1bmN0aW9uIGluIENvbXB1dGVTdGFja1xuLy8gRUNSIHJlcG9zaXRvcnkgbWF5IGJlIGtlcHQgZm9yIHBvdGVudGlhbCBmdXR1cmUgY29udGFpbmVyaXplZCB3b3JrbG9hZHNcbmNvbnN0IHdvcmtlclN0YWNrID0gbmV3IFdvcmtlclN0YWNrKGFwcCwgJ0xlYWRNYWduZXRXb3JrZXJTdGFjaycsIHtcbiAgZW52LFxuICBzdGFja05hbWU6ICdsZWFkbWFnbmV0LXdvcmtlcicsXG4gIGRlc2NyaXB0aW9uOiAnRUNSIHJlcG9zaXRvcnkgZm9yIHdvcmtlciBpbWFnZXMgKG9wdGlvbmFsLCBMYW1iZGEgaXMgbm93IHByaW1hcnkpJyxcbiAgdGFibGVzTWFwOiBkYXRhYmFzZVN0YWNrLnRhYmxlc01hcCxcbiAgYXJ0aWZhY3RzQnVja2V0OiBzdG9yYWdlU3RhY2suYXJ0aWZhY3RzQnVja2V0LFxufSk7XG5cbi8vIEFkZCBkZXBlbmRlbmNpZXNcbmNvbXB1dGVTdGFjay5hZGREZXBlbmRlbmN5KGRhdGFiYXNlU3RhY2spO1xuY29tcHV0ZVN0YWNrLmFkZERlcGVuZGVuY3koc3RvcmFnZVN0YWNrKTtcbmFwaVN0YWNrLmFkZERlcGVuZGVuY3koZGF0YWJhc2VTdGFjayk7XG5hcGlTdGFjay5hZGREZXBlbmRlbmN5KGF1dGhTdGFjayk7XG5hcGlTdGFjay5hZGREZXBlbmRlbmN5KGNvbXB1dGVTdGFjayk7XG53b3JrZXJTdGFjay5hZGREZXBlbmRlbmN5KGRhdGFiYXNlU3RhY2spO1xud29ya2VyU3RhY2suYWRkRGVwZW5kZW5jeShzdG9yYWdlU3RhY2spO1xuXG5hcHAuc3ludGgoKTtcblxuIl19