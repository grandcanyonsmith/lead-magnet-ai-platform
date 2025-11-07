"""
Artifact Service
Handles artifact storage in S3 and DynamoDB.
"""

import logging
from datetime import datetime
from typing import Dict, Any
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
        public: bool = False
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
        # Generate artifact ID
        artifact_id = f"art_{ulid()}"
        
        # Upload to S3
        s3_key = f"{tenant_id}/jobs/{job_id}/{filename}"
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
            'file_size_bytes': len(content.encode('utf-8')),
            'mime_type': self.get_content_type(filename),
            'created_at': datetime.utcnow().isoformat()
        }
        
        self.db.put_artifact(artifact)
        
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

