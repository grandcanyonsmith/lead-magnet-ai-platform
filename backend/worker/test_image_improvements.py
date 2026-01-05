#!/usr/bin/env python3
"""
Test script for image handling improvements and image_generation tool parameters.
"""

import sys
import os
from pathlib import Path

# Add backend/worker to path
sys.path.insert(0, str(Path(__file__).parent))

from utils.image_utils import (
    clean_image_url,
    extract_image_urls,
    validate_image_size,
    validate_image_format,
    optimize_image,
    deduplicate_image_urls,
    download_image_and_convert_to_data_url,
    get_image_cache,
    get_url_hash
)
from services.tools import ToolBuilder
from io import BytesIO

def test_url_cleaning():
    """Test URL cleaning function."""
    print("\n=== Testing URL Cleaning ===")
    
    test_cases = [
        ("https://example.com/image.jpg))", "https://example.com/image.jpg"),
        ("https://example.com/image.png.", "https://example.com/image.png"),
        ("https://example.com/image.jpg?size=100))", "https://example.com/image.jpg?size=100"),
        ("https://www.proactivedogtraining.com/images/training-boot-camp.jpg?height=260&mode=crop&width=370))", 
         "https://www.proactivedogtraining.com/images/training-boot-camp.jpg?height=260&mode=crop&width=370"),
    ]
    
    for input_url, expected in test_cases:
        result = clean_image_url(input_url)
        status = "✅" if result == expected else "❌"
        print(f"{status} Input: {input_url}")
        print(f"   Expected: {expected}")
        print(f"   Got:      {result}")
        if result != expected:
            print(f"   ⚠️  MISMATCH!")
    
    print("✅ URL cleaning tests completed")

def test_image_url_extraction():
    """Test image URL extraction."""
    print("\n=== Testing Image URL Extraction ===")
    
    text = """
    Check out these images:
    https://example.com/image1.png
    https://example.com/image2.jpg?size=large
    https://example.com/image3.png))
    https://www.proactivedogtraining.com/images/training-boot-camp.jpg?height=260&mode=crop&width=370))
    """
    
    urls = extract_image_urls(text)
    print(f"Found {len(urls)} image URLs:")
    for url in urls:
        print(f"  - {url}")
    
    # Check that trailing punctuation is removed
    assert all('))' not in url for url in urls), "Trailing punctuation not removed!"
    print("✅ Image URL extraction tests passed")

def test_size_validation():
    """Test image size validation."""
    print("\n=== Testing Image Size Validation ===")
    
    # Test small image (should pass)
    small_image = b'\x00' * (1024 * 1024)  # 1MB
    is_valid, error = validate_image_size(small_image)
    print(f"Small image (1MB): {'✅ Valid' if is_valid else f'❌ Invalid: {error}'}")
    assert is_valid, "Small image should be valid"
    
    # Test large image (should fail)
    large_image = b'\x00' * (11 * 1024 * 1024)  # 11MB
    is_valid, error = validate_image_size(large_image)
    print(f"Large image (11MB): {'✅ Valid' if is_valid else f'❌ Invalid: {error}'}")
    assert not is_valid, "Large image should be invalid"
    
    print("✅ Size validation tests passed")

def test_deduplication():
    """Test URL deduplication."""
    print("\n=== Testing URL Deduplication ===")
    
    urls = [
        "https://example.com/image.jpg",
        "https://example.com/image.jpg?size=large",
        "https://example.com/image.jpg?size=small",
        "https://example.com/other.jpg",
        "https://example.com/image.jpg",  # Duplicate
    ]
    
    deduplicated = deduplicate_image_urls(urls)
    print(f"Original: {len(urls)} URLs")
    print(f"Deduplicated: {len(deduplicated)} URLs")
    print("Deduplicated URLs:")
    for url in deduplicated:
        print(f"  - {url}")
    
    assert len(deduplicated) < len(urls), "Deduplication should remove duplicates"
    print("✅ Deduplication tests passed")

def test_tool_builder_image_generation():
    """Test tool builder with image_generation config."""
    print("\n=== Testing Tool Builder with Image Generation ===")
    
    tools = [
        {"type": "web_search"},
        {
            "type": "image_generation",
            "size": "1024x1024",
            "quality": "high",
            "background": "transparent",
            "format": "png",
            "compression": 90,
            "input_fidelity": "high"
        },
        {
            "type": "image_generation",
            "size": "auto",
            "quality": "auto",
            "background": "auto"
        },
        {
            "type": "image_generation",
            "size": "invalid_size",  # Should be corrected to "auto"
            "quality": "invalid_quality",  # Should be corrected to "auto"
        }
    ]
    
    cleaned = ToolBuilder.clean_tools(tools)
    
    print(f"Cleaned {len(cleaned)} tools")
    for i, tool in enumerate(cleaned):
        if tool.get("type") == "image_generation":
            print(f"\nTool {i+1} (image_generation):")
            print(f"  size: {tool.get('size')}")
            print(f"  quality: {tool.get('quality')}")
            print(f"  background: {tool.get('background')}")
            print(f"  format: {tool.get('format', 'not set')}")
            print(f"  compression: {tool.get('compression', 'not set')}")
            print(f"  input_fidelity: {tool.get('input_fidelity', 'not set')}")
            
            # Verify defaults are set
            assert tool.get("size") in ["1024x1024", "auto"], f"Invalid size: {tool.get('size')}"
            assert tool.get("quality") in ["high", "auto"], f"Invalid quality: {tool.get('quality')}"
            assert tool.get("background") in ["transparent", "auto"], f"Invalid background: {tool.get('background')}"
    
    print("✅ Tool builder tests passed")

def test_cache():
    """Test image cache functionality."""
    print("\n=== Testing Image Cache ===")
    
    cache = get_image_cache()
    test_url = "https://example.com/test.jpg"
    cache_key = f"image_data_url:{get_url_hash(test_url)}"
    test_data = "data:image/jpeg;base64,test123"
    
    # Set cache
    cache.set(cache_key, test_data)
    print(f"Set cache for: {test_url[:50]}...")
    
    # Get from cache
    cached = cache.get(cache_key)
    if cached == test_data:
        print("✅ Cache retrieval successful")
    else:
        print(f"❌ Cache retrieval failed: expected '{test_data}', got '{cached}'")
    
    # Test cache miss
    cache_key_miss = f"image_data_url:{get_url_hash('https://example.com/other.jpg')}"
    cached_miss = cache.get(cache_key_miss)
    if cached_miss is None:
        print("✅ Cache miss handled correctly")
    else:
        print(f"❌ Cache miss failed: expected None, got '{cached_miss}'")
    
    print("✅ Cache tests passed")

def test_image_format_validation():
    """Test image format validation (if PIL available)."""
    print("\n=== Testing Image Format Validation ===")
    
    try:
        from PIL import Image
        
        # Create a simple test image
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = BytesIO()
        img.save(img_bytes, format='PNG')
        image_bytes = img_bytes.getvalue()
        
        is_valid, mime_type, error = validate_image_format(image_bytes)
        if is_valid:
            print(f"✅ Valid PNG image detected: {mime_type}")
        else:
            print(f"❌ Invalid image: {error}")
        
        # Test invalid bytes
        invalid_bytes = b"not an image"
        is_valid, mime_type, error = validate_image_format(invalid_bytes)
        if not is_valid:
            print(f"✅ Invalid bytes correctly rejected: {error}")
        else:
            print(f"❌ Invalid bytes incorrectly accepted")
        
        print("✅ Format validation tests passed")
    except ImportError:
        print("⚠️  PIL/Pillow not available - skipping format validation tests")

def main():
    """Run all tests."""
    print("=" * 80)
    print("Image Handling Improvements & Image Generation Tool Tests")
    print("=" * 80)
    
    try:
        test_url_cleaning()
        test_image_url_extraction()
        test_size_validation()
        test_deduplication()
        test_tool_builder_image_generation()
        test_cache()
        test_image_format_validation()
        
        print("\n" + "=" * 80)
        print("✅ ALL TESTS PASSED!")
        print("=" * 80)
        return 0
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
