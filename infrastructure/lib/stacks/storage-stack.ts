import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { getResourcePrefixes, S3_CONFIG, CLOUDFRONT_CONFIG } from '../config/constants';

/**
 * Creates bucket policy statements for public read access to image files
 * 
 * Images are stored at paths like: {tenant_id}/jobs/{job_id}/*.png, *.jpg, etc.
 * This function creates policy statements for different path depths to allow
 * public read access to image files at various nesting levels.
 * 
 * @param bucketArn - ARN of the S3 bucket
 * @returns Array of IAM policy statements for public image access
 */
function createImagePublicReadPolicyStatements(bucketArn: string): iam.PolicyStatement[] {
  const statements: iam.PolicyStatement[] = [];

  // Create policy statements for each image extension and path depth combination
  S3_CONFIG.IMAGE_EXTENSIONS.forEach(ext => {
    S3_CONFIG.PATH_DEPTHS.forEach((depth, level) => {
      statements.push(
        new iam.PolicyStatement({
          sid: `PublicReadGetObjectForImages_${ext}_level${level}`,
          effect: iam.Effect.ALLOW,
          principals: [new iam.AnyPrincipal()],
          actions: ['s3:GetObject'],
          resources: [`${bucketArn}${depth}/*.${ext}`],
        })
      );
    });
  });

  return statements;
}

/**
 * Storage Stack
 * 
 * Creates S3 bucket for artifacts and CloudFront distribution for CDN.
 * The bucket allows public read access to image files while keeping other
 * files private. CloudFront provides fast global content delivery.
 */
export class StorageStack extends cdk.Stack {
  public readonly artifactsBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const RESOURCE_PREFIXES = getResourcePrefixes();

    // S3 Bucket for artifacts
    this.artifactsBucket = new s3.Bucket(this, 'ArtifactsBucket', {
      bucketName: `${RESOURCE_PREFIXES.BUCKET}-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false, // Allow public ACLs for images
        blockPublicPolicy: false, // Allow public policy
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      publicReadAccess: false, // We'll use bucket policy for specific paths
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          id: 'transition-to-ia',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(S3_CONFIG.TRANSITION_TO_IA_DAYS),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'OAI',
      {
        comment: 'OAI for artifacts bucket',
      }
    );

    // Grant read access to CloudFront
    this.artifactsBucket.grantRead(originAccessIdentity);

    // Add bucket policy for public read access to image files
    // This allows images to be accessed directly via S3 URLs or CloudFront
    const imagePolicyStatements = createImagePublicReadPolicyStatements(
      this.artifactsBucket.bucketArn
    );
    imagePolicyStatements.forEach(statement => {
      this.artifactsBucket.addToResourcePolicy(statement);
    });

    // CloudFront Distribution
    // Default behavior: serve both frontend and artifacts from root
    // Artifacts are stored at {tenant_id}/jobs/{job_id}/* paths
    // Frontend files are at root level (index.html, _next/, etc.)
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.artifactsBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(CLOUDFRONT_CONFIG.ERROR_RESPONSE_TTL_MINUTES),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(CLOUDFRONT_CONFIG.ERROR_RESPONSE_TTL_MINUTES),
        },
      ],
      priceClass: cloudfront.PriceClass[CLOUDFRONT_CONFIG.PRICE_CLASS as keyof typeof cloudfront.PriceClass],
      enabled: true,
      comment: 'Lead Magnet Artifacts CDN',
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'ArtifactsBucketName', {
      value: this.artifactsBucket.bucketName,
      exportName: 'ArtifactsBucketName',
      description: 'S3 bucket name for storing artifacts',
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      exportName: 'DistributionDomainName',
      description: 'CloudFront distribution domain name',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      exportName: 'DistributionId',
      description: 'CloudFront distribution ID',
    });
  }
}

