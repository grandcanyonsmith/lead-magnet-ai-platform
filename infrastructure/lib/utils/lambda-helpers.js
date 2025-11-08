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
exports.createLambdaRole = createLambdaRole;
exports.grantDynamoDBPermissions = grantDynamoDBPermissions;
exports.grantS3Permissions = grantS3Permissions;
exports.grantSecretsAccess = grantSecretsAccess;
exports.createLambdaWithTables = createLambdaWithTables;
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const environment_helpers_1 = require("./environment-helpers");
/**
 * Creates a Lambda execution role with standard policies
 */
function createLambdaRole(scope, id, options) {
    const managedPolicies = [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
    ];
    if (options?.includeXRay) {
        managedPolicies.push(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'));
    }
    return new iam.Role(scope, id, {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies,
    });
}
/**
 * Grants DynamoDB permissions to a role or function
 */
function grantDynamoDBPermissions(grantable, tablesMap) {
    Object.values(tablesMap).forEach((table) => {
        table.grantReadWriteData(grantable);
    });
}
/**
 * Grants S3 permissions to a role or function
 */
function grantS3Permissions(grantable, bucket) {
    bucket.grantReadWrite(grantable);
}
/**
 * Grants Secrets Manager access to a role or function
 */
function grantSecretsAccess(grantable, scope, secretNames) {
    secretNames.forEach((secretName) => {
        const secret = secretsmanager.Secret.fromSecretNameV2(scope, `Secret${secretName.replace(/[^a-zA-Z0-9]/g, '')}`, secretName);
        secret.grantRead(grantable);
    });
}
function createLambdaWithTables(scope, id, tablesMap, artifactsBucket, options) {
    // Create role if not provided
    const role = options.role || createLambdaRole(scope, `${id}Role`, {
        includeXRay: options.tracing === lambda.Tracing.ACTIVE,
    });
    // Create environment variables from tables
    const tableEnvVars = (0, environment_helpers_1.createTableEnvironmentVars)(tablesMap);
    const environment = {
        ...tableEnvVars,
        ARTIFACTS_BUCKET: artifactsBucket.bucketName,
        ...options.environment,
    };
    // Create Lambda function
    const lambdaFunction = new lambda.Function(scope, id, {
        runtime: options.runtime,
        handler: options.handler,
        code: options.code,
        timeout: options.timeout,
        memorySize: options.memorySize,
        environment,
        role,
        logRetention: options.logRetention,
        tracing: options.tracing,
        logGroup: options.logGroup,
    });
    // Grant permissions
    grantDynamoDBPermissions(lambdaFunction, tablesMap);
    grantS3Permissions(lambdaFunction, artifactsBucket);
    return lambdaFunction;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLWhlbHBlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsYW1iZGEtaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWNBLDRDQXFCQztBQUtELDREQU9DO0FBS0QsZ0RBS0M7QUFLRCxnREFTQztBQWtCRCx3REF1Q0M7QUEvSEQsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUczQywrRUFBaUU7QUFJakUsK0RBQW1FO0FBRW5FOztHQUVHO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQzlCLEtBQWdCLEVBQ2hCLEVBQVUsRUFDVixPQUVDO0lBRUQsTUFBTSxlQUFlLEdBQUc7UUFDdEIsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQywwQ0FBMEMsQ0FBQztLQUN2RixDQUFDO0lBRUYsSUFBSSxPQUFPLEVBQUUsV0FBVyxFQUFFLENBQUM7UUFDekIsZUFBZSxDQUFDLElBQUksQ0FDbEIsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQywwQkFBMEIsQ0FBQyxDQUN2RSxDQUFDO0lBQ0osQ0FBQztJQUVELE9BQU8sSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUU7UUFDN0IsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1FBQzNELGVBQWU7S0FDaEIsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isd0JBQXdCLENBQ3RDLFNBQXlCLEVBQ3pCLFNBQW1CO0lBRW5CLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7UUFDekMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3RDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isa0JBQWtCLENBQ2hDLFNBQXlCLEVBQ3pCLE1BQWlCO0lBRWpCLE1BQU0sQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDbkMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isa0JBQWtCLENBQ2hDLFNBQXlCLEVBQ3pCLEtBQWdCLEVBQ2hCLFdBQXFCO0lBRXJCLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBRTtRQUNqQyxNQUFNLE1BQU0sR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxTQUFTLFVBQVUsQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDN0gsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUM5QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFrQkQsU0FBZ0Isc0JBQXNCLENBQ3BDLEtBQWdCLEVBQ2hCLEVBQVUsRUFDVixTQUFtQixFQUNuQixlQUEwQixFQUMxQixPQUFzQztJQUV0Qyw4QkFBOEI7SUFDOUIsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRTtRQUNoRSxXQUFXLEVBQUUsT0FBTyxDQUFDLE9BQU8sS0FBSyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU07S0FDdkQsQ0FBQyxDQUFDO0lBRUgsMkNBQTJDO0lBQzNDLE1BQU0sWUFBWSxHQUFHLElBQUEsZ0RBQTBCLEVBQUMsU0FBUyxDQUFDLENBQUM7SUFDM0QsTUFBTSxXQUFXLEdBQUc7UUFDbEIsR0FBRyxZQUFZO1FBQ2YsZ0JBQWdCLEVBQUUsZUFBZSxDQUFDLFVBQVU7UUFDNUMsR0FBRyxPQUFPLENBQUMsV0FBVztLQUN2QixDQUFDO0lBRUYseUJBQXlCO0lBQ3pCLE1BQU0sY0FBYyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFO1FBQ3BELE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztRQUN4QixPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87UUFDeEIsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJO1FBQ2xCLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztRQUN4QixVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVU7UUFDOUIsV0FBVztRQUNYLElBQUk7UUFDSixZQUFZLEVBQUUsT0FBTyxDQUFDLFlBQVk7UUFDbEMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO1FBQ3hCLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtLQUMzQixDQUFDLENBQUM7SUFFSCxvQkFBb0I7SUFDcEIsd0JBQXdCLENBQUMsY0FBYyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3BELGtCQUFrQixDQUFDLGNBQWMsRUFBRSxlQUFlLENBQUMsQ0FBQztJQUVwRCxPQUFPLGNBQWMsQ0FBQztBQUN4QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBUYWJsZU1hcCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGNyZWF0ZVRhYmxlRW52aXJvbm1lbnRWYXJzIH0gZnJvbSAnLi9lbnZpcm9ubWVudC1oZWxwZXJzJztcblxuLyoqXG4gKiBDcmVhdGVzIGEgTGFtYmRhIGV4ZWN1dGlvbiByb2xlIHdpdGggc3RhbmRhcmQgcG9saWNpZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxhbWJkYVJvbGUoXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIGlkOiBzdHJpbmcsXG4gIG9wdGlvbnM/OiB7XG4gICAgaW5jbHVkZVhSYXk/OiBib29sZWFuO1xuICB9XG4pOiBpYW0uUm9sZSB7XG4gIGNvbnN0IG1hbmFnZWRQb2xpY2llcyA9IFtcbiAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgXTtcblxuICBpZiAob3B0aW9ucz8uaW5jbHVkZVhSYXkpIHtcbiAgICBtYW5hZ2VkUG9saWNpZXMucHVzaChcbiAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQVdTWFJheURhZW1vbldyaXRlQWNjZXNzJylcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBpYW0uUm9sZShzY29wZSwgaWQsIHtcbiAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICBtYW5hZ2VkUG9saWNpZXMsXG4gIH0pO1xufVxuXG4vKipcbiAqIEdyYW50cyBEeW5hbW9EQiBwZXJtaXNzaW9ucyB0byBhIHJvbGUgb3IgZnVuY3Rpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdyYW50RHluYW1vREJQZXJtaXNzaW9ucyhcbiAgZ3JhbnRhYmxlOiBpYW0uSUdyYW50YWJsZSxcbiAgdGFibGVzTWFwOiBUYWJsZU1hcFxuKTogdm9pZCB7XG4gIE9iamVjdC52YWx1ZXModGFibGVzTWFwKS5mb3JFYWNoKCh0YWJsZSkgPT4ge1xuICAgIHRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShncmFudGFibGUpO1xuICB9KTtcbn1cblxuLyoqXG4gKiBHcmFudHMgUzMgcGVybWlzc2lvbnMgdG8gYSByb2xlIG9yIGZ1bmN0aW9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBncmFudFMzUGVybWlzc2lvbnMoXG4gIGdyYW50YWJsZTogaWFtLklHcmFudGFibGUsXG4gIGJ1Y2tldDogczMuQnVja2V0XG4pOiB2b2lkIHtcbiAgYnVja2V0LmdyYW50UmVhZFdyaXRlKGdyYW50YWJsZSk7XG59XG5cbi8qKlxuICogR3JhbnRzIFNlY3JldHMgTWFuYWdlciBhY2Nlc3MgdG8gYSByb2xlIG9yIGZ1bmN0aW9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBncmFudFNlY3JldHNBY2Nlc3MoXG4gIGdyYW50YWJsZTogaWFtLklHcmFudGFibGUsXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIHNlY3JldE5hbWVzOiBzdHJpbmdbXVxuKTogdm9pZCB7XG4gIHNlY3JldE5hbWVzLmZvckVhY2goKHNlY3JldE5hbWUpID0+IHtcbiAgICBjb25zdCBzZWNyZXQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMihzY29wZSwgYFNlY3JldCR7c2VjcmV0TmFtZS5yZXBsYWNlKC9bXmEtekEtWjAtOV0vZywgJycpfWAsIHNlY3JldE5hbWUpO1xuICAgIHNlY3JldC5ncmFudFJlYWQoZ3JhbnRhYmxlKTtcbiAgfSk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIExhbWJkYSBmdW5jdGlvbiB3aXRoIER5bmFtb0RCIHRhYmxlcywgUzMgYnVja2V0LCBhbmQgZW52aXJvbm1lbnQgdmFyaWFibGVzIGNvbmZpZ3VyZWRcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDcmVhdGVMYW1iZGFXaXRoVGFibGVzT3B0aW9ucyB7XG4gIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lO1xuICBoYW5kbGVyOiBzdHJpbmc7XG4gIGNvZGU6IGxhbWJkYS5Db2RlO1xuICB0aW1lb3V0PzogY2RrLkR1cmF0aW9uO1xuICBtZW1vcnlTaXplPzogbnVtYmVyO1xuICBlbnZpcm9ubWVudD86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIGxvZ1JldGVudGlvbj86IGxvZ3MuUmV0ZW50aW9uRGF5cztcbiAgdHJhY2luZz86IGxhbWJkYS5UcmFjaW5nO1xuICByb2xlPzogaWFtLlJvbGU7XG4gIGxvZ0dyb3VwPzogbG9ncy5Mb2dHcm91cDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxhbWJkYVdpdGhUYWJsZXMoXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIGlkOiBzdHJpbmcsXG4gIHRhYmxlc01hcDogVGFibGVNYXAsXG4gIGFydGlmYWN0c0J1Y2tldDogczMuQnVja2V0LFxuICBvcHRpb25zOiBDcmVhdGVMYW1iZGFXaXRoVGFibGVzT3B0aW9uc1xuKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgLy8gQ3JlYXRlIHJvbGUgaWYgbm90IHByb3ZpZGVkXG4gIGNvbnN0IHJvbGUgPSBvcHRpb25zLnJvbGUgfHwgY3JlYXRlTGFtYmRhUm9sZShzY29wZSwgYCR7aWR9Um9sZWAsIHtcbiAgICBpbmNsdWRlWFJheTogb3B0aW9ucy50cmFjaW5nID09PSBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXG4gIH0pO1xuXG4gIC8vIENyZWF0ZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZnJvbSB0YWJsZXNcbiAgY29uc3QgdGFibGVFbnZWYXJzID0gY3JlYXRlVGFibGVFbnZpcm9ubWVudFZhcnModGFibGVzTWFwKTtcbiAgY29uc3QgZW52aXJvbm1lbnQgPSB7XG4gICAgLi4udGFibGVFbnZWYXJzLFxuICAgIEFSVElGQUNUU19CVUNLRVQ6IGFydGlmYWN0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgIC4uLm9wdGlvbnMuZW52aXJvbm1lbnQsXG4gIH07XG5cbiAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvblxuICBjb25zdCBsYW1iZGFGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oc2NvcGUsIGlkLCB7XG4gICAgcnVudGltZTogb3B0aW9ucy5ydW50aW1lLFxuICAgIGhhbmRsZXI6IG9wdGlvbnMuaGFuZGxlcixcbiAgICBjb2RlOiBvcHRpb25zLmNvZGUsXG4gICAgdGltZW91dDogb3B0aW9ucy50aW1lb3V0LFxuICAgIG1lbW9yeVNpemU6IG9wdGlvbnMubWVtb3J5U2l6ZSxcbiAgICBlbnZpcm9ubWVudCxcbiAgICByb2xlLFxuICAgIGxvZ1JldGVudGlvbjogb3B0aW9ucy5sb2dSZXRlbnRpb24sXG4gICAgdHJhY2luZzogb3B0aW9ucy50cmFjaW5nLFxuICAgIGxvZ0dyb3VwOiBvcHRpb25zLmxvZ0dyb3VwLFxuICB9KTtcblxuICAvLyBHcmFudCBwZXJtaXNzaW9uc1xuICBncmFudER5bmFtb0RCUGVybWlzc2lvbnMobGFtYmRhRnVuY3Rpb24sIHRhYmxlc01hcCk7XG4gIGdyYW50UzNQZXJtaXNzaW9ucyhsYW1iZGFGdW5jdGlvbiwgYXJ0aWZhY3RzQnVja2V0KTtcblxuICByZXR1cm4gbGFtYmRhRnVuY3Rpb247XG59XG5cbiJdfQ==