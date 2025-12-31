import base64
import logging
from typing import Optional
from s3_service import S3Service
import uuid
import time

logger = logging.getLogger(__name__)

class S3ScreenshotService:
    def __init__(self, s3_service: S3Service):
        self.s3_service = s3_service

    def upload_screenshot(self, base64_data: str, tenant_id: Optional[str] = None, job_id: Optional[str] = None) -> Optional[str]:
        try:
            image_bytes = base64.b64decode(base64_data)
            filename = f"screenshot-{int(time.time())}-{str(uuid.uuid4())[:8]}.png"
            
            if tenant_id and job_id:
                key = f"{tenant_id}/jobs/{job_id}/screenshots/{filename}"
            else:
                key = f"screenshots/{filename}"

            # Assume s3_service.upload_image returns (s3_url, public_url)
            # or upload_file. Let's check s3_service.py for exact signature.
            # Based on ImageHandler, it uses upload_image.
            _, public_url = self.s3_service.upload_image(
                key=key,
                image_data=image_bytes,
                content_type='image/png',
                public=True
            )
            return public_url
        except Exception as e:
            logger.error(f"Failed to upload screenshot: {e}")
            return None

