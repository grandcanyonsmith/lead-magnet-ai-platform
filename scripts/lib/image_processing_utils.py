#!/usr/bin/env python3
"""
Image Processing Utilities

This module provides utility functions for handling images:
- Downloading images from URLs
- Loading images from local file paths
- Encoding images for OpenAI API
- Processing images through OpenAI Responses API
- Uploading images to S3
- Cleaning up temporary files

All functions include extensive error handling and logging.

Example Usage:
    >>> from scripts.lib.image_processing_utils import (
    ...     download_image_from_url,
    ...     process_image_with_openai,
    ...     upload_image_to_s3,
    ...     cleanup_temp_files
    ... )
    >>> 
    >>> # Download and process an image from URL
    >>> image_bytes = download_image_from_url("https://example.com/image.png")
    >>> generated_bytes = process_image_with_openai(image_bytes)
    >>> s3_url, public_url = upload_image_to_s3(generated_bytes, "output.png")
    >>> print(f"Image available at: {public_url}")
"""

import os
import base64
import time
import logging
import requests
from typing import Tuple, Optional
from urllib.parse import urlparse
from botocore.exceptions import ClientError
from openai import OpenAI

# Import common utilities
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from lib.common import get_artifacts_bucket, get_aws_region, get_s3_client

logger = logging.getLogger(__name__)


def download_image_from_url(url: str, timeout: int = 30) -> bytes:
    """
    Download an image from a URL.
    
    Downloads an image from the provided URL and returns the raw image bytes.
    Handles HTTP errors, timeouts, and network issues gracefully.
    
    Args:
        url: The URL of the image to download. Must be a valid HTTP/HTTPS URL.
        timeout: Request timeout in seconds (default: 30).
        
    Returns:
        Raw image bytes as a bytes object.
        
    Raises:
        ValueError: If the URL is invalid or not an HTTP/HTTPS URL.
        requests.RequestException: If the download fails (network error, timeout, etc.).
        requests.HTTPError: If the server returns an error status code.
        
    Example:
        >>> image_bytes = download_image_from_url("https://example.com/image.png")
        >>> print(f"Downloaded {len(image_bytes)} bytes")
        Downloaded 12345 bytes
        
    Example with error handling:
        >>> try:
        ...     image_bytes = download_image_from_url("https://example.com/image.png")
        ... except requests.RequestException as e:
        ...     print(f"Failed to download image: {e}")
    """
    if not url or not isinstance(url, str):
        raise ValueError("URL must be a non-empty string")
    
    # Validate URL scheme
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        raise ValueError(f"URL must use HTTP or HTTPS scheme, got: {parsed.scheme}")
    
    logger.info(f"Downloading image from URL: {url[:80]}...")
    
    try:
        response = requests.get(url, timeout=timeout, stream=True)
        response.raise_for_status()
        
        # Read the content
        image_bytes = response.content
        image_size = len(image_bytes)
        
        if image_size == 0:
            raise ValueError("Downloaded image is empty")
        
        logger.info(f"Successfully downloaded image: {image_size} bytes")
        return image_bytes
        
    except requests.Timeout:
        logger.error(f"Timeout downloading image from {url} (timeout: {timeout}s)")
        raise requests.RequestException(f"Timeout downloading image from {url}")
    except requests.HTTPError as e:
        logger.error(f"HTTP error downloading image: {e.response.status_code} - {e}")
        raise
    except requests.RequestException as e:
        logger.error(f"Request error downloading image: {e}")
        raise


def load_image_from_path(file_path: str) -> bytes:
    """
    Load an image from a local file path.
    
    Reads an image file from the local filesystem and returns the raw image bytes.
    Handles path expansion (e.g., ~ for home directory) and validates file existence.
    
    Args:
        file_path: Path to the image file. Can use ~ for home directory expansion.
        
    Returns:
        Raw image bytes as a bytes object.
        
    Raises:
        FileNotFoundError: If the file does not exist.
        PermissionError: If the file cannot be read due to permissions.
        IOError: If there's an error reading the file.
        
    Example:
        >>> image_bytes = load_image_from_path("~/Downloads/image.png")
        >>> print(f"Loaded {len(image_bytes)} bytes")
        Loaded 12345 bytes
        
    Example with absolute path:
        >>> image_bytes = load_image_from_path("/Users/john/Pictures/photo.jpg")
    """
    if not file_path or not isinstance(file_path, str):
        raise ValueError("File path must be a non-empty string")
    
    # Expand user path (~)
    expanded_path = os.path.expanduser(file_path)
    
    # Convert to absolute path
    abs_path = os.path.abspath(expanded_path)
    
    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"Image file not found: {abs_path}")
    
    if not os.path.isfile(abs_path):
        raise ValueError(f"Path is not a file: {abs_path}")
    
    logger.info(f"Loading image from path: {abs_path}")
    
    try:
        with open(abs_path, "rb") as f:
            image_bytes = f.read()
        
        image_size = len(image_bytes)
        if image_size == 0:
            raise ValueError(f"Image file is empty: {abs_path}")
        
        logger.info(f"Successfully loaded image: {image_size} bytes")
        return image_bytes
        
    except PermissionError:
        logger.error(f"Permission denied reading file: {abs_path}")
        raise
    except IOError as e:
        logger.error(f"IO error reading file {abs_path}: {e}")
        raise


def encode_image_for_openai(image_bytes: bytes, mime_type: str = "image/png") -> str:
    """
    Encode an image as base64 for OpenAI API.
    
    Converts raw image bytes to a base64-encoded string suitable for use with
    OpenAI's Responses API. The resulting string can be used in data URLs.
    
    Args:
        image_bytes: Raw image bytes to encode.
        mime_type: MIME type of the image (default: "image/png").
                   Should be one of: image/png, image/jpeg, image/gif, image/webp.
        
    Returns:
        Base64-encoded string of the image.
        
    Raises:
        ValueError: If image_bytes is empty or mime_type is invalid.
        
    Example:
        >>> image_bytes = load_image_from_path("image.png")
        >>> b64_string = encode_image_for_openai(image_bytes, "image/png")
        >>> print(f"Encoded {len(b64_string)} characters")
        Encoded 16460 characters
        
    Example with data URL:
        >>> b64_string = encode_image_for_openai(image_bytes, "image/png")
        >>> data_url = f"data:image/png;base64,{b64_string}"
    """
    if not image_bytes or len(image_bytes) == 0:
        raise ValueError("Image bytes cannot be empty")
    
    # Validate MIME type
    valid_mime_types = ("image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp")
    if mime_type not in valid_mime_types:
        logger.warning(f"Unusual MIME type: {mime_type}. Valid types: {valid_mime_types}")
    
    logger.debug(f"Encoding image: {len(image_bytes)} bytes, MIME type: {mime_type}")
    
    try:
        b64_string = base64.b64encode(image_bytes).decode("utf-8")
        logger.debug(f"Encoded image: {len(b64_string)} characters")
        return b64_string
    except Exception as e:
        logger.error(f"Error encoding image: {e}")
        raise ValueError(f"Failed to encode image: {e}") from e


def process_image_with_openai(
    image_bytes: bytes,
    prompt: Optional[str] = None,
    model: str = "gpt-5",
    background: str = "transparent",
    quality: str = "high"
) -> bytes:
    """
    Process an image through OpenAI Responses API with image generation.
    
    Sends an image to OpenAI's Responses API with the image_generation tool
    to recreate or modify the image. The function handles the API call, response
    parsing, and extracts the generated image bytes.
    
    Args:
        image_bytes: Raw image bytes to process.
        prompt: Text prompt describing what to do with the image.
                Default: "Recreate this image exactly as a high-resolution transparent PNG."
        model: OpenAI model to use (default: "gpt-5").
        background: Background setting for image generation (default: "transparent").
                   Options: "transparent", "white", "black", etc.
        quality: Image quality setting (default: "high").
                Options: "high", "standard", etc.
        
    Returns:
        Generated PNG image bytes.
        
    Raises:
        ValueError: If image_bytes is empty or invalid.
        Exception: If OpenAI API call fails or no image is returned.
        
    Example:
        >>> image_bytes = load_image_from_path("input.png")
        >>> generated_bytes = process_image_with_openai(
        ...     image_bytes,
        ...     prompt="Make this image more vibrant",
        ...     model="gpt-5"
        ... )
        >>> print(f"Generated {len(generated_bytes)} bytes")
        Generated 45678 bytes
        
    Example with default prompt:
        >>> generated_bytes = process_image_with_openai(image_bytes)
    """
    if not image_bytes or len(image_bytes) == 0:
        raise ValueError("Image bytes cannot be empty")
    
    # Default prompt
    if prompt is None:
        prompt = "Recreate this image exactly as a high-resolution transparent PNG."
    
    logger.info(f"Processing image with OpenAI (model: {model}, prompt length: {len(prompt)})")
    
    # Encode image for OpenAI
    mime_type = "image/png"  # Assume PNG for input
    b64_image = encode_image_for_openai(image_bytes, mime_type)
    
    # Build input content
    input_content = [
        {"type": "input_text", "text": prompt},
        {
            "type": "input_image",
            "image_url": f"data:{mime_type};base64,{b64_image}"
        }
    ]
    
    # Initialize OpenAI client
    client = OpenAI()
    
    try:
        # Call OpenAI Responses API
        logger.debug("Calling OpenAI Responses API...")
        resp = client.responses.create(
            model=model,
            input=[
                {
                    "role": "user",
                    "content": input_content
                }
            ],
            tools=[
                {
                    "type": "image_generation",
                    "background": background,
                    "quality": quality
                }
            ],
            tool_choice="required"
        )
        
        logger.debug("Received response from OpenAI API")
        
        # Extract generated image from response
        image_generation_calls = [
            output
            for output in resp.output
            if hasattr(output, 'type') and output.type == "image_generation_call"
        ]
        
        # Fallback: try class name check
        if not image_generation_calls:
            image_generation_calls = [
                output
                for output in resp.output
                if type(output).__name__ == 'ImageGenerationCall'
            ]
        
        if not image_generation_calls:
            # Debug: print response structure
            if hasattr(resp, 'output') and resp.output:
                logger.error("No image_generation_call found in response. Response structure:")
                for idx, item in enumerate(resp.output):
                    logger.error(f"  Item {idx}: {type(item).__name__}, attributes: {[a for a in dir(item) if not a.startswith('_')]}")
            raise Exception("No image_generation_call found in OpenAI response")
        
        # Extract image data
        image_data = [output.result for output in image_generation_calls if hasattr(output, 'result')]
        
        if not image_data:
            raise Exception("No image data in image_generation_call result")
        
        # Decode base64 image data
        png_bytes = base64.b64decode(image_data[0])
        
        logger.info(f"Successfully processed image: {len(png_bytes)} bytes generated")
        return png_bytes
        
    except Exception as e:
        logger.error(f"Error processing image with OpenAI: {e}", exc_info=True)
        raise


def upload_image_to_s3(
    image_bytes: bytes,
    filename: Optional[str] = None,
    s3_key_prefix: str = "generated-images"
) -> Tuple[str, str]:
    """
    Upload an image to S3 and return the object URLs.
    
    Uploads image bytes to an S3 bucket and returns both the S3 URL and
    the public URL. The S3 key is generated using a timestamp and optional
    filename. Uses the artifacts bucket configured in the environment.
    
    Args:
        image_bytes: Raw image bytes to upload.
        filename: Optional filename to include in the S3 key.
                  If not provided, a timestamp-based name is generated.
        s3_key_prefix: Prefix for the S3 key (default: "generated-images").
        
    Returns:
        Tuple of (s3_url, public_url) where:
        - s3_url: S3 URI format (s3://bucket/key)
        - public_url: Public HTTPS URL for accessing the image
        
    Raises:
        ValueError: If image_bytes is empty.
        ClientError: If S3 upload fails.
        RuntimeError: If bucket name cannot be determined.
        
    Example:
        >>> image_bytes = process_image_with_openai(input_bytes)
        >>> s3_url, public_url = upload_image_to_s3(image_bytes, "output.png")
        >>> print(f"S3 URL: {s3_url}")
        >>> print(f"Public URL: {public_url}")
        S3 URL: s3://leadmagnet-artifacts-123456789/generated-images/1234567890_output.png
        Public URL: https://leadmagnet-artifacts-123456789.s3.us-east-1.amazonaws.com/generated-images/1234567890_output.png
        
    Example with auto-generated filename:
        >>> s3_url, public_url = upload_image_to_s3(image_bytes)
    """
    if not image_bytes or len(image_bytes) == 0:
        raise ValueError("Image bytes cannot be empty")
    
    # Get S3 configuration
    bucket_name = get_artifacts_bucket()
    region = get_aws_region()
    s3_client = get_s3_client()
    
    # Generate filename if not provided
    if not filename:
        timestamp = int(time.time())
        filename = f"image_{timestamp}.png"
    else:
        # Ensure filename has .png extension
        if not filename.endswith('.png'):
            filename = f"{filename}.png"
    
    # Generate S3 key
    timestamp = int(time.time())
    s3_key = f"{s3_key_prefix}/{timestamp}_{filename}"
    
    logger.info(f"Uploading image to S3: bucket={bucket_name}, key={s3_key}, size={len(image_bytes)} bytes")
    
    try:
        # Upload to S3
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=image_bytes,
            ContentType='image/png',
            CacheControl='public, max-age=31536000, immutable',
        )
        
        # Generate URLs
        s3_url = f"s3://{bucket_name}/{s3_key}"
        # Use direct S3 public URL format (permanent, non-expiring)
        public_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{s3_key}"
        
        logger.info(f"Successfully uploaded image to S3")
        logger.info(f"  S3 URL: {s3_url}")
        logger.info(f"  Public URL: {public_url}")
        
        return s3_url, public_url
        
    except ClientError as e:
        logger.error(f"Error uploading image to S3: {e}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Unexpected error uploading to S3: {e}", exc_info=True)
        raise RuntimeError(f"Failed to upload image to S3: {e}") from e


def cleanup_temp_files(*file_paths: str) -> None:
    """
    Clean up temporary files.
    
    Removes one or more temporary files from the filesystem. Handles errors
    gracefully and logs cleanup actions. Useful for cleaning up temporary
    files created during image processing workflows.
    
    Args:
        *file_paths: Variable number of file paths to delete.
        
    Example:
        >>> temp_file1 = "/tmp/image1.png"
        >>> temp_file2 = "/tmp/image2.png"
        >>> cleanup_temp_files(temp_file1, temp_file2)
        Cleaned up 2 temporary file(s)
        
    Example with single file:
        >>> cleanup_temp_files("/tmp/output.png")
        Cleaned up 1 temporary file(s)
        
    Note:
        This function will not raise exceptions if files don't exist or
        cannot be deleted. It logs warnings instead.
    """
    if not file_paths:
        logger.debug("No files to clean up")
        return
    
    cleaned_count = 0
    failed_count = 0
    
    for file_path in file_paths:
        if not file_path:
            continue
        
        try:
            abs_path = os.path.abspath(os.path.expanduser(file_path))
            
            if os.path.exists(abs_path):
                os.remove(abs_path)
                cleaned_count += 1
                logger.debug(f"Cleaned up temporary file: {abs_path}")
            else:
                logger.debug(f"File does not exist (skipping): {abs_path}")
                
        except PermissionError as e:
            logger.warning(f"Permission denied deleting file {abs_path}: {e}")
            failed_count += 1
        except OSError as e:
            logger.warning(f"Error deleting file {abs_path}: {e}")
            failed_count += 1
        except Exception as e:
            logger.warning(f"Unexpected error deleting file {abs_path}: {e}")
            failed_count += 1
    
    if cleaned_count > 0:
        logger.info(f"Cleaned up {cleaned_count} temporary file(s)")
    if failed_count > 0:
        logger.warning(f"Failed to clean up {failed_count} file(s)")

