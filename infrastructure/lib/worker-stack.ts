import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface WorkerStackProps extends cdk.StackProps {
  tablesMap: Record<string, dynamodb.ITable>;
  artifactsBucket: s3.Bucket;
}

export class WorkerStack extends cdk.Stack {
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: WorkerStackProps) {
    super(scope, id, props);

    // Create ECR Repository for worker image (optional, kept for potential future containerized workloads)
    // Note: Worker is now implemented as Lambda function in ComputeStack
    this.ecrRepository = new ecr.Repository(this, 'WorkerRepository', {
      repositoryName: 'leadmagnet/worker',
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
        },
      ],
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      exportName: 'WorkerEcrRepositoryUri',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryName', {
      value: this.ecrRepository.repositoryName,
      exportName: 'WorkerEcrRepositoryName',
    });
  }
}

