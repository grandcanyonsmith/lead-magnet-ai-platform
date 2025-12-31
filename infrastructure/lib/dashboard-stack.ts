import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

export interface DashboardStackProps extends cdk.StackProps {
  api: apigateway.HttpApi;
  apiFunction: lambda.IFunction;
  jobProcessorFunction: lambda.IFunction;
  stateMachine: sfn.StateMachine;
  shellExecutorCluster: ecs.Cluster;
}

export class DashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DashboardStackProps) {
    super(scope, id, props);

    const dashboard = new cloudwatch.Dashboard(this, 'LeadMagnetDashboard', {
      dashboardName: 'LeadMagnet-Overview',
    });

    // --- API Gateway Metrics ---
    const apiErrors4xx = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4xx',
      dimensionsMap: { ApiId: props.api.apiId },
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
    });

    const apiErrors5xx = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5xx',
      dimensionsMap: { ApiId: props.api.apiId },
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
    });

    const apiCount = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: { ApiId: props.api.apiId },
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
    });

    const apiLatency = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: { ApiId: props.api.apiId },
      statistic: 'Average',
      period: cdk.Duration.minutes(1),
    });

    // --- Lambda Metrics ---
    const apiLambdaErrors = props.apiFunction.metricErrors({ period: cdk.Duration.minutes(1) });
    const apiLambdaDuration = props.apiFunction.metricDuration({ period: cdk.Duration.minutes(1) });
    const workerLambdaErrors = props.jobProcessorFunction.metricErrors({ period: cdk.Duration.minutes(1) });
    const workerLambdaDuration = props.jobProcessorFunction.metricDuration({ period: cdk.Duration.minutes(1) });

    // --- Step Functions Metrics ---
    const sfnExecutionsFailed = props.stateMachine.metricFailed({ period: cdk.Duration.minutes(1) });
    const sfnExecutionsThrottled = props.stateMachine.metricThrottled({ period: cdk.Duration.minutes(1) });
    const sfnExecutionsSucceeded = props.stateMachine.metricSucceeded({ period: cdk.Duration.minutes(1) });

    // --- Shell Executor Metrics ---
    const shellRunningTasks = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'RunningTaskCount',
      dimensionsMap: { ClusterName: props.shellExecutorCluster.clusterName },
      statistic: 'Maximum',
      period: cdk.Duration.minutes(1),
    });

    const shellPendingTasks = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'PendingTaskCount',
      dimensionsMap: { ClusterName: props.shellExecutorCluster.clusterName },
      statistic: 'Maximum',
      period: cdk.Duration.minutes(1),
    });

    // --- DynamoDB Metrics (Global) ---
    // We can't easily iterate all tables here without passing them all, 
    // but we can look at account-level DynamoDB metrics if available, or just a few key tables.
    // For now, let's omit specific table metrics to keep it clean, or add later if requested.

    // Add widgets to dashboard
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Lead Magnet Platform Status',
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests & Errors',
        left: [apiCount],
        right: [apiErrors4xx, apiErrors5xx],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Latency',
        left: [apiLatency],
        width: 12,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [apiLambdaErrors, workerLambdaErrors],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [apiLambdaDuration, workerLambdaDuration],
        width: 12,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Step Functions Executions',
        left: [sfnExecutionsSucceeded],
        right: [sfnExecutionsFailed, sfnExecutionsThrottled],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Shell Executor Tasks',
        left: [shellRunningTasks],
        right: [shellPendingTasks],
        width: 12,
      })
    );
  }
}

