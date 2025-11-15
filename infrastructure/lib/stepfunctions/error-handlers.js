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
exports.createJobFailureHandler = createJobFailureHandler;
exports.createErrorParser = createErrorParser;
exports.createExceptionHandlerChain = createExceptionHandlerChain;
exports.createStepFailureHandler = createStepFailureHandler;
exports.createHtmlGenerationFailureHandler = createHtmlGenerationFailureHandler;
exports.createJobFinalizer = createJobFinalizer;
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const tasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
/**
 * Creates a DynamoDB update task to mark a job as failed
 *
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the task
 * @param jobsTable - DynamoDB table for jobs
 * @param errorPath - JSONPath to the error message in the state
 * @param errorTypePath - Optional JSONPath to the error type
 * @param jobIdPath - JSONPath to the job_id (defaults to '$.job_id')
 * @returns DynamoDB update task that marks job as failed
 */
function createJobFailureHandler(scope, id, jobsTable, errorPath, errorTypePath, jobIdPath = '$.job_id') {
    const expressionAttributeValues = {
        ':status': tasks.DynamoAttributeValue.fromString('failed'),
        ':error': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt(errorPath)),
        ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
    };
    let updateExpression = 'SET #status = :status, error_message = :error, updated_at = :updated_at';
    if (errorTypePath) {
        expressionAttributeValues[':error_type'] = tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt(errorTypePath));
        updateExpression += ', error_type = :error_type';
    }
    return new tasks.DynamoUpdateItem(scope, id, {
        table: jobsTable,
        key: {
            job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt(jobIdPath)),
        },
        updateExpression,
        expressionAttributeNames: {
            '#status': 'status',
        },
        expressionAttributeValues,
    });
}
/**
 * Creates a Pass state that parses Lambda error information
 *
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the pass state
 * @param includeStepIndex - Whether to include step_index in the parsed error
 * @returns Pass state that parses error information
 */
function createErrorParser(scope, id, includeStepIndex = false) {
    const parameters = {
        'job_id.$': '$.job_id',
        'error_message': sfn.JsonPath.format('Lambda execution failed: {} - {}', sfn.JsonPath.stringAt('$.error.Error'), sfn.JsonPath.stringAt('$.error.Cause')),
    };
    if (includeStepIndex) {
        parameters['step_index.$'] = '$.step_index';
    }
    return new sfn.Pass(scope, id, {
        parameters,
        resultPath: '$.parsedError',
    });
}
/**
 * Creates a complete error handler chain: parse error -> handle exception
 *
 * @param scope - CDK construct scope
 * @param id - Base identifier for the error handler chain
 * @param jobsTable - DynamoDB table for jobs
 * @param includeStepIndex - Whether to include step_index in error parsing
 * @returns Chain of states: parse error -> handle exception
 */
function createExceptionHandlerChain(scope, id, jobsTable, includeStepIndex = false) {
    const parseError = createErrorParser(scope, `${id}ParseError`, includeStepIndex);
    const handleException = createJobFailureHandler(scope, `${id}HandleException`, jobsTable, '$.parsedError.error_message', undefined, '$.parsedError.job_id');
    return parseError.next(handleException);
}
/**
 * Creates a handler for workflow step failures (business logic failures)
 *
 * @param scope - CDK construct scope
 * @param jobsTable - DynamoDB table for jobs
 * @returns DynamoDB update task for step failures
 */
function createStepFailureHandler(scope, jobsTable) {
    return createJobFailureHandler(scope, 'HandleStepFailure', jobsTable, '$.processResult.Payload.error', '$.processResult.Payload.error_type');
}
/**
 * Creates a handler for HTML generation failures
 *
 * @param scope - CDK construct scope
 * @param jobsTable - DynamoDB table for jobs
 * @returns DynamoDB update task for HTML generation failures
 */
function createHtmlGenerationFailureHandler(scope, jobsTable) {
    return createJobFailureHandler(scope, 'HandleHtmlGenerationFailure', jobsTable, '$.htmlResult.Payload.error', '$.htmlResult.Payload.error_type');
}
/**
 * Creates a DynamoDB update task to finalize a job as completed
 *
 * @param scope - CDK construct scope
 * @param id - Unique identifier for the task
 * @param jobsTable - DynamoDB table for jobs
 * @returns DynamoDB update task that marks job as completed
 */
function createJobFinalizer(scope, id, jobsTable) {
    return new tasks.DynamoUpdateItem(scope, id, {
        table: jobsTable,
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
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3ItaGFuZGxlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlcnJvci1oYW5kbGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTBCQSwwREFrQ0M7QUFVRCw4Q0FzQkM7QUFXRCxrRUFpQkM7QUFTRCw0REFXQztBQVNELGdGQVdDO0FBVUQsZ0RBb0JDO0FBN0xELG1FQUFxRDtBQUNyRCwyRUFBNkQ7QUFhN0Q7Ozs7Ozs7Ozs7R0FVRztBQUNILFNBQWdCLHVCQUF1QixDQUNyQyxLQUFnQixFQUNoQixFQUFVLEVBQ1YsU0FBMEIsRUFDMUIsU0FBaUIsRUFDakIsYUFBc0IsRUFDdEIsWUFBb0IsVUFBVTtJQUU5QixNQUFNLHlCQUF5QixHQUErQztRQUM1RSxTQUFTLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUM7UUFDMUQsUUFBUSxFQUFFLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDakYsYUFBYSxFQUFFLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsc0JBQXNCLENBQUMsQ0FBQztLQUNwRyxDQUFDO0lBRUYsSUFBSSxnQkFBZ0IsR0FBRyx5RUFBeUUsQ0FBQztJQUVqRyxJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQ2xCLHlCQUF5QixDQUFDLGFBQWEsQ0FBQyxHQUFHLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLENBQzlFLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUNyQyxDQUFDO1FBQ0YsZ0JBQWdCLElBQUksNEJBQTRCLENBQUM7SUFDbkQsQ0FBQztJQUVELE9BQU8sSUFBSSxLQUFLLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFF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Q0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsc0JBQXNCLENBQUMsQ0FBQztZQUNyRyxhQUFhLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1NBQ3BHO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgdGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbi8qKlxuICogT3B0aW9ucyBmb3IgY3JlYXRpbmcgZXJyb3IgaGFuZGxlcnNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFcnJvckhhbmRsZXJPcHRpb25zIHtcbiAgLyoqIER5bmFtb0RCIHRhYmxlIGZvciBqb2JzICovXG4gIGpvYnNUYWJsZTogZHluYW1vZGIuSVRhYmxlO1xuICAvKiogU2NvcGUgZm9yIGNyZWF0aW5nIGNvbnN0cnVjdHMgKi9cbiAgc2NvcGU6IENvbnN0cnVjdDtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgRHluYW1vREIgdXBkYXRlIHRhc2sgdG8gbWFyayBhIGpvYiBhcyBmYWlsZWRcbiAqIFxuICogQHBhcmFtIHNjb3BlIC0gQ0RLIGNvbnN0cnVjdCBzY29wZVxuICogQHBhcmFtIGlkIC0gVW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSB0YXNrXG4gKiBAcGFyYW0gam9ic1RhYmxlIC0gRHluYW1vREIgdGFibGUgZm9yIGpvYnNcbiAqIEBwYXJhbSBlcnJvclBhdGggLSBKU09OUGF0aCB0byB0aGUgZXJyb3IgbWVzc2FnZSBpbiB0aGUgc3RhdGVcbiAqIEBwYXJhbSBlcnJvclR5cGVQYXRoIC0gT3B0aW9uYWwgSlNPTlBhdGggdG8gdGhlIGVycm9yIHR5cGVcbiAqIEBwYXJhbSBqb2JJZFBhdGggLSBKU09OUGF0aCB0byB0aGUgam9iX2lkIChkZWZhdWx0cyB0byAnJC5qb2JfaWQnKVxuICogQHJldHVybnMgRHluYW1vREIgdXBkYXRlIHRhc2sgdGhhdCBtYXJrcyBqb2IgYXMgZmFpbGVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVKb2JGYWlsdXJlSGFuZGxlcihcbiAgc2NvcGU6IENvbnN0cnVjdCxcbiAgaWQ6IHN0cmluZyxcbiAgam9ic1RhYmxlOiBkeW5hbW9kYi5JVGFibGUsXG4gIGVycm9yUGF0aDogc3RyaW5nLFxuICBlcnJvclR5cGVQYXRoPzogc3RyaW5nLFxuICBqb2JJZFBhdGg6IHN0cmluZyA9ICckLmpvYl9pZCdcbik6IHRhc2tzLkR5bmFtb1VwZGF0ZUl0ZW0ge1xuICBjb25zdCBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZT4gPSB7XG4gICAgJzpzdGF0dXMnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdmYWlsZWQnKSxcbiAgICAnOmVycm9yJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoZXJyb3JQYXRoKSksXG4gICAgJzp1cGRhdGVkX2F0JzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJykpLFxuICB9O1xuXG4gIGxldCB1cGRhdGVFeHByZXNzaW9uID0gJ1NFVCAjc3RhdHVzID0gOnN0YXR1cywgZXJyb3JfbWVzc2FnZSA9IDplcnJvciwgdXBkYXRlZF9hdCA9IDp1cGRhdGVkX2F0JztcblxuICBpZiAoZXJyb3JUeXBlUGF0aCkge1xuICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXNbJzplcnJvcl90eXBlJ10gPSB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKFxuICAgICAgc2ZuLkpzb25QYXRoLnN0cmluZ0F0KGVycm9yVHlwZVBhdGgpXG4gICAgKTtcbiAgICB1cGRhdGVFeHByZXNzaW9uICs9ICcsIGVycm9yX3R5cGUgPSA6ZXJyb3JfdHlwZSc7XG4gIH1cblxuICByZXR1cm4gbmV3IHRhc2tzLkR5bmFtb1VwZGF0ZUl0ZW0oc2NvcGUsIGlkLCB7XG4gICAgdGFibGU6IGpvYnNUYWJsZSxcbiAgICBrZXk6IHtcbiAgICAgIGpvYl9pZDogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoam9iSWRQYXRoKSksXG4gICAgfSxcbiAgICB1cGRhdGVFeHByZXNzaW9uLFxuICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICB9LFxuICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXMsXG4gIH0pO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBQYXNzIHN0YXRlIHRoYXQgcGFyc2VzIExhbWJkYSBlcnJvciBpbmZvcm1hdGlvblxuICogXG4gKiBAcGFyYW0gc2NvcGUgLSBDREsgY29uc3RydWN0IHNjb3BlXG4gKiBAcGFyYW0gaWQgLSBVbmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIHBhc3Mgc3RhdGVcbiAqIEBwYXJhbSBpbmNsdWRlU3RlcEluZGV4IC0gV2hldGhlciB0byBpbmNsdWRlIHN0ZXBfaW5kZXggaW4gdGhlIHBhcnNlZCBlcnJvclxuICogQHJldHVybnMgUGFzcyBzdGF0ZSB0aGF0IHBhcnNlcyBlcnJvciBpbmZvcm1hdGlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRXJyb3JQYXJzZXIoXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIGlkOiBzdHJpbmcsXG4gIGluY2x1ZGVTdGVwSW5kZXg6IGJvb2xlYW4gPSBmYWxzZVxuKTogc2ZuLlBhc3Mge1xuICBjb25zdCBwYXJhbWV0ZXJzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge1xuICAgICdqb2JfaWQuJCc6ICckLmpvYl9pZCcsXG4gICAgJ2Vycm9yX21lc3NhZ2UnOiBzZm4uSnNvblBhdGguZm9ybWF0KFxuICAgICAgJ0xhbWJkYSBleGVjdXRpb24gZmFpbGVkOiB7fSAtIHt9JyxcbiAgICAgIHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5lcnJvci5FcnJvcicpLFxuICAgICAgc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmVycm9yLkNhdXNlJylcbiAgICApLFxuICB9O1xuXG4gIGlmIChpbmNsdWRlU3RlcEluZGV4KSB7XG4gICAgcGFyYW1ldGVyc1snc3RlcF9pbmRleC4kJ10gPSAnJC5zdGVwX2luZGV4JztcbiAgfVxuXG4gIHJldHVybiBuZXcgc2ZuLlBhc3Moc2NvcGUsIGlkLCB7XG4gICAgcGFyYW1ldGVycyxcbiAgICByZXN1bHRQYXRoOiAnJC5wYXJzZWRFcnJvcicsXG4gIH0pO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBjb21wbGV0ZSBlcnJvciBoYW5kbGVyIGNoYWluOiBwYXJzZSBlcnJvciAtPiBoYW5kbGUgZXhjZXB0aW9uXG4gKiBcbiAqIEBwYXJhbSBzY29wZSAtIENESyBjb25zdHJ1Y3Qgc2NvcGVcbiAqIEBwYXJhbSBpZCAtIEJhc2UgaWRlbnRpZmllciBmb3IgdGhlIGVycm9yIGhhbmRsZXIgY2hhaW5cbiAqIEBwYXJhbSBqb2JzVGFibGUgLSBEeW5hbW9EQiB0YWJsZSBmb3Igam9ic1xuICogQHBhcmFtIGluY2x1ZGVTdGVwSW5kZXggLSBXaGV0aGVyIHRvIGluY2x1ZGUgc3RlcF9pbmRleCBpbiBlcnJvciBwYXJzaW5nXG4gKiBAcmV0dXJucyBDaGFpbiBvZiBzdGF0ZXM6IHBhcnNlIGVycm9yIC0+IGhhbmRsZSBleGNlcHRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUV4Y2VwdGlvbkhhbmRsZXJDaGFpbihcbiAgc2NvcGU6IENvbnN0cnVjdCxcbiAgaWQ6IHN0cmluZyxcbiAgam9ic1RhYmxlOiBkeW5hbW9kYi5JVGFibGUsXG4gIGluY2x1ZGVTdGVwSW5kZXg6IGJvb2xlYW4gPSBmYWxzZVxuKTogc2ZuLklDaGFpbmFibGUge1xuICBjb25zdCBwYXJzZUVycm9yID0gY3JlYXRlRXJyb3JQYXJzZXIoc2NvcGUsIGAke2lkfVBhcnNlRXJyb3JgLCBpbmNsdWRlU3RlcEluZGV4KTtcbiAgY29uc3QgaGFuZGxlRXhjZXB0aW9uID0gY3JlYXRlSm9iRmFpbHVyZUhhbmRsZXIoXG4gICAgc2NvcGUsXG4gICAgYCR7aWR9SGFuZGxlRXhjZXB0aW9uYCxcbiAgICBqb2JzVGFibGUsXG4gICAgJyQucGFyc2VkRXJyb3IuZXJyb3JfbWVzc2FnZScsXG4gICAgdW5kZWZpbmVkLFxuICAgICckLnBhcnNlZEVycm9yLmpvYl9pZCdcbiAgKTtcblxuICByZXR1cm4gcGFyc2VFcnJvci5uZXh0KGhhbmRsZUV4Y2VwdGlvbik7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGhhbmRsZXIgZm9yIHdvcmtmbG93IHN0ZXAgZmFpbHVyZXMgKGJ1c2luZXNzIGxvZ2ljIGZhaWx1cmVzKVxuICogXG4gKiBAcGFyYW0gc2NvcGUgLSBDREsgY29uc3RydWN0IHNjb3BlXG4gKiBAcGFyYW0gam9ic1RhYmxlIC0gRHluYW1vREIgdGFibGUgZm9yIGpvYnNcbiAqIEByZXR1cm5zIER5bmFtb0RCIHVwZGF0ZSB0YXNrIGZvciBzdGVwIGZhaWx1cmVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdGVwRmFpbHVyZUhhbmRsZXIoXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIGpvYnNUYWJsZTogZHluYW1vZGIuSVRhYmxlXG4pOiB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtIHtcbiAgcmV0dXJuIGNyZWF0ZUpvYkZhaWx1cmVIYW5kbGVyKFxuICAgIHNjb3BlLFxuICAgICdIYW5kbGVTdGVwRmFpbHVyZScsXG4gICAgam9ic1RhYmxlLFxuICAgICckLnByb2Nlc3NSZXN1bHQuUGF5bG9hZC5lcnJvcicsXG4gICAgJyQucHJvY2Vzc1Jlc3VsdC5QYXlsb2FkLmVycm9yX3R5cGUnXG4gICk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGhhbmRsZXIgZm9yIEhUTUwgZ2VuZXJhdGlvbiBmYWlsdXJlc1xuICogXG4gKiBAcGFyYW0gc2NvcGUgLSBDREsgY29uc3RydWN0IHNjb3BlXG4gKiBAcGFyYW0gam9ic1RhYmxlIC0gRHluYW1vREIgdGFibGUgZm9yIGpvYnNcbiAqIEByZXR1cm5zIER5bmFtb0RCIHVwZGF0ZSB0YXNrIGZvciBIVE1MIGdlbmVyYXRpb24gZmFpbHVyZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUh0bWxHZW5lcmF0aW9uRmFpbHVyZUhhbmRsZXIoXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIGpvYnNUYWJsZTogZHluYW1vZGIuSVRhYmxlXG4pOiB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtIHtcbiAgcmV0dXJuIGNyZWF0ZUpvYkZhaWx1cmVIYW5kbGVyKFxuICAgIHNjb3BlLFxuICAgICdIYW5kbGVIdG1sR2VuZXJhdGlvbkZhaWx1cmUnLFxuICAgIGpvYnNUYWJsZSxcbiAgICAnJC5odG1sUmVzdWx0LlBheWxvYWQuZXJyb3InLFxuICAgICckLmh0bWxSZXN1bHQuUGF5bG9hZC5lcnJvcl90eXBlJ1xuICApO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBEeW5hbW9EQiB1cGRhdGUgdGFzayB0byBmaW5hbGl6ZSBhIGpvYiBhcyBjb21wbGV0ZWRcbiAqIFxuICogQHBhcmFtIHNjb3BlIC0gQ0RLIGNvbnN0cnVjdCBzY29wZVxuICogQHBhcmFtIGlkIC0gVW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSB0YXNrXG4gKiBAcGFyYW0gam9ic1RhYmxlIC0gRHluYW1vREIgdGFibGUgZm9yIGpvYnNcbiAqIEByZXR1cm5zIER5bmFtb0RCIHVwZGF0ZSB0YXNrIHRoYXQgbWFya3Mgam9iIGFzIGNvbXBsZXRlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSm9iRmluYWxpemVyKFxuICBzY29wZTogQ29uc3RydWN0LFxuICBpZDogc3RyaW5nLFxuICBqb2JzVGFibGU6IGR5bmFtb2RiLklUYWJsZVxuKTogdGFza3MuRHluYW1vVXBkYXRlSXRlbSB7XG4gIHJldHVybiBuZXcgdGFza3MuRHluYW1vVXBkYXRlSXRlbShzY29wZSwgaWQsIHtcbiAgICB0YWJsZTogam9ic1RhYmxlLFxuICAgIGtleToge1xuICAgICAgam9iX2lkOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5qb2JfaWQnKSksXG4gICAgfSxcbiAgICB1cGRhdGVFeHByZXNzaW9uOiAnU0VUICNzdGF0dXMgPSA6c3RhdHVzLCBjb21wbGV0ZWRfYXQgPSA6Y29tcGxldGVkX2F0LCB1cGRhdGVkX2F0ID0gOnVwZGF0ZWRfYXQnLFxuICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICB9LFxuICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygnY29tcGxldGVkJyksXG4gICAgICAnOmNvbXBsZXRlZF9hdCc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckJC5TdGF0ZS5FbnRlcmVkVGltZScpKSxcbiAgICAgICc6dXBkYXRlZF9hdCc6IHRhc2tzLkR5bmFtb0F0dHJpYnV0ZVZhbHVlLmZyb21TdHJpbmcoc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckJC5TdGF0ZS5FbnRlcmVkVGltZScpKSxcbiAgICB9LFxuICB9KTtcbn1cblxuIl19