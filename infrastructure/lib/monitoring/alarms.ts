import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
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
export function createLambdaErrorAlarm(
  scope: Construct,
  lambdaFunction: lambda.IFunction,
  options: AlarmOptions
): cloudwatch.Alarm {
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
export function createLambdaDurationAlarm(
  scope: Construct,
  lambdaFunction: lambda.IFunction,
  options: AlarmOptions,
  durationThresholdMs: number
): cloudwatch.Alarm {
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
export function createLambdaThrottleAlarm(
  scope: Construct,
  lambdaFunction: lambda.IFunction,
  options: AlarmOptions
): cloudwatch.Alarm {
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
export function createStepFunctionsFailureAlarm(
  scope: Construct,
  stateMachine: sfn.IStateMachine,
  options: AlarmOptions
): cloudwatch.Alarm {
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
export function createStepFunctionsTimeoutAlarm(
  scope: Construct,
  stateMachine: sfn.IStateMachine,
  options: AlarmOptions
): cloudwatch.Alarm {
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
export function createLambdaAlarms(
  scope: Construct,
  lambdaFunction: lambda.IFunction,
  functionName: string,
  snsTopic?: sns.ITopic
): {
  errorAlarm: cloudwatch.Alarm;
  durationAlarm?: cloudwatch.Alarm;
  throttleAlarm: cloudwatch.Alarm;
} {
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
export function createStepFunctionsAlarms(
  scope: Construct,
  stateMachine: sfn.IStateMachine,
  stateMachineName: string,
  snsTopic?: sns.ITopic
): {
  failureAlarm: cloudwatch.Alarm;
  timeoutAlarm: cloudwatch.Alarm;
} {
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

