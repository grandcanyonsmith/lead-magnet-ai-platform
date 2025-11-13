"""
Image Artifact Service
Handles storage of image artifacts from AI-generated content.
"""

import logging
import re
from typing import Dict, Any, List, Optional

from artifact_service import ArtifactService

logger = logging.getLogger(__name__)


class ImageArtifactService:
    """Service for storing image artifacts."""
    
    def __init__(self, artifact_service: ArtifactService):
        """
        Initialize image artifact service.
        
        Args:
            artifact_service: Artifact service instance
        """
        self.artifact_service = artifact_service
    
    def store_image_artifacts(
        self,
        image_urls: List[str],
        tenant_id: str,
        job_id: str,
        step_index: int,
        step_name: str = ''
    ) -> List[str]:
        """
        Store multiple image artifacts from image URLs.
        
        Args:
            image_urls: List of image URLs to store
            tenant_id: Tenant ID
            job_id: Job ID
            step_index: Step index (0-based) for filename generation
            step_name: Optional step name for logging
            
        Returns:
            List of artifact IDs for successfully stored images
        """
        image_artifact_ids = []
        
        for idx, image_url in enumerate(image_urls):
            if not image_url:
                continue
                
            try:
                # Extract filename from URL or generate one
                filename_match = re.search(r'/([^/?]+\.(png|jpg|jpeg))', image_url)
                if filename_match:
                    filename = filename_match.group(1)
                else:
                    filename = f"image_{step_index + 1}_{idx + 1}.png"
                
                image_artifact_id = self.artifact_service.store_image_artifact(
                    tenant_id=tenant_id,
                    job_id=job_id,
                    image_url=image_url,
                    filename=filename
                )
                image_artifact_ids.append(image_artifact_id)
                logger.info(
                    f"Stored image artifact: {image_artifact_id} for URL: {image_url[:80]}...",
                    extra={
                        'step_index': step_index,
                        'step_name': step_name,
                        'image_index': idx
                    }
                )
            except Exception as e:
                logger.warning(
                    f"Failed to store image artifact for URL {image_url[:80]}...: {e}",
                    extra={
                        'step_index': step_index,
                        'step_name': step_name,
                        'image_index': idx,
                        'error_type': type(e).__name__,
                        'error_message': str(e)
                    },
                    exc_info=True
                )
        
        return image_artifact_ids

