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
exports.createLambdaErrorAlarm = createLambdaErrorAlarm;
exports.createLambdaDurationAlarm = createLambdaDurationAlarm;
exports.createLambdaThrottleAlarm = createLambdaThrottleAlarm;
exports.createStepFunctionsFailureAlarm = createStepFunctionsFailureAlarm;
exports.createStepFunctionsTimeoutAlarm = createStepFunctionsTimeoutAlarm;
exports.createLambdaAlarms = createLambdaAlarms;
exports.createStepFunctionsAlarms = createStepFunctionsAlarms;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatchActions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
/**
 * Creates a CloudWatch alarm for Lambda function errors
 *
 * @param scope - CDK construct scope
 * @param lambdaFunction - Lambda function to monitor
 * @param options - Alarm configuration options
 * @returns CloudWatch alarm
 */
function createLambdaErrorAlarm(scope, lambdaFunction, options) {
    const metric = lambdaFunction.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
    });
    const alarm = new cloudwatch.Alarm(scope, `${options.alarmName}Alarm`, {
        alarmName: options.alarmName,
        alarmDescription: options.alarmDescription,
        metric,
        threshold: options.threshold || 5,
        evaluationPeriods: options.evaluationPeriods || 1,
        comparisonOperator: options.comparisonOperator || cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    if (options.snsTopic) {
        alarm.addAlarmAction(new cloudwatchActions.SnsAction(options.snsTopic));
    }
    return alarm;
}
/**
 * Creates a CloudWatch alarm for Lambda function duration
 *
 * @param scope - CDK construct scope
 * @param lambdaFunction - Lambda function to monitor
 * @param options - Alarm configuration options
 * @param durationThresholdMs - Duration threshold in milliseconds
 * @returns CloudWatch alarm
 */
function createLambdaDurationAlarm(scope, lambdaFunction, options, durationThresholdMs) {
    const metric = lambdaFunction.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
    });
    const alarm = new cloudwatch.Alarm(scope, `${options.alarmName}Alarm`, {
        alarmName: options.alarmName,
        alarmDescription: options.alarmDescription,
        metric,
        threshold: durationThresholdMs,
        evaluationPeriods: options.evaluationPeriods || 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    if (options.snsTopic) {
        alarm.addAlarmAction(new cloudwatchActions.SnsAction(options.snsTopic));
    }
    return alarm;
}
/**
 * Creates a CloudWatch alarm for Lambda function throttles
 *
 * @param scope - CDK construct scope
 * @param lambdaFunction - Lambda function to monitor
 * @param options - Alarm configuration options
 * @returns CloudWatch alarm
 */
function createLambdaThrottleAlarm(scope, lambdaFunction, options) {
    const metric = lambdaFunction.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
    });
    const alarm = new cloudwatch.Alarm(scope, `${options.alarmName}Alarm`, {
        alarmName: options.alarmName,
        alarmDescription: options.alarmDescription,
        metric,
        threshold: options.threshold || 1,
        evaluationPeriods: options.evaluationPeriods || 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    if (options.snsTopic) {
        alarm.addAlarmAction(new cloudwatchActions.SnsAction(options.snsTopic));
    }
    return alarm;
}
/**
 * Creates a CloudWatch alarm for Step Functions execution failures
 *
 * @param scope - CDK construct scope
 * @param stateMachine - Step Functions state machine to monitor
 * @param options - Alarm configuration options
 * @returns CloudWatch alarm
 */
function createStepFunctionsFailureAlarm(scope, stateMachine, options) {
    const metric = stateMachine.metricFailed({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
    });
    const alarm = new cloudwatch.Alarm(scope, `${options.alarmName}Alarm`, {
        alarmName: options.alarmName,
        alarmDescription: options.alarmDescription,
        metric,
        threshold: options.threshold || 1,
        evaluationPeriods: options.evaluationPeriods || 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    if (options.snsTopic) {
        alarm.addAlarmAction(new cloudwatchActions.SnsAction(options.snsTopic));
    }
    return alarm;
}
/**
 * Creates a CloudWatch alarm for Step Functions execution timeouts
 *
 * @param scope - CDK construct scope
 * @param stateMachine - Step Functions state machine to monitor
 * @param options - Alarm configuration options
 * @returns CloudWatch alarm
 */
function createStepFunctionsTimeoutAlarm(scope, stateMachine, options) {
    const metric = stateMachine.metricTimedOut({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
    });
    const alarm = new cloudwatch.Alarm(scope, `${options.alarmName}Alarm`, {
        alarmName: options.alarmName,
        alarmDescription: options.alarmDescription,
        metric,
        threshold: options.threshold || 1,
        evaluationPeriods: options.evaluationPeriods || 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    if (options.snsTopic) {
        alarm.addAlarmAction(new cloudwatchActions.SnsAction(options.snsTopic));
    }
    return alarm;
}
/**
 * Creates a comprehensive set of alarms for a Lambda function
 *
 * @param scope - CDK construct scope
 * @param lambdaFunction - Lambda function to monitor
 * @param functionName - Name of the function (for alarm naming)
 * @param snsTopic - Optional SNS topic for notifications
 * @returns Object containing all created alarms
 */
function createLambdaAlarms(scope, lambdaFunction, functionName, snsTopic) {
    const errorAlarm = createLambdaErrorAlarm(scope, lambdaFunction, {
        alarmName: `${functionName}-errors`,
        alarmDescription: `Alarm for ${functionName} errors`,
        threshold: 5,
        evaluationPeriods: 1,
        snsTopic,
    });
    const throttleAlarm = createLambdaThrottleAlarm(scope, lambdaFunction, {
        alarmName: `${functionName}-throttles`,
        alarmDescription: `Alarm for ${functionName} throttles`,
        threshold: 1,
        evaluationPeriods: 1,
        snsTopic,
    });
    return {
        errorAlarm,
        throttleAlarm,
    };
}
/**
 * Creates a comprehensive set of alarms for a Step Functions state machine
 *
 * @param scope - CDK construct scope
 * @param stateMachine - Step Functions state machine to monitor
 * @param stateMachineName - Name of the state machine (for alarm naming)
 * @param snsTopic - Optional SNS topic for notifications
 * @returns Object containing all created alarms
 */
function createStepFunctionsAlarms(scope, stateMachine, stateMachineName, snsTopic) {
    const failureAlarm = createStepFunctionsFailureAlarm(scope, stateMachine, {
        alarmName: `${stateMachineName}-failures`,
        alarmDescription: `Alarm for ${stateMachineName} execution failures`,
        threshold: 1,
        evaluationPeriods: 1,
        snsTopic,
    });
    const timeoutAlarm = createStepFunctionsTimeoutAlarm(scope, stateMachine, {
        alarmName: `${stateMachineName}-timeouts`,
        alarmDescription: `Alarm for ${stateMachineName} execution timeouts`,
        threshold: 1,
        evaluationPeriods: 1,
        snsTopic,
    });
    return {
        failureAlarm,
        timeoutAlarm,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxhcm1zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWxhcm1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBa0NBLHdEQXlCQztBQVdELDhEQTBCQztBQVVELDhEQXlCQztBQVVELDBFQXlCQztBQVVELDBFQXlCQztBQVdELGdEQThCQztBQVdELDhEQTZCQztBQTFSRCxpREFBbUM7QUFDbkMsdUVBQXlEO0FBQ3pELHNGQUF3RTtBQXdCeEU7Ozs7Ozs7R0FPRztBQUNILFNBQWdCLHNCQUFzQixDQUNwQyxLQUFnQixFQUNoQixjQUFnQyxFQUNoQyxPQUFxQjtJQUVyQixNQUFNLE1BQU0sR0FBRyxjQUFjLENBQUMsWUFBWSxDQUFDO1FBQ3pDLFNBQVMsRUFBRSxLQUFLO1FBQ2hCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7S0FDaEMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxLQUFLLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxHQUFHLE9BQU8sQ0FBQyxTQUFTLE9BQU8sRUFBRTtRQUNyRSxTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7UUFDNUIsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLGdCQUFnQjtRQUMxQyxNQUFNO1FBQ04sU0FBUyxFQUFFLE9BQU8sQ0FBQyxTQUFTLElBQUksQ0FBQztRQUNqQyxpQkFBaUIsRUFBRSxPQUFPLENBQUMsaUJBQWlCLElBQUksQ0FBQztRQUNqRCxrQkFBa0IsRUFBRSxPQUFPLENBQUMsa0JBQWtCLElBQUksVUFBVSxDQUFDLGtCQUFrQixDQUFDLHNCQUFzQjtRQUN0RyxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYTtLQUM1RCxDQUFDLENBQUM7SUFFSCxJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNyQixLQUFLLENBQUMsY0FBYyxDQUFDLElB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RUFBRTtRQUN4RSxTQUFTLEVBQUUsR0FBRyxnQkFBZ0IsV0FBVztRQUN6QyxnQkFBZ0IsRUFBRSxhQUFhLGdCQUFnQixxQkFBcUI7UUFDcEUsU0FBUyxFQUFFLENBQUM7UUFDWixpQkFBaUIsRUFBRSxDQUFDO1FBQ3BCLFFBQVE7S0FDVCxDQUFDLENBQUM7SUFFSCxNQUFNLFlBQVksR0FBRywrQkFBK0IsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFO1FBQ3hFLFNBQVMsRUFBRSxHQUFHLGdCQUFnQixXQUFXO1FBQ3pDLGdCQUFnQixFQUFFLGFBQWEsZ0JBQWdCLHFCQUFxQjtRQUNwRSxTQUFTLEVBQUUsQ0FBQztRQUNaLGlCQUFpQixFQUFFLENBQUM7UUFDcEIsUUFBUTtLQUNULENBQUMsQ0FBQztJQUVILE9BQU87UUFDTCxZQUFZO1FBQ1osWUFBWTtLQUNiLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaEFjdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbi8qKlxuICogT3B0aW9ucyBmb3IgY3JlYXRpbmcgQ2xvdWRXYXRjaCBhbGFybXNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBbGFybU9wdGlvbnMge1xuICAvKiogQWxhcm0gbmFtZSAqL1xuICBhbGFybU5hbWU6IHN0cmluZztcbiAgLyoqIEFsYXJtIGRlc2NyaXB0aW9uICovXG4gIGFsYXJtRGVzY3JpcHRpb246IHN0cmluZztcbiAgLyoqIEV2YWx1YXRpb24gcGVyaW9kcyAqL1xuICBldmFsdWF0aW9uUGVyaW9kcz86IG51bWJlcjtcbiAgLyoqIFRocmVzaG9sZCB2YWx1ZSAqL1xuICB0aHJlc2hvbGQ/OiBudW1iZXI7XG4gIC8qKiBDb21wYXJpc29uIG9wZXJhdG9yICovXG4gIGNvbXBhcmlzb25PcGVyYXRvcj86IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yO1xuICAvKiogU05TIHRvcGljIGZvciBhbGFybSBub3RpZmljYXRpb25zIChvcHRpb25hbCkgKi9cbiAgc25zVG9waWM/OiBzbnMuSVRvcGljO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBDbG91ZFdhdGNoIGFsYXJtIGZvciBMYW1iZGEgZnVuY3Rpb24gZXJyb3JzXG4gKiBcbiAqIEBwYXJhbSBzY29wZSAtIENESyBjb25zdHJ1Y3Qgc2NvcGVcbiAqIEBwYXJhbSBsYW1iZGFGdW5jdGlvbiAtIExhbWJkYSBmdW5jdGlvbiB0byBtb25pdG9yXG4gKiBAcGFyYW0gb3B0aW9ucyAtIEFsYXJtIGNvbmZpZ3VyYXRpb24gb3B0aW9uc1xuICogQHJldHVybnMgQ2xvdWRXYXRjaCBhbGFybVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTGFtYmRhRXJyb3JBbGFybShcbiAgc2NvcGU6IENvbnN0cnVjdCxcbiAgbGFtYmRhRnVuY3Rpb246IGxhbWJkYS5JRnVuY3Rpb24sXG4gIG9wdGlvbnM6IEFsYXJtT3B0aW9uc1xuKTogY2xvdWR3YXRjaC5BbGFybSB7XG4gIGNvbnN0IG1ldHJpYyA9IGxhbWJkYUZ1bmN0aW9uLm1ldHJpY0Vycm9ycyh7XG4gICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICB9KTtcblxuICBjb25zdCBhbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHNjb3BlLCBgJHtvcHRpb25zLmFsYXJtTmFtZX1BbGFybWAsIHtcbiAgICBhbGFybU5hbWU6IG9wdGlvbnMuYWxhcm1OYW1lLFxuICAgIGFsYXJtRGVzY3JpcHRpb246IG9wdGlvbnMuYWxhcm1EZXNjcmlwdGlvbixcbiAgICBtZXRyaWMsXG4gICAgdGhyZXNob2xkOiBvcHRpb25zLnRocmVzaG9sZCB8fCA1LFxuICAgIGV2YWx1YXRpb25QZXJpb2RzOiBvcHRpb25zLmV2YWx1YXRpb25QZXJpb2RzIHx8IDEsXG4gICAgY29tcGFyaXNvbk9wZXJhdG9yOiBvcHRpb25zLmNvbXBhcmlzb25PcGVyYXRvciB8fCBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICB9KTtcblxuICBpZiAob3B0aW9ucy5zbnNUb3BpYykge1xuICAgIGFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24ob3B0aW9ucy5zbnNUb3BpYykpO1xuICB9XG5cbiAgcmV0dXJuIGFsYXJtO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBDbG91ZFdhdGNoIGFsYXJtIGZvciBMYW1iZGEgZnVuY3Rpb24gZHVyYXRpb25cbiAqIFxuICogQHBhcmFtIHNjb3BlIC0gQ0RLIGNvbnN0cnVjdCBzY29wZVxuICogQHBhcmFtIGxhbWJkYUZ1bmN0aW9uIC0gTGFtYmRhIGZ1bmN0aW9uIHRvIG1vbml0b3JcbiAqIEBwYXJhbSBvcHRpb25zIC0gQWxhcm0gY29uZmlndXJhdGlvbiBvcHRpb25zXG4gKiBAcGFyYW0gZHVyYXRpb25UaHJlc2hvbGRNcyAtIER1cmF0aW9uIHRocmVzaG9sZCBpbiBtaWxsaXNlY29uZHNcbiAqIEByZXR1cm5zIENsb3VkV2F0Y2ggYWxhcm1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxhbWJkYUR1cmF0aW9uQWxhcm0oXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGEuSUZ1bmN0aW9uLFxuICBvcHRpb25zOiBBbGFybU9wdGlvbnMsXG4gIGR1cmF0aW9uVGhyZXNob2xkTXM6IG51bWJlclxuKTogY2xvdWR3YXRjaC5BbGFybSB7XG4gIGNvbnN0IG1ldHJpYyA9IGxhbWJkYUZ1bmN0aW9uLm1ldHJpY0R1cmF0aW9uKHtcbiAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICB9KTtcblxuICBjb25zdCBhbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHNjb3BlLCBgJHtvcHRpb25zLmFsYXJtTmFtZX1BbGFybWAsIHtcbiAgICBhbGFybU5hbWU6IG9wdGlvbnMuYWxhcm1OYW1lLFxuICAgIGFsYXJtRGVzY3JpcHRpb246IG9wdGlvbnMuYWxhcm1EZXNjcmlwdGlvbixcbiAgICBtZXRyaWMsXG4gICAgdGhyZXNob2xkOiBkdXJhdGlvblRocmVzaG9sZE1zLFxuICAgIGV2YWx1YXRpb25QZXJpb2RzOiBvcHRpb25zLmV2YWx1YXRpb25QZXJpb2RzIHx8IDIsXG4gICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICB9KTtcblxuICBpZiAob3B0aW9ucy5zbnNUb3BpYykge1xuICAgIGFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24ob3B0aW9ucy5zbnNUb3BpYykpO1xuICB9XG5cbiAgcmV0dXJuIGFsYXJtO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBDbG91ZFdhdGNoIGFsYXJtIGZvciBMYW1iZGEgZnVuY3Rpb24gdGhyb3R0bGVzXG4gKiBcbiAqIEBwYXJhbSBzY29wZSAtIENESyBjb25zdHJ1Y3Qgc2NvcGVcbiAqIEBwYXJhbSBsYW1iZGFGdW5jdGlvbiAtIExhbWJkYSBmdW5jdGlvbiB0byBtb25pdG9yXG4gKiBAcGFyYW0gb3B0aW9ucyAtIEFsYXJtIGNvbmZpZ3VyYXRpb24gb3B0aW9uc1xuICogQHJldHVybnMgQ2xvdWRXYXRjaCBhbGFybVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTGFtYmRhVGhyb3R0bGVBbGFybShcbiAgc2NvcGU6IENvbnN0cnVjdCxcbiAgbGFtYmRhRnVuY3Rpb246IGxhbWJkYS5JRnVuY3Rpb24sXG4gIG9wdGlvbnM6IEFsYXJtT3B0aW9uc1xuKTogY2xvdWR3YXRjaC5BbGFybSB7XG4gIGNvbnN0IG1ldHJpYyA9IGxhbWJkYUZ1bmN0aW9uLm1ldHJpY1Rocm90dGxlcyh7XG4gICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICB9KTtcblxuICBjb25zdCBhbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHNjb3BlLCBgJHtvcHRpb25zLmFsYXJtTmFtZX1BbGFybWAsIHtcbiAgICBhbGFybU5hbWU6IG9wdGlvbnMuYWxhcm1OYW1lLFxuICAgIGFsYXJtRGVzY3JpcHRpb246IG9wdGlvbnMuYWxhcm1EZXNjcmlwdGlvbixcbiAgICBtZXRyaWMsXG4gICAgdGhyZXNob2xkOiBvcHRpb25zLnRocmVzaG9sZCB8fCAxLFxuICAgIGV2YWx1YXRpb25QZXJpb2RzOiBvcHRpb25zLmV2YWx1YXRpb25QZXJpb2RzIHx8IDEsXG4gICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICB9KTtcblxuICBpZiAob3B0aW9ucy5zbnNUb3BpYykge1xuICAgIGFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24ob3B0aW9ucy5zbnNUb3BpYykpO1xuICB9XG5cbiAgcmV0dXJuIGFsYXJtO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBDbG91ZFdhdGNoIGFsYXJtIGZvciBTdGVwIEZ1bmN0aW9ucyBleGVjdXRpb24gZmFpbHVyZXNcbiAqIFxuICogQHBhcmFtIHNjb3BlIC0gQ0RLIGNvbnN0cnVjdCBzY29wZVxuICogQHBhcmFtIHN0YXRlTWFjaGluZSAtIFN0ZXAgRnVuY3Rpb25zIHN0YXRlIG1hY2hpbmUgdG8gbW9uaXRvclxuICogQHBhcmFtIG9wdGlvbnMgLSBBbGFybSBjb25maWd1cmF0aW9uIG9wdGlvbnNcbiAqIEByZXR1cm5zIENsb3VkV2F0Y2ggYWxhcm1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0ZXBGdW5jdGlvbnNGYWlsdXJlQWxhcm0oXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIHN0YXRlTWFjaGluZTogc2ZuLklTdGF0ZU1hY2hpbmUsXG4gIG9wdGlvbnM6IEFsYXJtT3B0aW9uc1xuKTogY2xvdWR3YXRjaC5BbGFybSB7XG4gIGNvbnN0IG1ldHJpYyA9IHN0YXRlTWFjaGluZS5tZXRyaWNGYWlsZWQoe1xuICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgfSk7XG5cbiAgY29uc3QgYWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShzY29wZSwgYCR7b3B0aW9ucy5hbGFybU5hbWV9QWxhcm1gLCB7XG4gICAgYWxhcm1OYW1lOiBvcHRpb25zLmFsYXJtTmFtZSxcbiAgICBhbGFybURlc2NyaXB0aW9uOiBvcHRpb25zLmFsYXJtRGVzY3JpcHRpb24sXG4gICAgbWV0cmljLFxuICAgIHRocmVzaG9sZDogb3B0aW9ucy50aHJlc2hvbGQgfHwgMSxcbiAgICBldmFsdWF0aW9uUGVyaW9kczogb3B0aW9ucy5ldmFsdWF0aW9uUGVyaW9kcyB8fCAxLFxuICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgfSk7XG5cbiAgaWYgKG9wdGlvbnMuc25zVG9waWMpIHtcbiAgICBhbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKG9wdGlvbnMuc25zVG9waWMpKTtcbiAgfVxuXG4gIHJldHVybiBhbGFybTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgQ2xvdWRXYXRjaCBhbGFybSBmb3IgU3RlcCBGdW5jdGlvbnMgZXhlY3V0aW9uIHRpbWVvdXRzXG4gKiBcbiAqIEBwYXJhbSBzY29wZSAtIENESyBjb25zdHJ1Y3Qgc2NvcGVcbiAqIEBwYXJhbSBzdGF0ZU1hY2hpbmUgLSBTdGVwIEZ1bmN0aW9ucyBzdGF0ZSBtYWNoaW5lIHRvIG1vbml0b3JcbiAqIEBwYXJhbSBvcHRpb25zIC0gQWxhcm0gY29uZmlndXJhdGlvbiBvcHRpb25zXG4gKiBAcmV0dXJucyBDbG91ZFdhdGNoIGFsYXJtXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdGVwRnVuY3Rpb25zVGltZW91dEFsYXJtKFxuICBzY29wZTogQ29uc3RydWN0LFxuICBzdGF0ZU1hY2hpbmU6IHNmbi5JU3RhdGVNYWNoaW5lLFxuICBvcHRpb25zOiBBbGFybU9wdGlvbnNcbik6IGNsb3Vkd2F0Y2guQWxhcm0ge1xuICBjb25zdCBtZXRyaWMgPSBzdGF0ZU1hY2hpbmUubWV0cmljVGltZWRPdXQoe1xuICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgfSk7XG5cbiAgY29uc3QgYWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShzY29wZSwgYCR7b3B0aW9ucy5hbGFybU5hbWV9QWxhcm1gLCB7XG4gICAgYWxhcm1OYW1lOiBvcHRpb25zLmFsYXJtTmFtZSxcbiAgICBhbGFybURlc2NyaXB0aW9uOiBvcHRpb25zLmFsYXJtRGVzY3JpcHRpb24sXG4gICAgbWV0cmljLFxuICAgIHRocmVzaG9sZDogb3B0aW9ucy50aHJlc2hvbGQgfHwgMSxcbiAgICBldmFsdWF0aW9uUGVyaW9kczogb3B0aW9ucy5ldmFsdWF0aW9uUGVyaW9kcyB8fCAxLFxuICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgfSk7XG5cbiAgaWYgKG9wdGlvbnMuc25zVG9waWMpIHtcbiAgICBhbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKG9wdGlvbnMuc25zVG9waWMpKTtcbiAgfVxuXG4gIHJldHVybiBhbGFybTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgY29tcHJlaGVuc2l2ZSBzZXQgb2YgYWxhcm1zIGZvciBhIExhbWJkYSBmdW5jdGlvblxuICogXG4gKiBAcGFyYW0gc2NvcGUgLSBDREsgY29uc3RydWN0IHNjb3BlXG4gKiBAcGFyYW0gbGFtYmRhRnVuY3Rpb24gLSBMYW1iZGEgZnVuY3Rpb24gdG8gbW9uaXRvclxuICogQHBhcmFtIGZ1bmN0aW9uTmFtZSAtIE5hbWUgb2YgdGhlIGZ1bmN0aW9uIChmb3IgYWxhcm0gbmFtaW5nKVxuICogQHBhcmFtIHNuc1RvcGljIC0gT3B0aW9uYWwgU05TIHRvcGljIGZvciBub3RpZmljYXRpb25zXG4gKiBAcmV0dXJucyBPYmplY3QgY29udGFpbmluZyBhbGwgY3JlYXRlZCBhbGFybXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxhbWJkYUFsYXJtcyhcbiAgc2NvcGU6IENvbnN0cnVjdCxcbiAgbGFtYmRhRnVuY3Rpb246IGxhbWJkYS5JRnVuY3Rpb24sXG4gIGZ1bmN0aW9uTmFtZTogc3RyaW5nLFxuICBzbnNUb3BpYz86IHNucy5JVG9waWNcbik6IHtcbiAgZXJyb3JBbGFybTogY2xvdWR3YXRjaC5BbGFybTtcbiAgZHVyYXRpb25BbGFybT86IGNsb3Vkd2F0Y2guQWxhcm07XG4gIHRocm90dGxlQWxhcm06IGNsb3Vkd2F0Y2guQWxhcm07XG59IHtcbiAgY29uc3QgZXJyb3JBbGFybSA9IGNyZWF0ZUxhbWJkYUVycm9yQWxhcm0oc2NvcGUsIGxhbWJkYUZ1bmN0aW9uLCB7XG4gICAgYWxhcm1OYW1lOiBgJHtmdW5jdGlvbk5hbWV9LWVycm9yc2AsXG4gICAgYWxhcm1EZXNjcmlwdGlvbjogYEFsYXJtIGZvciAke2Z1bmN0aW9uTmFtZX0gZXJyb3JzYCxcbiAgICB0aHJlc2hvbGQ6IDUsXG4gICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgc25zVG9waWMsXG4gIH0pO1xuXG4gIGNvbnN0IHRocm90dGxlQWxhcm0gPSBjcmVhdGVMYW1iZGFUaHJvdHRsZUFsYXJtKHNjb3BlLCBsYW1iZGFGdW5jdGlvbiwge1xuICAgIGFsYXJtTmFtZTogYCR7ZnVuY3Rpb25OYW1lfS10aHJvdHRsZXNgLFxuICAgIGFsYXJtRGVzY3JpcHRpb246IGBBbGFybSBmb3IgJHtmdW5jdGlvbk5hbWV9IHRocm90dGxlc2AsXG4gICAgdGhyZXNob2xkOiAxLFxuICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgIHNuc1RvcGljLFxuICB9KTtcblxuICByZXR1cm4ge1xuICAgIGVycm9yQWxhcm0sXG4gICAgdGhyb3R0bGVBbGFybSxcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgY29tcHJlaGVuc2l2ZSBzZXQgb2YgYWxhcm1zIGZvciBhIFN0ZXAgRnVuY3Rpb25zIHN0YXRlIG1hY2hpbmVcbiAqIFxuICogQHBhcmFtIHNjb3BlIC0gQ0RLIGNvbnN0cnVjdCBzY29wZVxuICogQHBhcmFtIHN0YXRlTWFjaGluZSAtIFN0ZXAgRnVuY3Rpb25zIHN0YXRlIG1hY2hpbmUgdG8gbW9uaXRvclxuICogQHBhcmFtIHN0YXRlTWFjaGluZU5hbWUgLSBOYW1lIG9mIHRoZSBzdGF0ZSBtYWNoaW5lIChmb3IgYWxhcm0gbmFtaW5nKVxuICogQHBhcmFtIHNuc1RvcGljIC0gT3B0aW9uYWwgU05TIHRvcGljIGZvciBub3RpZmljYXRpb25zXG4gKiBAcmV0dXJucyBPYmplY3QgY29udGFpbmluZyBhbGwgY3JlYXRlZCBhbGFybXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0ZXBGdW5jdGlvbnNBbGFybXMoXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIHN0YXRlTWFjaGluZTogc2ZuLklTdGF0ZU1hY2hpbmUsXG4gIHN0YXRlTWFjaGluZU5hbWU6IHN0cmluZyxcbiAgc25zVG9waWM/OiBzbnMuSVRvcGljXG4pOiB7XG4gIGZhaWx1cmVBbGFybTogY2xvdWR3YXRjaC5BbGFybTtcbiAgdGltZW91dEFsYXJtOiBjbG91ZHdhdGNoLkFsYXJtO1xufSB7XG4gIGNvbnN0IGZhaWx1cmVBbGFybSA9IGNyZWF0ZVN0ZXBGdW5jdGlvbnNGYWlsdXJlQWxhcm0oc2NvcGUsIHN0YXRlTWFjaGluZSwge1xuICAgIGFsYXJtTmFtZTogYCR7c3RhdGVNYWNoaW5lTmFtZX0tZmFpbHVyZXNgLFxuICAgIGFsYXJtRGVzY3JpcHRpb246IGBBbGFybSBmb3IgJHtzdGF0ZU1hY2hpbmVOYW1lfSBleGVjdXRpb24gZmFpbHVyZXNgLFxuICAgIHRocmVzaG9sZDogMSxcbiAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICBzbnNUb3BpYyxcbiAgfSk7XG5cbiAgY29uc3QgdGltZW91dEFsYXJtID0gY3JlYXRlU3RlcEZ1bmN0aW9uc1RpbWVvdXRBbGFybShzY29wZSwgc3RhdGVNYWNoaW5lLCB7XG4gICAgYWxhcm1OYW1lOiBgJHtzdGF0ZU1hY2hpbmVOYW1lfS10aW1lb3V0c2AsXG4gICAgYWxhcm1EZXNjcmlwdGlvbjogYEFsYXJtIGZvciAke3N0YXRlTWFjaGluZU5hbWV9IGV4ZWN1dGlvbiB0aW1lb3V0c2AsXG4gICAgdGhyZXNob2xkOiAxLFxuICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgIHNuc1RvcGljLFxuICB9KTtcblxuICByZXR1cm4ge1xuICAgIGZhaWx1cmVBbGFybSxcbiAgICB0aW1lb3V0QWxhcm0sXG4gIH07XG59XG5cbiJdfQ==