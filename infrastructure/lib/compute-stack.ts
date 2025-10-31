import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ComputeStackProps extends cdk.StackProps {
  tablesMap: Record<string, dynamodb.Table>;
  artifactsBucket: s3.Bucket;
  taskDefinition?: ecs.FargateTaskDefinition; // Optional - task definition from WorkerStack
}

export class ComputeStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine;
  public readonly stateMachineArn: string;
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // Create VPC for ECS
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // Create ECS Cluster
    this.cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: 'leadmagnet-cluster',
      vpc,
      containerInsights: true,
    });

    // Create IAM role for Step Functions
    const stateMachineRole = new iam.Role(this, 'StateMachineRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });

    // Grant DynamoDB permissions
    Object.values(props.tablesMap).forEach((table) => {
      table.grantReadWriteData(stateMachineRole);
    });

    // Grant S3 permissions
    props.artifactsBucket.grantReadWrite(stateMachineRole);

    // Grant ECS permissions
    stateMachineRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ecs:RunTask',
          'ecs:StopTask',
          'ecs:DescribeTasks',
        ],
        resources: ['*'],
      })
    );

    stateMachineRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: ['*'],
      })
    );

    // Grant EventBridge permissions for managed rules
    stateMachineRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'events:PutRule',
          'events:PutTargets',
          'events:DeleteRule',
          'events:RemoveTargets',
          'events:DescribeRule',
        ],
        resources: ['*'],
      })
    );

    // Simple Step Functions State Machine
    // Update job status to processing
    const updateJobStatus = new tasks.DynamoUpdateItem(this, 'UpdateJobStatus', {
      table: props.tablesMap.jobs,
      key: {
        job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.job_id')),
      },
      updateExpression: 'SET #status = :status, updated_at = :updated_at',
      expressionAttributeNames: {
        '#status': 'status',
      },
      expressionAttributeValues: {
        ':status': tasks.DynamoAttributeValue.fromString('processing'),
        ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
      },
      resultPath: '$.updateResult',
    });

    // Get subnets for ECS task
    const subnets = vpc.privateSubnets.map(s => s.subnetId);

    // Process job using ECS task
    // Use CloudFormation import to get task definition ARN from WorkerStack
    const taskDefinitionArn = props.taskDefinition?.taskDefinitionArn || 
      cdk.Fn.importValue('WorkerTaskDefinitionArn');
    
    // Invoke ECS task to process the job using the task definition ARN
    const processJob = new tasks.EcsRunTask(this, 'ProcessJob', {
      cluster: this.cluster,
      taskDefinition: ecs.TaskDefinition.fromTaskDefinitionArn(
        this,
        'WorkerTaskDef',
        taskDefinitionArn
      ) as any, // Cast needed because fromTaskDefinitionArn returns ITaskDefinition
      launchTarget: new tasks.EcsFargateLaunchTarget(),
      assignPublicIp: false,
      subnets: { subnets: vpc.privateSubnets },
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      resultPath: '$.processResult',
      // Pass JOB_ID as environment variable via task input
      // The worker will read JOB_ID from environment
    });

    // Update job status to completed
    const handleSuccess = new tasks.DynamoUpdateItem(this, 'HandleSuccess', {
      table: props.tablesMap.jobs,
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

    // Update job status to failed
    const handleFailure = new tasks.DynamoUpdateItem(this, 'HandleFailure', {
      table: props.tablesMap.jobs,
      key: {
        job_id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.job_id')),
      },
      updateExpression: 'SET #status = :status, error_message = :error, updated_at = :updated_at',
      expressionAttributeNames: {
        '#status': 'status',
      },
      expressionAttributeValues: {
        ':status': tasks.DynamoAttributeValue.fromString('failed'),
        ':error': tasks.DynamoAttributeValue.fromString('Error occurred'),
        ':updated_at': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
      },
    });

    // Define workflow with error handling
    // Wrap the process in a parallel state for error handling
    const tryProcess = new sfn.Parallel(this, 'TryProcess', {
      resultPath: '$.parallelResult',
    });
    
    tryProcess.branch(processJob);
    tryProcess.addCatch(handleFailure, {
      resultPath: '$.error',
    });

    const definition = updateJobStatus
      .next(tryProcess)
      .next(handleSuccess);

    // Create State Machine
    this.stateMachine = new sfn.StateMachine(this, 'JobProcessorStateMachine', {
      stateMachineName: 'leadmagnet-job-processor',
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      role: stateMachineRole,
      logs: {
        destination: new logs.LogGroup(this, 'StateMachineLogGroup', {
          logGroupName: '/aws/stepfunctions/leadmagnet-job-processor',
          retention: logs.RetentionDays.ONE_WEEK,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
        level: sfn.LogLevel.ALL,
        includeExecutionData: true,
      },
      tracingEnabled: true,
    });

    this.stateMachineArn = this.stateMachine.stateMachineArn;

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      exportName: 'StateMachineArn',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      exportName: 'ClusterName',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      exportName: 'VpcId',
    });
  }
}
