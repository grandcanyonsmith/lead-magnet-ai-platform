#!/usr/bin/env python3
"""
Image Processing Script with S3 Upload

Standalone script for processing images through OpenAI API and uploading to S3.

This script:
1. Accepts an image from URL or local file path
2. Processes it through OpenAI Responses API with image generation
3. Uploads the generated image to S3
4. Prints the public object URL
5. Cleans up temporary files

Usage:
    python3 scripts/process_image.py --input <url_or_path> [options]
    
Examples:
    # Process image from URL
    python3 scripts/process_image.py -i https://example.com/image.png
    
    # Process local image file
    python3 scripts/process_image.py -i ~/Downloads/image.png
    
    # Custom prompt and model
    python3 scripts/process_image.py -i image.png -p "Make it more colorful" -m gpt-5
    
    # Keep temporary files
    python3 scripts/process_image.py -i image.png --keep-temp
"""

import os
import sys
import argparse
import tempfile
import logging
from urllib.parse import urlparse

# Add scripts directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.image_processing_utils import (
    download_image_from_url,
    load_image_from_path,
    process_image_with_openai,
    upload_image_to_s3,
    cleanup_temp_files
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def is_url(path_or_url: str) -> bool:
    """
    Determine if the input is a URL or a local file path.
    
    Args:
        path_or_url: Input string to check
        
    Returns:
        True if it appears to be a URL, False if it's a local path
    """
    if not path_or_url:
        return False
    
    parsed = urlparse(path_or_url)
    return parsed.scheme in ('http', 'https')


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description='Process images through OpenAI API and upload to S3',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process image from URL
  %(prog)s -i https://example.com/image.png
  
  # Process local image file
  %(prog)s -i ~/Downloads/image.png
  
  # Custom prompt
  %(prog)s -i image.png -p "Make this image more vibrant"
  
  # Keep temporary files for debugging
  %(prog)s -i image.png --keep-temp
        """
    )
    
    parser.add_argument(
        '--input', '-i',
        required=True,
        help='Image URL or local file path'
    )
    
    parser.add_argument(
        '--prompt', '-p',
        default=None,
        help='Custom prompt for OpenAI (default: recreation prompt)'
    )
    
    parser.add_argument(
        '--model', '-m',
        default='gpt-5',
        help='OpenAI model to use (default: gpt-5)'
    )
    
    parser.add_argument(
        '--output-dir', '-o',
        default=None,
        help='Directory to save temporary files (default: system temp directory)'
    )
    
    parser.add_argument(
        '--keep-temp',
        action='store_true',
        help='Keep temporary files after processing (default: delete them)'
    )
    
    parser.add_argument(
        '--background',
        default='transparent',
        help='Background setting for image generation (default: transparent)'
    )
    
    parser.add_argument(
        '--quality',
        default='high',
        help='Image quality setting (default: high)'
    )
    
    parser.add_argument(
        '--s3-prefix',
        default='generated-images',
        help='S3 key prefix for uploaded images (default: generated-images)'
    )
    
    args = parser.parse_args()
    
    # Determine output directory
    output_dir = args.output_dir
    if output_dir:
        output_dir = os.path.expanduser(output_dir)
        os.makedirs(output_dir, exist_ok=True)
    else:
        output_dir = tempfile.gettempdir()
    
    temp_files = []
    
    try:
        print("=" * 80)
        print("Image Processing with OpenAI and S3 Upload")
        print("=" * 80)
        print()
        
        # Step 1: Load or download image
        print("Step 1: Loading image...")
        input_path = args.input
        
        if is_url(input_path):
            print(f"  Detected URL: {input_path[:80]}...")
            image_bytes = download_image_from_url(input_path)
        else:
            print(f"  Detected local file: {input_path}")
            image_bytes = load_image_from_path(input_path)
        
        print(f"  ✓ Loaded {len(image_bytes)} bytes")
        print()
        
        # Step 2: Process with OpenAI
        print("Step 2: Processing with OpenAI...")
        print(f"  Model: {args.model}")
        if args.prompt:
            print(f"  Prompt: {args.prompt[:60]}...")
        else:
            print(f"  Prompt: (using default recreation prompt)")
        
        generated_bytes = process_image_with_openai(
            image_bytes=image_bytes,
            prompt=args.prompt,
            model=args.model,
            background=args.background,
            quality=args.quality
        )
        
        print(f"  ✓ Generated {len(generated_bytes)} bytes")
        print()
        
        # Step 3: Upload to S3
        print("Step 3: Uploading to S3...")
        
        # Generate filename from input
        if is_url(input_path):
            # Extract filename from URL or use timestamp
            parsed = urlparse(input_path)
            url_filename = os.path.basename(parsed.path)
            if url_filename and '.' in url_filename:
                filename = f"generated_{url_filename}"
            else:
                filename = None
        else:
            # Use input filename with prefix
            input_filename = os.path.basename(input_path)
            filename = f"generated_{input_filename}"
        
        s3_url, public_url = upload_image_to_s3(
            image_bytes=generated_bytes,
            filename=filename,
            s3_key_prefix=args.s3_prefix
        )
        
        print(f"  ✓ Uploaded to S3")
        print()
        
        # Step 4: Print results
        print("=" * 80)
        print("RESULTS")
        print("=" * 80)
        print(f"S3 URL:        {s3_url}")
        print(f"Public URL:    {public_url}")
        print("=" * 80)
        print()
        
        # Optionally save temp file
        if args.keep_temp:
            import time
            temp_filename = f"processed_image_{int(time.time())}.png"
            temp_path = os.path.join(output_dir, temp_filename)
            with open(temp_path, "wb") as f:
                f.write(generated_bytes)
            temp_files.append(temp_path)
            print(f"Temporary file saved: {temp_path}")
            print()
        
        # Step 5: Cleanup
        if not args.keep_temp:
            print("Step 4: Cleaning up temporary files...")
            # No temp files to clean up in this workflow (we work with bytes in memory)
            # But if we had any, we'd clean them here
            print("  ✓ No temporary files to clean up")
            print()
        
        print("✓ Processing complete!")
        return 0
        
    except KeyboardInterrupt:
        print("\n\n⚠ Interrupted by user")
        return 130
    except Exception as e:
        logger.error(f"Error processing image: {e}", exc_info=True)
        print(f"\n❌ Error: {e}")
        return 1
    finally:
        # Cleanup temp files if not keeping them
        if temp_files and not args.keep_temp:
            cleanup_temp_files(*temp_files)


if __name__ == "__main__":
    sys.exit(main())

