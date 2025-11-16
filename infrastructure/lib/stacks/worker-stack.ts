import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import { RESOURCE_PREFIXES, ECR_CONFIG } from '../config/constants';

/**
 * Props for WorkerStack
 * 
 * Note: This stack only creates an ECR repository for container images.
 * The actual worker Lambda function is deployed in ComputeStack using
 * container images from this ECR repository. This separation allows
 * the ECR repository to be created independently and reused.
 */
export interface WorkerStackProps extends cdk.StackProps {
  // No additional props needed - ECR repository is standalone
}

/**
 * Worker Stack
 * 
 * Creates an ECR repository for storing Lambda container images.
 * Container images are required for the job processor Lambda function
 * because it uses Playwright, which requires GLIBC compatibility that
 * is only available in container images (not zip deployments).
 * 
 * The ECR repository is used by ComputeStack to deploy the job processor
 * Lambda function as a container image.
 */
export class WorkerStack extends cdk.Stack {
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props?: WorkerStackProps) {
    super(scope, id, props);

    /**
     * ECR Repository for Lambda container images
     * 
     * This repository stores container images used by the job processor
     * Lambda function. Container images are required because:
     * 1. Playwright requires GLIBC compatibility
     * 2. Container images provide a consistent runtime environment
     * 3. Allows bundling of system dependencies
     */
    this.ecrRepository = new ecr.Repository(this, 'WorkerRepository', {
      repositoryName: RESOURCE_PREFIXES.ECR_REPOSITORY,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          description: `Keep last ${ECR_CONFIG.MAX_IMAGE_COUNT} images`,
          maxImageCount: ECR_CONFIG.MAX_IMAGE_COUNT,
        },
      ],
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      exportName: 'WorkerEcrRepositoryUri',
      description: 'ECR repository URI for pushing container images',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryName', {
      value: this.ecrRepository.repositoryName,
      exportName: 'WorkerEcrRepositoryName',
      description: 'ECR repository name',
    });
  }
}

