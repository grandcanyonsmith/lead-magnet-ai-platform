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
        logger.info("[ImageArtifactService] Starting to store image artifacts", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'step_index': step_index,
            'step_name': step_name,
            'image_urls_count': len(image_urls) if image_urls else 0,
            'image_urls': image_urls,
            'image_urls_type': type(image_urls).__name__
        })
        
        image_artifact_ids = []
        
        if not image_urls:
            logger.warning("[ImageArtifactService] No image URLs provided", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name
            })
            return image_artifact_ids
        
        for idx, image_url in enumerate(image_urls):
            logger.info(f"[ImageArtifactService] Processing image URL {idx + 1}/{len(image_urls)}", extra={
                'job_id': job_id,
                'step_index': step_index,
                'step_name': step_name,
                'image_index': idx,
                'image_url': image_url,
                'image_url_length': len(image_url) if image_url else 0,
                'image_url_is_empty': not image_url or image_url.strip() == ''
            })
            
            if not image_url:
                logger.warning(f"[ImageArtifactService] Skipping empty image URL at index {idx}", extra={
                    'job_id': job_id,
                    'step_index': step_index,
                    'step_name': step_name,
                    'image_index': idx
                })
                continue
                
            try:
                # Extract filename from URL or generate one
                filename_match = re.search(r'/([^/?]+\.(png|jpg|jpeg))', image_url)
                if filename_match:
                    filename = filename_match.group(1)
                    logger.debug(f"[ImageArtifactService] Extracted filename from URL", extra={
                        'job_id': job_id,
                        'step_index': step_index,
                        'step_name': step_name,
                        'image_index': idx,
                        'filename': filename
                    })
                else:
                    filename = f"image_{step_index + 1}_{idx + 1}.png"
                    logger.debug(f"[ImageArtifactService] Generated filename", extra={
                        'job_id': job_id,
                        'step_index': step_index,
                        'step_name': step_name,
                        'image_index': idx,
                        'filename': filename
                    })
                
                logger.info(f"[ImageArtifactService] Storing image artifact", extra={
                    'job_id': job_id,
                    'step_index': step_index,
                    'step_name': step_name,
                    'image_index': idx,
                    'image_url': image_url,
                    'filename': filename
                })
                
                image_artifact_id = self.artifact_service.store_image_artifact(
                    tenant_id=tenant_id,
                    job_id=job_id,
                    image_url=image_url,
                    filename=filename
                )
                
                image_artifact_ids.append(image_artifact_id)
                logger.info(
                    f"[ImageArtifactService] Successfully stored image artifact",
                    extra={
                        'job_id': job_id,
                        'tenant_id': tenant_id,
                        'step_index': step_index,
                        'step_name': step_name,
                        'image_index': idx,
                        'image_artifact_id': image_artifact_id,
                        'image_url': image_url,
                        'filename': filename,
                        'total_stored': len(image_artifact_ids)
                    }
                )
            except Exception as e:
                logger.error(
                    f"[ImageArtifactService] Failed to store image artifact",
                    extra={
                        'job_id': job_id,
                        'tenant_id': tenant_id,
                        'step_index': step_index,
                        'step_name': step_name,
                        'image_index': idx,
                        'image_url': image_url,
                        'error_type': type(e).__name__,
                        'error_message': str(e)
                    },
                    exc_info=True
                )
        
        logger.info("[ImageArtifactService] Finished storing image artifacts", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'step_index': step_index,
            'step_name': step_name,
            'input_image_urls_count': len(image_urls),
            'successful_artifact_ids_count': len(image_artifact_ids),
            'image_artifact_ids': image_artifact_ids
        })
        
        return image_artifact_ids

