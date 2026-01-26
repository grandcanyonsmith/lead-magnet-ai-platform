"""
S3 Service
Handles all S3 operations for the worker.
"""

import os
import logging
from typing import Tuple, Union
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class S3Service:
    """Service for S3 operations."""
    
    def __init__(self):
        """Initialize S3 client."""
        region = os.environ.get('AWS_REGION', 'us-east-1')
        bucket_name = os.environ['ARTIFACTS_BUCKET']
        cloudfront_domain = os.environ.get('CLOUDFRONT_DOMAIN', 'assets.mycoursecreator360.com').strip()
        
        # If CloudFront domain not set, try to retrieve from CloudFormation
        if not cloudfront_domain:
            try:
                cf_client = boto3.client('cloudformation', region_name=region)
                # Try to find the storage stack and get CloudFront domain
                stacks = cf_client.describe_stacks()
                for stack in stacks.get('Stacks', []):
                    if 'storage' in stack['StackName'].lower() or 'leadmagnet-storage' in stack['StackName'].lower():
                        for output in stack.get('Outputs', []):
                            if output.get('OutputKey') == 'DistributionDomainName':
                                cloudfront_domain = output.get('OutputValue', '').strip()
                                logger.info(f"[S3] Retrieved CloudFront domain from CloudFormation: {cloudfront_domain}")
                                break
                        if cloudfront_domain:
                            break
            except Exception as e:
                logger.debug(f"[S3] Could not retrieve CloudFront domain from CloudFormation: {e}")
        
        logger.info(f"[S3] Initializing S3 service", extra={
            'region': region,
            'bucket': bucket_name,
            'has_cloudfront': bool(cloudfront_domain)
        })
        
        self.s3_client = boto3.client('s3', region_name=region)
        self.bucket_name = bucket_name
        # CloudFront distribution domain (preferred for permanent, non-expiring URLs)
        self.cloudfront_domain = cloudfront_domain if cloudfront_domain else None
        
        logger.info(f"[S3] S3 service initialized successfully", extra={
            'bucket': self.bucket_name,
            'cloudfront_domain': self.cloudfront_domain or 'not configured'
        })
    
    def upload_artifact(
        self,
        key: str,
        content: Union[str, bytes],
        content_type: str = 'text/html',
        public: bool = False
    ) -> Tuple[str, str]:
        """
        Upload artifact to S3.
        
        Args:
            key: S3 object key
            content: Content to upload (string or bytes)
            content_type: MIME type
            public: Whether to make object publicly accessible
            
        Returns:
            Tuple of (s3_url, public_url)
        """
        if isinstance(content, bytes):
            body = content
            content_size = len(content)
        else:
            body = content.encode('utf-8')
            content_size = len(body)
        logger.info(f"[S3] Uploading artifact", extra={
            'key': key,
            'content_type': content_type,
            'content_size_bytes': content_size,
            'public': public,
            'bucket': self.bucket_name
        })
        
        try:
            # Prepare upload parameters
            put_params = {
                'Bucket': self.bucket_name,
                'Key': key,
                'Body': body,
                'ContentType': content_type,
            }
            
            # Note: We don't set ACL='public-read' because the bucket blocks public ACLs.
            # Public access is handled via CloudFront distribution.
            
            # Upload to S3
            logger.debug(f"[S3] Calling put_object", extra={'key': key, 'bucket': self.bucket_name})
            self.s3_client.put_object(**put_params)
            
            # Generate URLs
            s3_url = f"s3://{self.bucket_name}/{key}"
            
            if public and self.cloudfront_domain:
                # Use CloudFront URL for public access (recommended)
                public_url = f"https://{self.cloudfront_domain}/{key}"
                logger.info(f"[S3] Using CloudFront URL for public artifact", extra={
                    'key': key,
                    'public_url': public_url,
                    'cloudfront_domain': self.cloudfront_domain
                })
            else:
                # Generate presigned URL as fallback (max 7 days per AWS limits)
                # Note: CloudFront URLs should be preferred as they don't expire
                # Presigned URLs work regardless of ACL settings but will expire
                logger.debug(f"[S3] Generating presigned URL", extra={'key': key, 'expires_in': 604800})
                public_url = self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket_name, 'Key': key},
                    ExpiresIn=604800  # Maximum allowed: 7 days (604800 seconds)
                )
                if public:
                    logger.warning(f"[S3] CloudFront domain not configured, using presigned URL instead", extra={
                        'key': key,
                        'public_url_length': len(public_url)
                    })
            
            logger.info(f"[S3] Artifact uploaded successfully", extra={
                'key': key,
                's3_url': s3_url,
                'public_url_preview': public_url[:80] + '...' if len(public_url) > 80 else public_url,
                'content_size_bytes': content_size,
                'content_type': content_type
            })
            return s3_url, public_url
            
        except ClientError as e:
            logger.error(f"[S3] Error uploading artifact to S3", extra={
                'key': key,
                'bucket': self.bucket_name,
                'error_code': e.response.get('Error', {}).get('Code', 'Unknown'),
                'error_message': str(e),
                'content_size_bytes': content_size
            }, exc_info=True)
            raise
    
    def upload_image(
        self,
        key: str,
        image_data: bytes,
        content_type: str = 'image/png',
        public: bool = True
    ) -> Tuple[str, str]:
        """
        Upload image (binary data) to S3.
        
        Images are always uploaded as publicly accessible via CloudFront.
        CloudFront URLs are preferred as they never expire.
        
        Args:
            key: S3 object key
            image_data: Binary image data
            content_type: MIME type (e.g., 'image/png', 'image/jpeg')
            public: Whether to make object publicly accessible (always True for images)
            
        Returns:
            Tuple of (s3_url, public_url)
        """
        try:
            region = os.environ.get('AWS_REGION', 'us-east-1')
            # Images are always public - bucket policy allows public read access
            # Note: We don't set ACL='public-read' because the bucket blocks public ACLs.
            put_params = {
                'Bucket': self.bucket_name,
                'Key': key,
                'Body': image_data,
                'ContentType': content_type,
                # Ensure Cache-Control for images
                'CacheControl': 'public, max-age=31536000, immutable',
            }
            
            # Upload to S3
            self.s3_client.put_object(**put_params)
            
            # Generate URLs
            s3_url = f"s3://{self.bucket_name}/{key}"

            # Prefer CloudFront (or custom CDN hostname) when configured so customer-facing
            # URLs live on your branded assets domain (e.g. assets.mycoursecreator360.com).
            if public and self.cloudfront_domain:
                public_url = f"https://{self.cloudfront_domain}/{key}"
            else:
                # Fallback: direct S3 public URL
                # Format: https://{bucket}.s3.{region}.amazonaws.com/{key}
                # Determine correct region for bucket (cc360-pages is in us-west-2)
                bucket_region = "us-west-2" if self.bucket_name == "cc360-pages" else region
                public_url = f"https://{self.bucket_name}.s3.{bucket_region}.amazonaws.com/{key}"
            
            logger.info(f"[S3] Uploaded image to S3 with public access", extra={
                'key': key,
                's3_url': s3_url,
                'public_url': public_url,
                'bucket': self.bucket_name,
                'region': region,
                'content_type': content_type
            })
            return s3_url, public_url
        except ClientError as e:
            logger.error(f"[S3] Error uploading image to S3: {e}", exc_info=True)
            raise
    
    def download_artifact(self, key: str) -> str:
        """
        Download artifact from S3.
        
        Args:
            key: S3 object key
            
        Returns:
            Content as string
        """
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
            content = response['Body'].read().decode('utf-8')
            logger.debug(f"Downloaded artifact from S3: {key}")
            return content
        except ClientError as e:
            logger.error(f"Error downloading from S3: {e}")
            raise

