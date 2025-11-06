"""
S3 Service
Handles all S3 operations for the worker.
"""

import os
import logging
from typing import Tuple
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class S3Service:
    """Service for S3 operations."""
    
    def __init__(self):
        """Initialize S3 client."""
        self.s3_client = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        self.bucket_name = os.environ['ARTIFACTS_BUCKET']
        # CloudFront distribution domain (optional, falls back to presigned URLs)
        cloudfront_domain = os.environ.get('CLOUDFRONT_DOMAIN', '').strip()
        self.cloudfront_domain = cloudfront_domain if cloudfront_domain else None
    
    def upload_artifact(
        self,
        key: str,
        content: str,
        content_type: str = 'text/html',
        public: bool = False
    ) -> Tuple[str, str]:
        """
        Upload artifact to S3.
        
        Args:
            key: S3 object key
            content: Content to upload
            content_type: MIME type
            public: Whether to make object publicly accessible
            
        Returns:
            Tuple of (s3_url, public_url)
        """
        try:
            # Prepare upload parameters
            put_params = {
                'Bucket': self.bucket_name,
                'Key': key,
                'Body': content.encode('utf-8'),
                'ContentType': content_type,
            }
            
            # Note: We don't set ACL='public-read' because the bucket blocks public ACLs.
            # Public access is handled via CloudFront distribution.
            
            # Upload to S3
            self.s3_client.put_object(**put_params)
            
            # Generate URLs
            s3_url = f"s3://{self.bucket_name}/{key}"
            
            if public and self.cloudfront_domain:
                # Use CloudFront URL for public access (recommended)
                public_url = f"https://{self.cloudfront_domain}/{key}"
                logger.info(f"Using CloudFront URL for public artifact: {public_url}")
            else:
                # Generate presigned URL (valid for 1 year to prevent expiration issues)
                # Presigned URLs work regardless of ACL settings
                # Note: API will refresh these URLs on access, but longer expiration provides better UX
                public_url = self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket_name, 'Key': key},
                    ExpiresIn=31536000  # 1 year (31536000 seconds)
                )
                if public:
                    logger.warning(f"CloudFront domain not configured, using presigned URL instead")
            
            logger.info(f"Uploaded artifact to S3: {s3_url}, public_url: {public_url[:80]}...")
            return s3_url, public_url
            
        except ClientError as e:
            logger.error(f"Error uploading to S3: {e}")
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

