"""
Artifact Service
Handles artifact storage in S3 and DynamoDB.
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional
from ulid import new as ulid

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
            'filename': filename,
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
            'filename': filename,
            's3_key': s3_key,
            'public_url_preview': public_url[:80] + '...' if len(public_url) > 80 else public_url,
            'content_size_bytes': content_size
        })
        
        return artifact_id
    
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
        Store an image artifact that's already uploaded to S3.
        
        Args:
            tenant_id: Tenant ID
            job_id: Job ID
            image_url: Public URL of the image (CloudFront or presigned URL)
            filename: Optional filename (extracted from URL if not provided)
            
        Returns:
            Artifact ID
        """
        # Extract S3 key from URL
        # CloudFront URL: https://domain/{s3_key}
        # Presigned URL: https://bucket.s3.amazonaws.com/{s3_key}?...
        s3_key = None
        if '/images/' in image_url:
            # Extract key after /images/
            parts = image_url.split('/images/')
            if len(parts) > 1:
                s3_key = f"images/{parts[1].split('?')[0]}"  # Remove query params
        elif '.s3.amazonaws.com/' in image_url:
            # Extract key from presigned URL
            parts = image_url.split('.s3.amazonaws.com/')
            if len(parts) > 1:
                s3_key = parts[1].split('?')[0]  # Remove query params
        
        if not s3_key:
            # Fallback: use filename or generate one
            if filename:
                s3_key = f"{tenant_id}/jobs/{job_id}/{filename}"
            else:
                import time
                from ulid import new as ulid
                filename = f"image-{int(time.time())}-{str(ulid())[:8]}.png"
                s3_key = f"{tenant_id}/jobs/{job_id}/{filename}"
        elif not filename:
            # Extract filename from s3_key
            filename = s3_key.split('/')[-1]
        
        # Generate artifact ID
        artifact_id = f"art_{ulid()}"
        
        # Determine content type from filename
        content_type = self.get_content_type(filename)
        
        # Create artifact record (image already in S3, just create DB record)
        artifact = {
            'artifact_id': artifact_id,
            'tenant_id': tenant_id,
            'job_id': job_id,
            'artifact_type': 'image',
            'artifact_name': filename,
            's3_key': s3_key,
            's3_url': f"s3://{self.s3.bucket_name}/{s3_key}",
            'public_url': image_url,
            'is_public': True,
            'file_size_bytes': 0,  # Size unknown without downloading
            'mime_type': content_type,
            'created_at': datetime.utcnow().isoformat()
        }
        
        logger.info(f"[ArtifactService] Storing image artifact", extra={
            'artifact_id': artifact_id,
            'tenant_id': tenant_id,
            'job_id': job_id,
            's3_key': s3_key,
            'public_url_preview': image_url[:80] + '...' if len(image_url) > 80 else image_url
        })
        
        self.db.put_artifact(artifact)
        
        logger.info(f"[ArtifactService] Image artifact stored successfully", extra={
            'artifact_id': artifact_id,
            'filename': filename
        })
        
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

