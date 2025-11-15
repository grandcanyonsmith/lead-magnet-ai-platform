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
exports.grantCommonSecretsAccess = grantCommonSecretsAccess;
exports.createLambdaWithTables = createLambdaWithTables;
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const environment_helpers_1 = require("./environment-helpers");
const constants_1 = require("../config/constants");
/**
 * Creates a Lambda execution role with standard policies
 *
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the role
 * @param options - Optional configuration for the role
 * @returns IAM role configured for Lambda execution
 */
function createLambdaRole(scope, id, options) {
    if (!id || id.trim().length === 0) {
        throw new Error('Role ID cannot be empty');
    }
    const managedPolicies = [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
    ];
    if (options?.includeXRay) {
        managedPolicies.push(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'));
    }
    if (options?.additionalPolicies) {
        managedPolicies.push(...options.additionalPolicies);
    }
    return new iam.Role(scope, id, {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies,
        inlinePolicies: options?.inlinePolicies,
    });
}
/**
 * Grants DynamoDB permissions to a role or function
 *
 * @param grantable - IAM grantable (role or function) to grant permissions to
 * @param tablesMap - Map of table keys to DynamoDB table references
 * @throws Error if tablesMap is empty or invalid
 */
function grantDynamoDBPermissions(grantable, tablesMap) {
    if (!grantable) {
        throw new Error('Grantable cannot be null or undefined');
    }
    const tables = Object.values(tablesMap);
    if (tables.length === 0) {
        throw new Error('tablesMap cannot be empty');
    }
    tables.forEach((table) => {
        if (!table) {
            throw new Error('Table reference cannot be null or undefined');
        }
        table.grantReadWriteData(grantable);
    });
}
/**
 * Grants S3 permissions to a role or function
 *
 * @param grantable - IAM grantable (role or function) to grant permissions to
 * @param bucket - S3 bucket to grant access to
 * @throws Error if bucket is null or undefined
 */
function grantS3Permissions(grantable, bucket) {
    if (!grantable) {
        throw new Error('Grantable cannot be null or undefined');
    }
    if (!bucket) {
        throw new Error('Bucket cannot be null or undefined');
    }
    bucket.grantReadWrite(grantable);
}
/**
 * Grants Secrets Manager access to a role or function
 *
 * @param grantable - IAM grantable (role or function) to grant permissions to
 * @param scope - CDK construct scope (for account/region access)
 * @param secretNames - Array of secret names to grant access to
 * @throws Error if secretNames is empty or contains invalid names
 */
function grantSecretsAccess(grantable, scope, secretNames) {
    if (!grantable) {
        throw new Error('Grantable cannot be null or undefined');
    }
    if (!secretNames || secretNames.length === 0) {
        throw new Error('secretNames cannot be empty');
    }
    secretNames.forEach((secretName) => {
        if (!secretName || secretName.trim().length === 0) {
            throw new Error('Secret name cannot be empty');
        }
        // Create a safe ID for the secret construct
        const safeId = `Secret${secretName.replace(/[^a-zA-Z0-9]/g, '')}`;
        const secret = secretsmanager.Secret.fromSecretNameV2(scope, safeId, secretName);
        secret.grantRead(grantable);
    });
}
/**
 * Grants access to commonly used secrets (OpenAI, Twilio)
 *
 * @param grantable - IAM grantable to grant permissions to
 * @param scope - CDK construct scope
 */
function grantCommonSecretsAccess(grantable, scope) {
    grantSecretsAccess(grantable, scope, [
        constants_1.SECRET_NAMES.OPENAI_API_KEY,
        constants_1.SECRET_NAMES.TWILIO_CREDENTIALS,
    ]);
}
/**
 * Creates a Lambda function with DynamoDB tables, S3 bucket, and environment variables configured
 *
 * Automatically grants necessary permissions and sets up environment variables.
 * Supports both zip-based and container image deployments.
 *
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the function
 * @param tablesMap - Map of table keys to DynamoDB table references
 * @param artifactsBucket - S3 bucket for artifacts
 * @param options - Lambda function configuration options
 * @returns Lambda function instance
 * @throws Error if required parameters are missing or invalid
 */
function createLambdaWithTables(scope, id, tablesMap, artifactsBucket, options) {
    // Validate inputs
    if (!id || id.trim().length === 0) {
        throw new Error('Function ID cannot be empty');
    }
    if (!tablesMap || Object.keys(tablesMap).length === 0) {
        throw new Error('tablesMap cannot be empty');
    }
    if (!artifactsBucket) {
        throw new Error('artifactsBucket cannot be null or undefined');
    }
    if (!options.code) {
        throw new Error('Lambda code is required');
    }
    // Create role if not provided
    const role = options.role || createLambdaRole(scope, `${id}Role`, {
        includeXRay: options.tracing === lambda.Tracing.ACTIVE,
    });
    // Create environment variables from tables
    const tableEnvVars = (0, environment_helpers_1.createTableEnvironmentVars)(tablesMap);
    const environment = {
        ...tableEnvVars,
        [constants_1.ENV_VAR_NAMES.ARTIFACTS_BUCKET]: artifactsBucket.bucketName,
        ...options.environment,
    };
    // Create Lambda function (container image or zip)
    let lambdaFunction;
    // Determine deployment type: container image if runtime/handler are both missing
    const isContainerImage = options.runtime === undefined && options.handler === undefined;
    if (isContainerImage) {
        // Container image - use DockerImageFunction
        // When runtime/handler are undefined, code must be DockerImageCode
        // Verify that code is actually DockerImageCode by checking its type
        // DockerImageCode.fromEcr() returns a DockerImageCode instance
        if (!options.code) {
            throw new Error('Code is required for Lambda function');
        }
        // Create DockerImageFunction - CDK will validate the code type
        // If code is not DockerImageCode, CDK will throw an error during synthesis
        lambdaFunction = new lambda.DockerImageFunction(scope, id, {
            functionName: options.functionName,
            code: options.code,
            timeout: options.timeout,
            memorySize: options.memorySize,
            environment,
            role,
            logRetention: options.logRetention,
            tracing: options.tracing,
            logGroup: options.logGroup,
        });
    }
    else {
        // Zip deployment - use regular Function
        if (!options.runtime) {
            throw new Error('Runtime is required for zip-based Lambda functions');
        }
        if (!options.handler) {
            throw new Error('Handler is required for zip-based Lambda functions');
        }
        if (!(options.code instanceof lambda.Code)) {
            throw new Error('Lambda.Code is required for zip-based deployment');
        }
        lambdaFunction = new lambda.Function(scope, id, {
            functionName: options.functionName,
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
    }
    // Grant permissions
    grantDynamoDBPermissions(lambdaFunction, tablesMap);
    grantS3Permissions(lambdaFunction, artifactsBucket);
    return lambdaFunction;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLWhlbHBlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsYW1iZGEtaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWdDQSw0Q0E0QkM7QUFTRCw0REFtQkM7QUFTRCxnREFZQztBQVVELGdEQTBCQztBQVFELDREQVFDO0FBK0NELHdEQTZGQztBQTVTRCwrREFBaUQ7QUFDakQseURBQTJDO0FBRzNDLCtFQUFpRTtBQUlqRSwrREFBaUY7QUFDakYsbURBQWtFO0FBY2xFOzs7Ozs7O0dBT0c7QUFDSCxTQUFnQixnQkFBZ0IsQ0FDOUIsS0FBZ0IsRUFDaEIsRUFBVSxFQUNWLE9BQTJCO0lBRTNCLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUNsQyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVELE1BQU0sZUFBZSxHQUFHO1FBQ3RCLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsMENBQTBDLENBQUM7S0FDdkYsQ0FBQztJQUVGLElBQUksT0FBTyxFQUFFLFdBQVcsRUFBRSxDQUFDO1FBQ3pCLGVBQWUsQ0FBQyxJQUFJLENBQ2xCLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsMEJBQTBCLENBQUMsQ0FDdkUsQ0FBQztJQUNKLENBQUM7SUFFRCxJQUFJLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxDQUFDO1FBQ2hDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUQsT0FBTyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRTtRQUM3QixTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNC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QyxDQUFDO1FBQ3RFLENBQUM7UUFDRCxjQUFjLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUU7WUFDOUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxZQUFZO1lBQ2xDLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztZQUN4QixPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87WUFDeEIsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJO1lBQ2xCLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztZQUN4QixVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVU7WUFDOUIsV0FBVztZQUNYLElBQUk7WUFDSixZQUFZLEVBQUUsT0FBTyxDQUFDLFlBQVk7WUFDbEMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO1lBQ3hCLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtTQUMzQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsb0JBQW9CO0lBQ3BCLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNwRCxrQkFBa0IsQ0FBQyxjQUFjLEVBQUUsZUFBZSxDQUFDLENBQUM7SUFFcEQsT0FBTyxjQUFjLENBQUM7QUFDeEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgVGFibGVNYXAgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBjcmVhdGVUYWJsZUVudmlyb25tZW50VmFycywgZ2V0U2VjcmV0QXJuIH0gZnJvbSAnLi9lbnZpcm9ubWVudC1oZWxwZXJzJztcbmltcG9ydCB7IFNFQ1JFVF9OQU1FUywgRU5WX1ZBUl9OQU1FUyB9IGZyb20gJy4uL2NvbmZpZy9jb25zdGFudHMnO1xuXG4vKipcbiAqIE9wdGlvbnMgZm9yIGNyZWF0aW5nIGEgTGFtYmRhIGV4ZWN1dGlvbiByb2xlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTGFtYmRhUm9sZU9wdGlvbnMge1xuICAvKiogRW5hYmxlIFgtUmF5IHRyYWNpbmcgKi9cbiAgaW5jbHVkZVhSYXk/OiBib29sZWFuO1xuICAvKiogQWRkaXRpb25hbCBtYW5hZ2VkIHBvbGljaWVzIHRvIGF0dGFjaCAqL1xuICBhZGRpdGlvbmFsUG9saWNpZXM/OiBpYW0uSU1hbmFnZWRQb2xpY3lbXTtcbiAgLyoqIEFkZGl0aW9uYWwgaW5saW5lIHBvbGljaWVzICovXG4gIGlubGluZVBvbGljaWVzPzogUmVjb3JkPHN0cmluZywgaWFtLlBvbGljeURvY3VtZW50Pjtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgTGFtYmRhIGV4ZWN1dGlvbiByb2xlIHdpdGggc3RhbmRhcmQgcG9saWNpZXNcbiAqIFxuICogQHBhcmFtIHNjb3BlIC0gQ0RLIGNvbnN0cnVjdCBzY29wZVxuICogQHBhcmFtIGlkIC0gVW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSByb2xlXG4gKiBAcGFyYW0gb3B0aW9ucyAtIE9wdGlvbmFsIGNvbmZpZ3VyYXRpb24gZm9yIHRoZSByb2xlXG4gKiBAcmV0dXJucyBJQU0gcm9sZSBjb25maWd1cmVkIGZvciBMYW1iZGEgZXhlY3V0aW9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMYW1iZGFSb2xlKFxuICBzY29wZTogQ29uc3RydWN0LFxuICBpZDogc3RyaW5nLFxuICBvcHRpb25zPzogTGFtYmRhUm9sZU9wdGlvbnNcbik6IGlhbS5Sb2xlIHtcbiAgaWYgKCFpZCB8fCBpZC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdSb2xlIElEIGNhbm5vdCBiZSBlbXB0eScpO1xuICB9XG5cbiAgY29uc3QgbWFuYWdlZFBvbGljaWVzID0gW1xuICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICBdO1xuXG4gIGlmIChvcHRpb25zPy5pbmNsdWRlWFJheSkge1xuICAgIG1hbmFnZWRQb2xpY2llcy5wdXNoKFxuICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBV1NYUmF5RGFlbW9uV3JpdGVBY2Nlc3MnKVxuICAgICk7XG4gIH1cblxuICBpZiAob3B0aW9ucz8uYWRkaXRpb25hbFBvbGljaWVzKSB7XG4gICAgbWFuYWdlZFBvbGljaWVzLnB1c2goLi4ub3B0aW9ucy5hZGRpdGlvbmFsUG9saWNpZXMpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBpYW0uUm9sZShzY29wZSwgaWQsIHtcbiAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICBtYW5hZ2VkUG9saWNpZXMsXG4gICAgaW5saW5lUG9saWNpZXM6IG9wdGlvbnM/LmlubGluZVBvbGljaWVzLFxuICB9KTtcbn1cblxuLyoqXG4gKiBHcmFudHMgRHluYW1vREIgcGVybWlzc2lvbnMgdG8gYSByb2xlIG9yIGZ1bmN0aW9uXG4gKiBcbiAqIEBwYXJhbSBncmFudGFibGUgLSBJQU0gZ3JhbnRhYmxlIChyb2xlIG9yIGZ1bmN0aW9uKSB0byBncmFudCBwZXJtaXNzaW9ucyB0b1xuICogQHBhcmFtIHRhYmxlc01hcCAtIE1hcCBvZiB0YWJsZSBrZXlzIHRvIER5bmFtb0RCIHRhYmxlIHJlZmVyZW5jZXNcbiAqIEB0aHJvd3MgRXJyb3IgaWYgdGFibGVzTWFwIGlzIGVtcHR5IG9yIGludmFsaWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdyYW50RHluYW1vREJQZXJtaXNzaW9ucyhcbiAgZ3JhbnRhYmxlOiBpYW0uSUdyYW50YWJsZSxcbiAgdGFibGVzTWFwOiBUYWJsZU1hcFxuKTogdm9pZCB7XG4gIGlmICghZ3JhbnRhYmxlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdHcmFudGFibGUgY2Fubm90IGJlIG51bGwgb3IgdW5kZWZpbmVkJyk7XG4gIH1cblxuICBjb25zdCB0YWJsZXMgPSBPYmplY3QudmFsdWVzKHRhYmxlc01hcCk7XG4gIGlmICh0YWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd0YWJsZXNNYXAgY2Fubm90IGJlIGVtcHR5Jyk7XG4gIH1cblxuICB0YWJsZXMuZm9yRWFjaCgodGFibGUpID0+IHtcbiAgICBpZiAoIXRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RhYmxlIHJlZmVyZW5jZSBjYW5ub3QgYmUgbnVsbCBvciB1bmRlZmluZWQnKTtcbiAgICB9XG4gICAgdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGdyYW50YWJsZSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIEdyYW50cyBTMyBwZXJtaXNzaW9ucyB0byBhIHJvbGUgb3IgZnVuY3Rpb25cbiAqIFxuICogQHBhcmFtIGdyYW50YWJsZSAtIElBTSBncmFudGFibGUgKHJvbGUgb3IgZnVuY3Rpb24pIHRvIGdyYW50IHBlcm1pc3Npb25zIHRvXG4gKiBAcGFyYW0gYnVja2V0IC0gUzMgYnVja2V0IHRvIGdyYW50IGFjY2VzcyB0b1xuICogQHRocm93cyBFcnJvciBpZiBidWNrZXQgaXMgbnVsbCBvciB1bmRlZmluZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdyYW50UzNQZXJtaXNzaW9ucyhcbiAgZ3JhbnRhYmxlOiBpYW0uSUdyYW50YWJsZSxcbiAgYnVja2V0OiBzMy5CdWNrZXRcbik6IHZvaWQge1xuICBpZiAoIWdyYW50YWJsZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignR3JhbnRhYmxlIGNhbm5vdCBiZSBudWxsIG9yIHVuZGVmaW5lZCcpO1xuICB9XG4gIGlmICghYnVja2V0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdCdWNrZXQgY2Fubm90IGJlIG51bGwgb3IgdW5kZWZpbmVkJyk7XG4gIH1cblxuICBidWNrZXQuZ3JhbnRSZWFkV3JpdGUoZ3JhbnRhYmxlKTtcbn1cblxuLyoqXG4gKiBHcmFudHMgU2VjcmV0cyBNYW5hZ2VyIGFjY2VzcyB0byBhIHJvbGUgb3IgZnVuY3Rpb25cbiAqIFxuICogQHBhcmFtIGdyYW50YWJsZSAtIElBTSBncmFudGFibGUgKHJvbGUgb3IgZnVuY3Rpb24pIHRvIGdyYW50IHBlcm1pc3Npb25zIHRvXG4gKiBAcGFyYW0gc2NvcGUgLSBDREsgY29uc3RydWN0IHNjb3BlIChmb3IgYWNjb3VudC9yZWdpb24gYWNjZXNzKVxuICogQHBhcmFtIHNlY3JldE5hbWVzIC0gQXJyYXkgb2Ygc2VjcmV0IG5hbWVzIHRvIGdyYW50IGFjY2VzcyB0b1xuICogQHRocm93cyBFcnJvciBpZiBzZWNyZXROYW1lcyBpcyBlbXB0eSBvciBjb250YWlucyBpbnZhbGlkIG5hbWVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBncmFudFNlY3JldHNBY2Nlc3MoXG4gIGdyYW50YWJsZTogaWFtLklHcmFudGFibGUsXG4gIHNjb3BlOiBDb25zdHJ1Y3QgJiB7IGFjY291bnQ6IHN0cmluZzsgcmVnaW9uOiBzdHJpbmcgfSxcbiAgc2VjcmV0TmFtZXM6IHN0cmluZ1tdXG4pOiB2b2lkIHtcbiAgaWYgKCFncmFudGFibGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0dyYW50YWJsZSBjYW5ub3QgYmUgbnVsbCBvciB1bmRlZmluZWQnKTtcbiAgfVxuICBpZiAoIXNlY3JldE5hbWVzIHx8IHNlY3JldE5hbWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2VjcmV0TmFtZXMgY2Fubm90IGJlIGVtcHR5Jyk7XG4gIH1cblxuICBzZWNyZXROYW1lcy5mb3JFYWNoKChzZWNyZXROYW1lKSA9PiB7XG4gICAgaWYgKCFzZWNyZXROYW1lIHx8IHNlY3JldE5hbWUudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZWNyZXQgbmFtZSBjYW5ub3QgYmUgZW1wdHknKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgYSBzYWZlIElEIGZvciB0aGUgc2VjcmV0IGNvbnN0cnVjdFxuICAgIGNvbnN0IHNhZmVJZCA9IGBTZWNyZXQke3NlY3JldE5hbWUucmVwbGFjZSgvW15hLXpBLVowLTldL2csICcnKX1gO1xuICAgIGNvbnN0IHNlY3JldCA9IHNlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0TmFtZVYyKFxuICAgICAgc2NvcGUsXG4gICAgICBzYWZlSWQsXG4gICAgICBzZWNyZXROYW1lXG4gICAgKTtcbiAgICBzZWNyZXQuZ3JhbnRSZWFkKGdyYW50YWJsZSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIEdyYW50cyBhY2Nlc3MgdG8gY29tbW9ubHkgdXNlZCBzZWNyZXRzIChPcGVuQUksIFR3aWxpbylcbiAqIFxuICogQHBhcmFtIGdyYW50YWJsZSAtIElBTSBncmFudGFibGUgdG8gZ3JhbnQgcGVybWlzc2lvbnMgdG9cbiAqIEBwYXJhbSBzY29wZSAtIENESyBjb25zdHJ1Y3Qgc2NvcGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdyYW50Q29tbW9uU2VjcmV0c0FjY2VzcyhcbiAgZ3JhbnRhYmxlOiBpYW0uSUdyYW50YWJsZSxcbiAgc2NvcGU6IENvbnN0cnVjdCAmIHsgYWNjb3VudDogc3RyaW5nOyByZWdpb246IHN0cmluZyB9XG4pOiB2b2lkIHtcbiAgZ3JhbnRTZWNyZXRzQWNjZXNzKGdyYW50YWJsZSwgc2NvcGUsIFtcbiAgICBTRUNSRVRfTkFNRVMuT1BFTkFJX0FQSV9LRVksXG4gICAgU0VDUkVUX05BTUVTLlRXSUxJT19DUkVERU5USUFMUyxcbiAgXSk7XG59XG5cbi8qKlxuICogT3B0aW9ucyBmb3IgY3JlYXRpbmcgYSBMYW1iZGEgZnVuY3Rpb24gd2l0aCB0YWJsZXMgYW5kIGJ1Y2tldCBhY2Nlc3NcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDcmVhdGVMYW1iZGFXaXRoVGFibGVzT3B0aW9ucyB7XG4gIC8qKiBSdW50aW1lIChvcHRpb25hbCBmb3IgY29udGFpbmVyIGltYWdlcykgKi9cbiAgcnVudGltZT86IGxhbWJkYS5SdW50aW1lO1xuICAvKiogSGFuZGxlciAob3B0aW9uYWwgZm9yIGNvbnRhaW5lciBpbWFnZXMpICovXG4gIGhhbmRsZXI/OiBzdHJpbmc7XG4gIC8qKiBMYW1iZGEgY29kZSAoemlwIG9yIGNvbnRhaW5lciBpbWFnZSlcbiAgICogLSBGb3IgemlwIGRlcGxveW1lbnQ6IHVzZSBsYW1iZGEuQ29kZSAoZS5nLiwgQ29kZS5mcm9tQXNzZXQpXG4gICAqIC0gRm9yIGNvbnRhaW5lciBpbWFnZXM6IHVzZSBsYW1iZGEuRG9ja2VySW1hZ2VDb2RlIChlLmcuLCBEb2NrZXJJbWFnZUNvZGUuZnJvbUVjcilcbiAgICovXG4gIGNvZGU6IGxhbWJkYS5Db2RlIHwgbGFtYmRhLkRvY2tlckltYWdlQ29kZTtcbiAgLyoqIFRpbWVvdXQgZHVyYXRpb24gKi9cbiAgdGltZW91dD86IGNkay5EdXJhdGlvbjtcbiAgLyoqIE1lbW9yeSBzaXplIGluIE1CICovXG4gIG1lbW9yeVNpemU/OiBudW1iZXI7XG4gIC8qKiBBZGRpdGlvbmFsIGVudmlyb25tZW50IHZhcmlhYmxlcyAqL1xuICBlbnZpcm9ubWVudD86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIC8qKiBMb2cgcmV0ZW50aW9uIHBlcmlvZCAqL1xuICBsb2dSZXRlbnRpb24/OiBsb2dzLlJldGVudGlvbkRheXM7XG4gIC8qKiBYLVJheSB0cmFjaW5nICovXG4gIHRyYWNpbmc/OiBsYW1iZGEuVHJhY2luZztcbiAgLyoqIEN1c3RvbSBJQU0gcm9sZSAoY3JlYXRlZCBpZiBub3QgcHJvdmlkZWQpICovXG4gIHJvbGU/OiBpYW0uUm9sZTtcbiAgLyoqIEN1c3RvbSBsb2cgZ3JvdXAgKGNyZWF0ZWQgaWYgbm90IHByb3ZpZGVkKSAqL1xuICBsb2dHcm91cD86IGxvZ3MuTG9nR3JvdXA7XG4gIC8qKiBGdW5jdGlvbiBuYW1lICovXG4gIGZ1bmN0aW9uTmFtZT86IHN0cmluZztcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgTGFtYmRhIGZ1bmN0aW9uIHdpdGggRHluYW1vREIgdGFibGVzLCBTMyBidWNrZXQsIGFuZCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgY29uZmlndXJlZFxuICogXG4gKiBBdXRvbWF0aWNhbGx5IGdyYW50cyBuZWNlc3NhcnkgcGVybWlzc2lvbnMgYW5kIHNldHMgdXAgZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICogU3VwcG9ydHMgYm90aCB6aXAtYmFzZWQgYW5kIGNvbnRhaW5lciBpbWFnZSBkZXBsb3ltZW50cy5cbiAqIFxuICogQHBhcmFtIHNjb3BlIC0gQ0RLIGNvbnN0cnVjdCBzY29wZVxuICogQHBhcmFtIGlkIC0gVW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBmdW5jdGlvblxuICogQHBhcmFtIHRhYmxlc01hcCAtIE1hcCBvZiB0YWJsZSBrZXlzIHRvIER5bmFtb0RCIHRhYmxlIHJlZmVyZW5jZXNcbiAqIEBwYXJhbSBhcnRpZmFjdHNCdWNrZXQgLSBTMyBidWNrZXQgZm9yIGFydGlmYWN0c1xuICogQHBhcmFtIG9wdGlvbnMgLSBMYW1iZGEgZnVuY3Rpb24gY29uZmlndXJhdGlvbiBvcHRpb25zXG4gKiBAcmV0dXJucyBMYW1iZGEgZnVuY3Rpb24gaW5zdGFuY2VcbiAqIEB0aHJvd3MgRXJyb3IgaWYgcmVxdWlyZWQgcGFyYW1ldGVycyBhcmUgbWlzc2luZyBvciBpbnZhbGlkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMYW1iZGFXaXRoVGFibGVzKFxuICBzY29wZTogQ29uc3RydWN0LFxuICBpZDogc3RyaW5nLFxuICB0YWJsZXNNYXA6IFRhYmxlTWFwLFxuICBhcnRpZmFjdHNCdWNrZXQ6IHMzLkJ1Y2tldCxcbiAgb3B0aW9uczogQ3JlYXRlTGFtYmRhV2l0aFRhYmxlc09wdGlvbnNcbik6IGxhbWJkYS5JRnVuY3Rpb24ge1xuICAvLyBWYWxpZGF0ZSBpbnB1dHNcbiAgaWYgKCFpZCB8fCBpZC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdGdW5jdGlvbiBJRCBjYW5ub3QgYmUgZW1wdHknKTtcbiAgfVxuICBpZiAoIXRhYmxlc01hcCB8fCBPYmplY3Qua2V5cyh0YWJsZXNNYXApLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcigndGFibGVzTWFwIGNhbm5vdCBiZSBlbXB0eScpO1xuICB9XG4gIGlmICghYXJ0aWZhY3RzQnVja2V0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhcnRpZmFjdHNCdWNrZXQgY2Fubm90IGJlIG51bGwgb3IgdW5kZWZpbmVkJyk7XG4gIH1cbiAgaWYgKCFvcHRpb25zLmNvZGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0xhbWJkYSBjb2RlIGlzIHJlcXVpcmVkJyk7XG4gIH1cblxuICAvLyBDcmVhdGUgcm9sZSBpZiBub3QgcHJvdmlkZWRcbiAgY29uc3Qgcm9sZSA9IG9wdGlvbnMucm9sZSB8fCBjcmVhdGVMYW1iZGFSb2xlKHNjb3BlLCBgJHtpZH1Sb2xlYCwge1xuICAgIGluY2x1ZGVYUmF5OiBvcHRpb25zLnRyYWNpbmcgPT09IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcbiAgfSk7XG5cbiAgLy8gQ3JlYXRlIGVudmlyb25tZW50IHZhcmlhYmxlcyBmcm9tIHRhYmxlc1xuICBjb25zdCB0YWJsZUVudlZhcnMgPSBjcmVhdGVUYWJsZUVudmlyb25tZW50VmFycyh0YWJsZXNNYXApO1xuICBjb25zdCBlbnZpcm9ubWVudCA9IHtcbiAgICAuLi50YWJsZUVudlZhcnMsXG4gICAgW0VOVl9WQVJfTkFNRVMuQVJUSUZBQ1RTX0JVQ0tFVF06IGFydGlmYWN0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgIC4uLm9wdGlvbnMuZW52aXJvbm1lbnQsXG4gIH07XG5cbiAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbiAoY29udGFpbmVyIGltYWdlIG9yIHppcClcbiAgbGV0IGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGEuSUZ1bmN0aW9uO1xuICBcbiAgLy8gRGV0ZXJtaW5lIGRlcGxveW1lbnQgdHlwZTogY29udGFpbmVyIGltYWdlIGlmIHJ1bnRpbWUvaGFuZGxlciBhcmUgYm90aCBtaXNzaW5nXG4gIGNvbnN0IGlzQ29udGFpbmVySW1hZ2UgPSBvcHRpb25zLnJ1bnRpbWUgPT09IHVuZGVmaW5lZCAmJiBvcHRpb25zLmhhbmRsZXIgPT09IHVuZGVmaW5lZDtcbiAgXG4gIGlmIChpc0NvbnRhaW5lckltYWdlKSB7XG4gICAgLy8gQ29udGFpbmVyIGltYWdlIC0gdXNlIERvY2tlckltYWdlRnVuY3Rpb25cbiAgICAvLyBXaGVuIHJ1bnRpbWUvaGFuZGxlciBhcmUgdW5kZWZpbmVkLCBjb2RlIG11c3QgYmUgRG9ja2VySW1hZ2VDb2RlXG4gICAgLy8gVmVyaWZ5IHRoYXQgY29kZSBpcyBhY3R1YWxseSBEb2NrZXJJbWFnZUNvZGUgYnkgY2hlY2tpbmcgaXRzIHR5cGVcbiAgICAvLyBEb2NrZXJJbWFnZUNvZGUuZnJvbUVjcigpIHJldHVybnMgYSBEb2NrZXJJbWFnZUNvZGUgaW5zdGFuY2VcbiAgICBpZiAoIW9wdGlvbnMuY29kZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb2RlIGlzIHJlcXVpcmVkIGZvciBMYW1iZGEgZnVuY3Rpb24nKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ3JlYXRlIERvY2tlckltYWdlRnVuY3Rpb24gLSBDREsgd2lsbCB2YWxpZGF0ZSB0aGUgY29kZSB0eXBlXG4gICAgLy8gSWYgY29kZSBpcyBub3QgRG9ja2VySW1hZ2VDb2RlLCBDREsgd2lsbCB0aHJvdyBhbiBlcnJvciBkdXJpbmcgc3ludGhlc2lzXG4gICAgbGFtYmRhRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkRvY2tlckltYWdlRnVuY3Rpb24oc2NvcGUsIGlkLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IG9wdGlvbnMuZnVuY3Rpb25OYW1lLFxuICAgICAgY29kZTogb3B0aW9ucy5jb2RlIGFzIGxhbWJkYS5Eb2NrZXJJbWFnZUNvZGUsXG4gICAgICB0aW1lb3V0OiBvcHRpb25zLnRpbWVvdXQsXG4gICAgICBtZW1vcnlTaXplOiBvcHRpb25zLm1lbW9yeVNpemUsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIHJvbGUsXG4gICAgICBsb2dSZXRlbnRpb246IG9wdGlvbnMubG9nUmV0ZW50aW9uLFxuICAgICAgdHJhY2luZzogb3B0aW9ucy50cmFjaW5nLFxuICAgICAgbG9nR3JvdXA6IG9wdGlvbnMubG9nR3JvdXAsXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gWmlwIGRlcGxveW1lbnQgLSB1c2UgcmVndWxhciBGdW5jdGlvblxuICAgIGlmICghb3B0aW9ucy5ydW50aW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1J1bnRpbWUgaXMgcmVxdWlyZWQgZm9yIHppcC1iYXNlZCBMYW1iZGEgZnVuY3Rpb25zJyk7XG4gICAgfVxuICAgIGlmICghb3B0aW9ucy5oYW5kbGVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0hhbmRsZXIgaXMgcmVxdWlyZWQgZm9yIHppcC1iYXNlZCBMYW1iZGEgZnVuY3Rpb25zJyk7XG4gICAgfVxuICAgIGlmICghKG9wdGlvbnMuY29kZSBpbnN0YW5jZW9mIGxhbWJkYS5Db2RlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdMYW1iZGEuQ29kZSBpcyByZXF1aXJlZCBmb3IgemlwLWJhc2VkIGRlcGxveW1lbnQnKTtcbiAgICB9XG4gICAgbGFtYmRhRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHNjb3BlLCBpZCwge1xuICAgICAgZnVuY3Rpb25OYW1lOiBvcHRpb25zLmZ1bmN0aW9uTmFtZSxcbiAgICAgIHJ1bnRpbWU6IG9wdGlvbnMucnVudGltZSxcbiAgICAgIGhhbmRsZXI6IG9wdGlvbnMuaGFuZGxlcixcbiAgICAgIGNvZGU6IG9wdGlvbnMuY29kZSxcbiAgICAgIHRpbWVvdXQ6IG9wdGlvbnMudGltZW91dCxcbiAgICAgIG1lbW9yeVNpemU6IG9wdGlvbnMubWVtb3J5U2l6ZSxcbiAgICAgIGVudmlyb25tZW50LFxuICAgICAgcm9sZSxcbiAgICAgIGxvZ1JldGVudGlvbjogb3B0aW9ucy5sb2dSZXRlbnRpb24sXG4gICAgICB0cmFjaW5nOiBvcHRpb25zLnRyYWNpbmcsXG4gICAgICBsb2dHcm91cDogb3B0aW9ucy5sb2dHcm91cCxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEdyYW50IHBlcm1pc3Npb25zXG4gIGdyYW50RHluYW1vREJQZXJtaXNzaW9ucyhsYW1iZGFGdW5jdGlvbiwgdGFibGVzTWFwKTtcbiAgZ3JhbnRTM1Blcm1pc3Npb25zKGxhbWJkYUZ1bmN0aW9uLCBhcnRpZmFjdHNCdWNrZXQpO1xuXG4gIHJldHVybiBsYW1iZGFGdW5jdGlvbjtcbn1cblxuIl19