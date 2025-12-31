import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { RESOURCE_PREFIXES, S3_CONFIG, CLOUDFRONT_CONFIG } from './config/constants';

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

    // S3 Bucket for logs
    const logsBucket = new s3.Bucket(this, 'LogsBucket', {
      bucketName: `${RESOURCE_PREFIXES.BUCKET}-logs-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{ expiration: cdk.Duration.days(90) }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
    });

    // S3 Bucket for artifacts
    this.artifactsBucket = new s3.Bucket(this, 'ArtifactsBucket', {
      bucketName: `${RESOURCE_PREFIXES.BUCKET}-${this.account}`,
      serverAccessLogsBucket: logsBucket,
      serverAccessLogsPrefix: 'artifacts-bucket-logs/',
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
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

    // Optional WAFv2 for CloudFront (scope=CLOUDFRONT requires deployment in us-east-1)
    // This is primarily to blunt obvious bots scraping the dashboard/static assets.
    let cloudfrontWebAclArn: string | undefined;
    if (this.region === 'us-east-1') {
      const cloudfrontWebAcl = new wafv2.CfnWebACL(this, 'CloudFrontWebAcl', {
        scope: 'CLOUDFRONT',
        defaultAction: { allow: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
          metricName: 'leadmagnet-cloudfront-waf',
        },
        rules: [
          {
            name: 'AWSManagedRulesCommonRuleSet',
            priority: 0,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesCommonRuleSet',
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              sampledRequestsEnabled: true,
              metricName: 'aws-common',
            },
          },
          {
            name: 'AWSManagedRulesAmazonIpReputationList',
            priority: 1,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesAmazonIpReputationList',
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              sampledRequestsEnabled: true,
              metricName: 'aws-ip-reputation',
            },
          },
          {
            name: 'RateLimitStatic',
            priority: 2,
            action: { block: {} },
            statement: {
              rateBasedStatement: {
                aggregateKeyType: 'IP',
                limit: 20000,
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              sampledRequestsEnabled: true,
              metricName: 'rate-limit-static',
            },
          },
        ],
      });

      cloudfrontWebAclArn = cloudfrontWebAcl.attrArn;

      new cdk.CfnOutput(this, 'CloudFrontWebAclArn', {
        value: cloudfrontWebAcl.attrArn,
        exportName: 'CloudFrontWebAclArn',
        description: 'WAFv2 WebACL ARN associated with CloudFront (if created)',
      });
    }

    // CloudFront Distribution
    // Default behavior: serve both frontend and artifacts from root
    // Artifacts are stored at {tenant_id}/jobs/{job_id}/* paths
    // Frontend files are at root level (index.html, _next/, etc.)
    //
    // IMPORTANT (Next.js static export):
    // Next.js `output: 'export'` produces `.html` + `.txt` files for routes, and uses a placeholder `_`
    // for dynamic params in order to export at least one copy of the page (e.g. `dashboard/jobs/_.html`).
    // To support "clean URLs" like `/dashboard/jobs/<job_id>` on CloudFront+S3 origins (no directory index),
    // we attach a CloudFront Function to rewrite request URIs to the correct exported asset paths.
    const nextStaticRewriteFunction = new cloudfront.Function(this, 'NextStaticRewriteFunction', {
      comment: 'Rewrite clean URLs to Next.js static export assets (CloudFront+S3 origin)',
      code: cloudfront.FunctionCode.fromFile({
        filePath: path.join(__dirname, 'cloudfront-functions/next-rewrite.js'),
      }),
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      webAclId: cloudfrontWebAclArn,
      defaultBehavior: {
        origin: new origins.S3Origin(this.artifactsBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: nextStaticRewriteFunction,
          },
        ],
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
      enableLogging: true,
      logBucket: logsBucket,
      logFilePrefix: 'cloudfront-logs/',
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

