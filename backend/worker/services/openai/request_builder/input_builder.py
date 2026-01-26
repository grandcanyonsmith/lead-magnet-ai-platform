import logging
from typing import List, Dict, Optional
from utils import image_utils

logger = logging.getLogger(__name__)

def build_input_text(context: str, previous_context: str = "") -> str:
    """
    Build input text for API call.
    
    Args:
        context: Current context
        previous_context: Previous step context
        
    Returns:
        Combined input text
    """
    if previous_context:
        return f"{previous_context}\n\n--- Current Step Context ---\n{context}"
    return context

def build_multimodal_input(
    input_text: str,
    previous_image_urls: List[str],
    job_id: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> List[Dict]:
    """
    Build multimodal input with text and images.
    Handles image deduplication and base64 conversion for problematic URLs.
    """
    # Build input as list of content items
    input_content = [
        {"type": "input_text", "text": input_text}
    ]
    
    deduplicated_urls = image_utils.deduplicate_image_urls(previous_image_urls, job_id=job_id, tenant_id=tenant_id)
    
    # Process image URLs - convert problematic ones to base64 upfront
    valid_image_urls = []
    skipped_count = 0
    converted_count = 0
    problematic_urls = []
    direct_urls = []
    
    # Separate problematic URLs from direct URLs
    for image_url in deduplicated_urls:
        if not image_url:  # Skip empty URLs
            skipped_count += 1
            continue
        
        # Skip cdn.openai.com URLs (they can be problematic and we can't download them)
        if 'cdn.openai.com' in image_url:
            skipped_count += 1
            logger.warning("[OpenAI Request Builder] Skipping potentially problematic image URL: cdn.openai.com", extra={
                'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                'reason': 'cdn.openai.com URLs may fail to download',
                'job_id': job_id,
                'tenant_id': tenant_id
            })
            continue
        
        # Check if URL is problematic - if so, convert to base64 upfront
        if image_utils.is_problematic_url(image_url):
            problematic_urls.append(image_url)
        else:
            direct_urls.append(image_url)
    
    # Convert problematic URLs concurrently if we have multiple
    if problematic_urls:
        if len(problematic_urls) > 1:
            # Use concurrent downloads for multiple problematic URLs
            logger.info("[OpenAI Request Builder] Converting multiple problematic URLs concurrently", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'problematic_urls_count': len(problematic_urls)
            })
        
        for idx, image_url in enumerate(problematic_urls):
            logger.info("[OpenAI Request Builder] Converting problematic URL to base64 upfront", extra={
                'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                'job_id': job_id,
                'tenant_id': tenant_id,
                'image_index': idx,
                'total_images': len(problematic_urls)
            })
            data_url = image_utils.download_image_and_convert_to_data_url(
                url=image_url,
                job_id=job_id,
                tenant_id=tenant_id,
                image_index=idx,
                total_images=len(problematic_urls)
            )
            if data_url:
                input_content.append({
                    "type": "input_image",
                    "image_url": data_url
                })
                valid_image_urls.append(image_url)  # Track original URL
                converted_count += 1
            else:
                skipped_count += 1
                logger.warning("[OpenAI Request Builder] Failed to convert problematic URL, skipping", extra={
                    'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'image_index': idx,
                    'total_images': len(problematic_urls)
                })
    
    # Add direct URLs (non-problematic) as-is
    for image_url in direct_urls:
        if not image_url:  # Skip empty URLs
            skipped_count += 1
            continue
        
        # Skip cdn.openai.com URLs (redundant check but safe)
        if 'cdn.openai.com' in image_url:
            skipped_count += 1
            continue
        
        # Add the image URL as-is
        valid_image_urls.append(image_url)
        input_content.append({
            "type": "input_image",
            "image_url": image_url
        })
    
    # Only use list format if we have valid image URLs
    if valid_image_urls:
        # OpenAI Responses API expects input as a list with role and content
        api_input = [
            {
                "role": "user",
                "content": input_content
            }
        ]
        
        logger.info("[OpenAI Request Builder] Building API params with previous image URLs", extra={
            'original_image_urls_count': len(previous_image_urls),
            'deduplicated_urls_count': len(deduplicated_urls),
            'valid_image_urls_count': len(valid_image_urls),
            'problematic_urls_count': len(problematic_urls),
            'direct_urls_count': len(direct_urls),
            'skipped_count': skipped_count,
            'converted_to_base64_count': converted_count,
            'input_content_items': len(input_content)
        })
        return api_input
    else:
        # No valid image URLs, fall back to string format
        logger.warning("[OpenAI Request Builder] No valid image URLs after filtering, using text-only input", extra={
            'original_count': len(previous_image_urls)
        })
        return input_text
