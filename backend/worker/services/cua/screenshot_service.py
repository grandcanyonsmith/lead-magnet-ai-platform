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

    def upload_screenshot(self, base64_data: str, content_type: str = "image/jpeg", tenant_id: Optional[str] = None, job_id: Optional[str] = None) -> Optional[str]:
        try:
            image_bytes = base64.b64decode(base64_data)
            # Determine file extension from content type
            ext = 'jpg' if 'jpeg' in content_type.lower() else 'png'
            filename = f"screenshot-{int(time.time())}-{str(uuid.uuid4())[:8]}.{ext}"
            
            if tenant_id and job_id:
                key = f"{tenant_id}/jobs/{job_id}/screenshots/{filename}"
            else:
                key = f"screenshots/{filename}"

            _, public_url = self.s3_service.upload_image(
                key=key,
                image_data=image_bytes,
                content_type=content_type,
                public=True
            )
            return public_url
        except Exception as e:
            logger.error(f"Failed to upload screenshot: {e}")
            return None

    # Backwards-compatible adapter for CUAgent (matches ImageHandler signature used elsewhere)
    def upload_base64_image_to_s3(
        self,
        image_b64: str,
        content_type: str = "image/jpeg",
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
        **_kwargs,
    ) -> Optional[str]:
        return self.upload_screenshot(image_b64, content_type=content_type, tenant_id=tenant_id, job_id=job_id)

