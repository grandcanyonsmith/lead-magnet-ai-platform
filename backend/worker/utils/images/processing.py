import logging
import base64
import io
from typing import Tuple, Optional, Any, Dict
from io import BytesIO

logger = logging.getLogger(__name__)

try:
    from PIL import Image, ImageDraw
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("[Image Utils] PIL/Pillow not available - image validation and optimization disabled")

# Constants
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
MAX_IMAGE_WIDTH_PX = 2048  # Maximum width before resizing

def validate_image_size(image_bytes: bytes, job_id: Optional[str] = None, tenant_id: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """
    Validate image size against maximum limit.
    
    Args:
        image_bytes: Image bytes to validate
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    image_size = len(image_bytes)
    
    if image_size > MAX_IMAGE_SIZE_BYTES:
        size_mb = image_size / (1024 * 1024)
        max_mb = MAX_IMAGE_SIZE_BYTES / (1024 * 1024)
        error_msg = f"Image size {size_mb:.2f}MB exceeds maximum {max_mb}MB"
        logger.warning(f"[Image Utils] {error_msg}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'image_size_bytes': image_size,
            'max_size_bytes': MAX_IMAGE_SIZE_BYTES
        })
        return False, error_msg
    
    if image_size > MAX_IMAGE_SIZE_BYTES * 0.8:  # Warn if > 80% of max
        size_mb = image_size / (1024 * 1024)
        logger.warning("[Image Utils] Large image detected, may need optimization", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'image_size_bytes': image_size,
            'size_mb': size_mb
        })
    
    return True, None


def validate_image_format(image_bytes: bytes, job_id: Optional[str] = None, tenant_id: Optional[str] = None) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Validate that bytes are actually a valid image format.
    
    Args:
        image_bytes: Image bytes to validate
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Tuple of (is_valid, mime_type, error_message)
    """
    if not PIL_AVAILABLE:
        # Without PIL, we can't validate format - return True but unknown type
        return True, None, None
    
    if not image_bytes or len(image_bytes) == 0:
        return False, None, "Image bytes are empty"
    
    try:
        # Try to open image with PIL
        img = Image.open(BytesIO(image_bytes))
        img.verify()  # Verify it's a valid image
        
        # Get format
        img_format = img.format
        if img_format:
            mime_type = f"image/{img_format.lower()}"
        else:
            mime_type = None
        
        return True, mime_type, None
    except Exception as e:
        error_msg = f"Invalid image format: {str(e)}"
        logger.warning(f"[Image Utils] {error_msg}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'error': str(e),
            'image_size_bytes': len(image_bytes)
        })
        return False, None, error_msg


def optimize_image(image_bytes: bytes, content_type: str, job_id: Optional[str] = None, tenant_id: Optional[str] = None) -> Tuple[bytes, str]:
    """
    Optimize image by resizing and compressing if needed.
    
    Args:
        image_bytes: Original image bytes
        content_type: MIME type of the image
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Tuple of (optimized_bytes, new_content_type)
    """
    if not PIL_AVAILABLE:
        return image_bytes, content_type
    
    try:
        img = Image.open(BytesIO(image_bytes))
        original_format = img.format
        original_size = len(image_bytes)
        original_width = img.width
        original_height = img.height
        
        # Resize if width exceeds maximum
        if img.width > MAX_IMAGE_WIDTH_PX:
            ratio = MAX_IMAGE_WIDTH_PX / img.width
            new_height = int(img.height * ratio)
            img = img.resize((MAX_IMAGE_WIDTH_PX, new_height), Image.Resampling.LANCZOS)
            logger.info("[Image Utils] Resized image", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'original_size': (original_width, original_height),
                'new_size': (MAX_IMAGE_WIDTH_PX, new_height)
            })
        
        # Optimize based on format
        output = BytesIO()
        
        if content_type in ('image/jpeg', 'image/jpg'):
            # Compress JPEG
            img.save(output, format='JPEG', quality=85, optimize=True)
            new_content_type = 'image/jpeg'
        elif content_type == 'image/webp':
            # Compress WebP
            img.save(output, format='WebP', quality=85, method=6)
            new_content_type = 'image/webp'
        elif content_type == 'image/png':
            # For large PNGs, consider converting to JPEG if appropriate
            if original_size > 2 * 1024 * 1024 and not img.mode in ('RGBA', 'LA', 'P'):
                # Convert large non-transparent PNGs to JPEG
                if img.mode == 'RGBA':
                    # Create white background
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
                    img = background
                img.save(output, format='JPEG', quality=85, optimize=True)
                new_content_type = 'image/jpeg'
                logger.info("[Image Utils] Converted large PNG to JPEG", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'original_size_bytes': original_size
                })
            else:
                # Optimize PNG
                img.save(output, format='PNG', optimize=True)
                new_content_type = 'image/png'
        else:
            # Keep original format
            img.save(output, format=original_format or 'PNG')
            new_content_type = content_type
        
        optimized_bytes = output.getvalue()
        optimized_size = len(optimized_bytes)
        
        if optimized_size < original_size:
            reduction_pct = (1 - optimized_size / original_size) * 100
            logger.info("[Image Utils] Image optimized", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'original_size_bytes': original_size,
                'optimized_size_bytes': optimized_size,
                'reduction_percent': reduction_pct
            })
        
        return optimized_bytes, new_content_type
    except Exception as e:
        logger.warning("[Image Utils] Failed to optimize image, using original", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'error': str(e)
        })
        return image_bytes, content_type


def add_overlay_to_screenshot(screenshot_b64: str, action: Dict[str, Any]) -> str:
    """
    Adds visual overlay to screenshot based on action (e.g. click marker).
    Returns base64 string of modified image.
    """
    if not PIL_AVAILABLE or not screenshot_b64:
        return screenshot_b64

    try:
        # Decode
        img_data = base64.b64decode(screenshot_b64)
        img = Image.open(io.BytesIO(img_data)).convert("RGBA")
        draw = ImageDraw.Draw(img, "RGBA")
        
        action_type = action.get("type")
        x = action.get("x")
        y = action.get("y")
        
        # Helper to draw a crosshair or circle
        def draw_marker(cx, cy, color="red", size=20):
            # Circle
            draw.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), outline=color, width=3)
            # Crosshair
            draw.line((cx - 15, cy, cx + 15, cy), fill=color, width=2)
            draw.line((cx, cy - 15, cx, cy + 15), fill=color, width=2)

        if action_type in ("click", "double_click") and x is not None and y is not None:
            draw_marker(x, y, color="#ff0000") # Red for click
            
        elif action_type in ("move", "hover") and x is not None and y is not None:
            draw_marker(x, y, color="#0000ff") # Blue for move
            
        elif action_type in ("drag", "drag_and_drop"):
            sx = sy = tx = ty = None
            path = action.get("path")
            if isinstance(path, (list, tuple)) and len(path) >= 2:
                p0 = path[0]
                p1 = path[-1]
                if isinstance(p0, dict) and isinstance(p1, dict):
                    sx, sy = p0.get("x"), p0.get("y")
                    tx, ty = p1.get("x"), p1.get("y")
            else:
                sx = action.get("source_x") or action.get("start_x") or action.get("x")
                sy = action.get("source_y") or action.get("start_y") or action.get("y")
                tx = action.get("target_x") or action.get("end_x") or action.get("to_x") or action.get("x2")
                ty = action.get("target_y") or action.get("end_y") or action.get("to_y") or action.get("y2")

            if sx is not None and sy is not None and tx is not None and ty is not None:
                draw_marker(sx, sy, color="#00ff00")  # Green start
                draw_marker(tx, ty, color="#00ff00")  # Green end
                draw.line((sx, sy, tx, ty), fill="#00ff00", width=2)  # Line connecting
        
        elif action_type == "type":
            # Maybe draw a text box indicator at top?
            draw.rectangle((0, 0, img.width, 30), fill=(0, 0, 0, 128))
            text = f"Type: {str(action.get('text', ''))[:50]}"
            draw.text((10, 5), text, fill="white")

        # Convert back to base64
        buffered = io.BytesIO()
        img = img.convert("RGB") # Convert back to RGB for JPEG
        img.save(buffered, format="JPEG", quality=80)
        return base64.b64encode(buffered.getvalue()).decode("utf-8")
        
    except Exception as e:
        logger.warning(f"Failed to add overlay: {e}")
        return screenshot_b64
