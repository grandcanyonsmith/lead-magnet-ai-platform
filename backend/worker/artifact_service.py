"""
Artifact Service
Handles artifact storage in S3 and DynamoDB.
"""

import logging
import os
import requests
from datetime import datetime
from typing import Dict, Any, Optional
try:
    from ulid import new as ulid
except ImportError:
    from ulid import ULID as ulid

from db_service import DynamoDBService
from s3_service import S3Service

logger = logging.getLogger(__name__)


class ArtifactService:
    """Service for storing and managing artifacts."""
    
    def __init__(self, db_service: DynamoDBService, s3_service: S3Service):
        self.db = db_service
        self.s3 = s3_service
    
    def store_artifact(
        self,
        tenant_id: str,
        job_id: str,
        artifact_type: str,
        content: str,
        filename: str,
        public: bool = True  # Default to True - all artifacts should be public
    ) -> str:
        """
        Store an artifact in S3 and DynamoDB.
        
        Args:
            tenant_id: Tenant ID
            job_id: Job ID
            artifact_type: Type of artifact (e.g., 'html_final', 'markdown_final')
            content: Content to store
            filename: Filename for the artifact
            public: Whether the artifact should be publicly accessible
            
        Returns:
            Artifact ID
        """
        content_size = len(content.encode('utf-8'))
        logger.info(f"[ArtifactService] Storing artifact", extra={
            'tenant_id': tenant_id,
            'job_id': job_id,
            'artifact_type': artifact_type,
            'artifact_filename': filename,
            'content_size_bytes': content_size,
            'public': public
        })
        
        # Generate artifact ID
        artifact_id = f"art_{ulid()}"
        
        # Upload to S3
        s3_key = f"{tenant_id}/jobs/{job_id}/{filename}"
        logger.debug(f"[ArtifactService] Uploading to S3", extra={
            'artifact_id': artifact_id,
            's3_key': s3_key,
            'content_size_bytes': content_size
        })
        
        s3_url, public_url = self.s3.upload_artifact(
            key=s3_key,
            content=content,
            content_type=self.get_content_type(filename),
            public=public
        )
        
        # Create artifact record
        # Always store public_url (either CloudFront URL or presigned URL) so artifacts are accessible
        artifact = {
            'artifact_id': artifact_id,
            'tenant_id': tenant_id,
            'job_id': job_id,
            'artifact_type': artifact_type,
            'artifact_name': filename,
            's3_key': s3_key,
            's3_url': s3_url,
            'public_url': public_url,  # Always store URL (CloudFront or presigned)
            'is_public': public,  # Flag to indicate if it's truly public vs presigned
            'file_size_bytes': content_size,
            'mime_type': self.get_content_type(filename),
            'created_at': datetime.utcnow().isoformat()
        }
        
        logger.debug(f"[ArtifactService] Creating artifact record in DynamoDB", extra={
            'artifact_id': artifact_id,
            'artifact_type': artifact_type
        })
        
        self.db.put_artifact(artifact)
        
        logger.info(f"[ArtifactService] Artifact stored successfully", extra={
            'artifact_id': artifact_id,
            'tenant_id': tenant_id,
            'job_id': job_id,
            'artifact_type': artifact_type,
            'artifact_filename': filename,
            's3_key': s3_key,
            'public_url_preview': public_url[:80] + '...' if len(public_url) > 80 else public_url,
            'content_size_bytes': content_size
        })
        
        # Share artifact with shared workflows (non-blocking)
        self._share_artifact_with_shared_workflows(artifact_id, job_id, tenant_id)
        
        return artifact_id
    
    def _share_artifact_with_shared_workflows(self, artifact_id: str, job_id: str, tenant_id: str):
        """
        Share artifact with shared workflows by calling the API endpoint.
        This is called asynchronously and failures are logged but don't affect artifact creation.
        """
        api_url = os.environ.get('API_URL') or os.environ.get('API_GATEWAY_URL')
        if not api_url:
            logger.debug("[ArtifactService] API_URL not configured, skipping artifact sharing")
            return
        
        try:
            # Call the internal API endpoint to share the artifact
            share_url = f"{api_url.rstrip('/')}/internal/workflow-sharing/share-artifact"
            response = requests.post(
                share_url,
                json={
                    'artifact_id': artifact_id,
                    'job_id': job_id,
                    'tenant_id': tenant_id,  # Pass tenant_id in body for internal calls
                },
                headers={
                    'Content-Type': 'application/json',
                },
                timeout=5  # Short timeout since this is non-critical
            )
            response.raise_for_status()
            logger.debug("[ArtifactService] Artifact sharing initiated", extra={
                'artifact_id': artifact_id,
                'job_id': job_id,
            })
        except Exception as e:
            # Log but don't fail - artifact sharing is non-critical
            logger.warning("[ArtifactService] Failed to share artifact with shared workflows", extra={
                'artifact_id': artifact_id,
                'job_id': job_id,
                'error_type': type(e).__name__,
                'error_message': str(e),
            })
    
    def get_content_type(self, filename: str) -> str:
        """
        Get MIME type from filename.
        
        Args:
            filename: Filename to determine content type for
            
        Returns:
            MIME type string
        """
        ext = filename.split('.')[-1].lower()
        types = {
            'html': 'text/html',
            'md': 'text/markdown',
            'txt': 'text/plain',
            'json': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
        }
        return types.get(ext, 'application/octet-stream')
    
    def store_image_artifact(
        self,
        tenant_id: str,
        job_id: str,
        image_url: str,
        filename: Optional[str] = None
    ) -> str:
        """
        Store an image artifact. Downloads from external URL if needed and uploads to S3.
        
        Args:
            tenant_id: Tenant ID
            job_id: Job ID
            image_url: URL of the image (can be external URL like OpenAI, or our CloudFront/S3 URL)
            filename: Optional filename (extracted from URL if not provided)
            
        Returns:
            Artifact ID
        """
        import requests
        from urllib.parse import urlparse
        
        # Check if URL is already in our S3 bucket
        # Direct S3 URL: https://bucket.s3.region.amazonaws.com/{s3_key}
        # CloudFront URL: https://domain/{s3_key}
        # Presigned URL: https://bucket.s3.amazonaws.com/{s3_key}?...
        s3_key = None
        is_external_url = True
        image_size = 0
        public_url = image_url  # Default to original URL
        
        # Check for direct S3 URL (bucket.s3.region.amazonaws.com)
        if f"{self.s3.bucket_name}.s3." in image_url and '.amazonaws.com/' in image_url:
            # Extract key from direct S3 URL
            parts = image_url.split('.amazonaws.com/')
            if len(parts) > 1:
                s3_key = parts[1].split('?')[0]  # Remove query params
                is_external_url = False
        elif self.s3.cloudfront_domain and self.s3.cloudfront_domain in image_url:
            # Already in our CloudFront - extract S3 key
            parts = image_url.split(f"{self.s3.cloudfront_domain}/")
            if len(parts) > 1:
                s3_key = parts[1].split('?')[0]  # Remove query params
                is_external_url = False
        elif '/images/' in image_url and (self.s3.cloudfront_domain in image_url or '.s3.amazonaws.com/' in image_url):
            # Extract key after /images/
            parts = image_url.split('/images/')
            if len(parts) > 1:
                s3_key = f"images/{parts[1].split('?')[0]}"  # Remove query params
                is_external_url = False
        elif '.s3.amazonaws.com/' in image_url:
            # Extract key from presigned URL or old format
            parts = image_url.split('.s3.amazonaws.com/')
            if len(parts) > 1:
                s3_key = parts[1].split('?')[0]  # Remove query params
                is_external_url = False
        
        # If it's an external URL (like OpenAI), download and upload to S3
        if is_external_url:
            logger.info(f"[ArtifactService] Downloading image from external URL", extra={
                'image_url_preview': image_url[:80] + '...' if len(image_url) > 80 else image_url,
                'tenant_id': tenant_id,
                'job_id': job_id
            })
            
            try:
                # Download image from external URL
                response = requests.get(image_url, timeout=30)
                response.raise_for_status()
                image_data = response.content
                image_size = len(image_data)
                
                # Determine content type from response headers or filename
                content_type = response.headers.get('Content-Type', 'image/png')
                if not content_type.startswith('image/'):
                    # Fallback to content type from filename or default to PNG
                    if filename:
                        content_type = self.get_content_type(filename)
                    else:
                        content_type = 'image/png'
                
                # Generate filename if not provided
                if not filename:
                    # Try to extract from URL
                    parsed_url = urlparse(image_url)
                    url_filename = parsed_url.path.split('/')[-1]
                    if url_filename and '.' in url_filename:
                        filename = url_filename
                    else:
                        import time
                        # Determine extension from content type
                        ext = 'png'
                        if 'jpeg' in content_type or 'jpg' in content_type:
                            ext = 'jpg'
                        elif 'png' in content_type:
                            ext = 'png'
                        filename = f"image_{int(time.time())}_{str(ulid())[:8]}.{ext}"
                
                # Generate S3 key
                s3_key = f"{tenant_id}/jobs/{job_id}/{filename}"
                
                # Upload to S3
                logger.info(f"[ArtifactService] Uploading image to S3", extra={
                    's3_key': s3_key,
                    'image_size_bytes': image_size,
                    'content_type': content_type
                })
                
                s3_url, public_url = self.s3.upload_image(
                    key=s3_key,
                    image_data=image_data,
                    content_type=content_type,
                    public=True  # Images are always public (prefer CloudFront when configured)
                )
                
                # public_url is:
                # - CloudFront/custom CDN URL when CLOUDFRONT_DOMAIN is configured (recommended)
                # - otherwise, a direct S3 public URL (permanent, non-expiring)
                
                logger.info(f"[ArtifactService] Image downloaded and uploaded to S3", extra={
                    's3_key': s3_key,
                    'public_url_preview': public_url[:80] + '...' if len(public_url) > 80 else public_url,
                    'image_size_bytes': image_size
                })
                
            except Exception as e:
                logger.error(f"[ArtifactService] Failed to download/upload image from external URL: {e}", exc_info=True)
                raise Exception(f"Failed to download and store image from URL: {e}")
        else:
            # Image is already in our S3, just create artifact record
            if not s3_key:
                # Fallback: use filename or generate one
                if filename:
                    s3_key = f"{tenant_id}/jobs/{job_id}/{filename}"
                else:
                    import time
                    filename = f"image-{int(time.time())}-{str(ulid())[:8]}.png"
                    s3_key = f"{tenant_id}/jobs/{job_id}/{filename}"
            elif not filename:
                # Extract filename from s3_key
                filename = s3_key.split('/')[-1]
            
            # Use the provided image_url as public_url (it's already our direct S3 URL)
            public_url = image_url
        
        # Generate artifact ID
        artifact_id = f"art_{ulid()}"
        
        # Determine content type from filename
        content_type = self.get_content_type(filename)
        
        # Get file size (set during download if external URL)
        file_size = image_size
        
        # Create artifact record
        artifact = {
            'artifact_id': artifact_id,
            'tenant_id': tenant_id,
            'job_id': job_id,
            'artifact_type': 'image',
            'artifact_name': filename,
            's3_key': s3_key,
            's3_url': f"s3://{self.s3.bucket_name}/{s3_key}",
            'public_url': public_url,
            'is_public': True,
            'file_size_bytes': file_size,
            'mime_type': content_type,
            'created_at': datetime.utcnow().isoformat()
        }
        
        self.db.put_artifact(artifact)
        
        logger.info(f"[ArtifactService] Image artifact stored successfully", extra={
            'artifact_id': artifact_id,
            'tenant_id': tenant_id,
            'job_id': job_id,
            's3_key': s3_key,
            'public_url_preview': public_url[:80] + '...' if len(public_url) > 80 else public_url,
            'file_size_bytes': file_size,
            'is_external_url': is_external_url
        })
        
        self.db.put_artifact(artifact)
        
        logger.info(f"[ArtifactService] Image artifact stored successfully", extra={
            'artifact_id': artifact_id,
            'artifact_filename': filename,
            's3_key': s3_key
        })
        
        # Share artifact with shared workflows (non-blocking)
        self._share_artifact_with_shared_workflows(artifact_id, job_id, tenant_id)
        
        return artifact_id
    
    def get_artifact_public_url(self, artifact_id: str) -> str:
        """
        Get public URL for an artifact.
        
        Args:
            artifact_id: Artifact ID
            
        Returns:
            Public URL string
            
        Raises:
            ValueError: If artifact not found or has no public URL
        """
        artifact = self.db.get_artifact(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found")
        
        public_url = artifact.get('public_url')
        if not public_url:
            raise ValueError(f"Artifact {artifact_id} has no public_url")
        
        return public_url

