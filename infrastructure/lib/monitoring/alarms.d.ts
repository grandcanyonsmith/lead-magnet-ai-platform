import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
/**
 * Options for creating CloudWatch alarms
 */
export interface AlarmOptions {
    /** Alarm name */
    alarmName: string;
    /** Alarm description */
    alarmDescription: string;
    /** Evaluation periods */
    evaluationPeriods?: number;
    /** Threshold value */
    threshold?: number;
    /** Comparison operator */
    comparisonOperator?: cloudwatch.ComparisonOperator;
    /** SNS topic for alarm notifications (optional) */
    snsTopic?: sns.ITopic;
}
/**
 * Creates a CloudWatch alarm for Lambda function errors
 *
 * @param scope - CDK construct scope
 * @param lambdaFunction - Lambda function to monitor
 * @param options - Alarm configuration options
 * @returns CloudWatch alarm
 */
export declare function createLambdaErrorAlarm(scope: Construct, lambdaFunction: lambda.IFunction, options: AlarmOptions): cloudwatch.Alarm;
/**
 * Creates a CloudWatch alarm for Lambda function duration
 *
 * @param scope - CDK construct scope
 * @param lambdaFunction - Lambda function to monitor
 * @param options - Alarm configuration options
 * @param durationThresholdMs - Duration threshold in milliseconds
 * @returns CloudWatch alarm
 */
export declare function createLambdaDurationAlarm(scope: Construct, lambdaFunction: lambda.IFunction, options: AlarmOptions, durationThresholdMs: number): cloudwatch.Alarm;
/**
 * Creates a CloudWatch alarm for Lambda function throttles
 *
 * @param scope - CDK construct scope
 * @param lambdaFunction - Lambda function to monitor
 * @param options - Alarm configuration options
 * @returns CloudWatch alarm
 */
export declare function createLambdaThrottleAlarm(scope: Construct, lambdaFunction: lambda.IFunction, options: AlarmOptions): cloudwatch.Alarm;
/**
 * Creates a CloudWatch alarm for Step Functions execution failures
 *
 * @param scope - CDK construct scope
 * @param stateMachine - Step Functions state machine to monitor
 * @param options - Alarm configuration options
 * @returns CloudWatch alarm
 */
export declare function createStepFunctionsFailureAlarm(scope: Construct, stateMachine: sfn.IStateMachine, options: AlarmOptions): cloudwatch.Alarm;
/**
 * Creates a CloudWatch alarm for Step Functions execution timeouts
 *
 * @param scope - CDK construct scope
 * @param stateMachine - Step Functions state machine to monitor
 * @param options - Alarm configuration options
 * @returns CloudWatch alarm
 */
export declare function createStepFunctionsTimeoutAlarm(scope: Construct, stateMachine: sfn.IStateMachine, options: AlarmOptions): cloudwatch.Alarm;
/**
 * Creates a comprehensive set of alarms for a Lambda function
 *
 * @param scope - CDK construct scope
 * @param lambdaFunction - Lambda function to monitor
 * @param functionName - Name of the function (for alarm naming)
 * @param snsTopic - Optional SNS topic for notifications
 * @returns Object containing all created alarms
 */
export declare function createLambdaAlarms(scope: Construct, lambdaFunction: lambda.IFunction, functionName: string, snsTopic?: sns.ITopic): {
    errorAlarm: cloudwatch.Alarm;
    durationAlarm?: cloudwatch.Alarm;
    throttleAlarm: cloudwatch.Alarm;
};
/**
 * Creates a comprehensive set of alarms for a Step Functions state machine
 *
 * @param scope - CDK construct scope
 * @param stateMachine - Step Functions state machine to monitor
 * @param stateMachineName - Name of the state machine (for alarm naming)
 * @param snsTopic - Optional SNS topic for notifications
 * @returns Object containing all created alarms
 */
export declare function createStepFunctionsAlarms(scope: Construct, stateMachine: sfn.IStateMachine, stateMachineName: string, snsTopic?: sns.ITopic): {
    failureAlarm: cloudwatch.Alarm;
    timeoutAlarm: cloudwatch.Alarm;
};
