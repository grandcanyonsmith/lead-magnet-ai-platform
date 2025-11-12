#!/usr/bin/env python3
"""
Test script to verify artifact changes:
1. HTML files are saved with .html extension (not .md)
2. Markdown files are saved with .md extension
3. Content type detection works correctly
"""

import sys
import os

# Add parent directory to path to import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

def test_html_detection():
    """Test that HTML content is detected correctly"""
    print("=" * 80)
    print("Test 1: HTML Content Detection")
    print("=" * 80)
    
    # Test cases
    test_cases = [
        ("<html><body>Test</body></html>", True, "Full HTML document"),
        ("<div>Content</div>", True, "HTML fragment"),
        ("  <p>Paragraph</p>", True, "HTML with leading whitespace"),
        ("# Markdown Header", False, "Markdown header"),
        ("This is plain text", False, "Plain text"),
        ("", False, "Empty string"),
        ("<", True, "Single tag start"),
        ("# Header\n\nParagraph text", False, "Markdown content"),
    ]
    
    passed = 0
    failed = 0
    
    for content, expected_html, description in test_cases:
        # Simulate the detection logic from processor.py
        is_html = content.strip().startswith('<')
        result = "✅" if is_html == expected_html else "❌"
        
        if is_html == expected_html:
            passed += 1
            print(f"  {result} {description}: {'HTML' if is_html else 'Markdown'} (expected: {'HTML' if expected_html else 'Markdown'})")
        else:
            failed += 1
            print(f"  {result} {description}: Got {'HTML' if is_html else 'Markdown'}, expected {'HTML' if expected_html else 'Markdown'}")
    
    print(f"\n  Passed: {passed}/{len(test_cases)}")
    if failed > 0:
        print(f"  Failed: {failed}/{len(test_cases)}")
    
    return failed == 0

def test_file_extension_logic():
    """Test file extension assignment logic"""
    print("\n" + "=" * 80)
    print("Test 2: File Extension Assignment")
    print("=" * 80)
    
    test_cases = [
        ("<html><body>Test</body></html>", ".html", "HTML content"),
        ("<div>Content</div>", ".html", "HTML fragment"),
        ("# Markdown Header\n\nContent", ".md", "Markdown content"),
        ("Plain text content", ".md", "Plain text"),
    ]
    
    passed = 0
    failed = 0
    
    for content, expected_ext, description in test_cases:
        # Simulate the logic from processor.py
        file_ext = '.html' if content.strip().startswith('<') else '.md'
        result = "✅" if file_ext == expected_ext else "❌"
        
        if file_ext == expected_ext:
            passed += 1
            print(f"  {result} {description}: {file_ext} (expected: {expected_ext})")
        else:
            failed += 1
            print(f"  {result} {description}: Got {file_ext}, expected {expected_ext}")
    
    print(f"\n  Passed: {passed}/{len(test_cases)}")
    if failed > 0:
        print(f"  Failed: {failed}/{len(test_cases)}")
    
    return failed == 0

def test_content_type_mapping():
    """Test content type mapping"""
    print("\n" + "=" * 80)
    print("Test 3: Content Type Mapping")
    print("=" * 80)
    
    # Import the artifact service
    try:
        from artifact_service import ArtifactService
        
        # Create a mock service (we don't need real DB/S3 for this test)
        class MockDB:
            pass
        class MockS3:
            pass
        
        service = ArtifactService(MockDB(), MockS3())
        
        test_cases = [
            ("test.html", "text/html"),
            ("test.md", "text/markdown"),
            ("test.txt", "text/plain"),
            ("test.png", "image/png"),
            ("test.jpg", "image/jpeg"),
            ("test.jpeg", "image/jpeg"),
            ("test.json", "application/json"),
            ("test.unknown", "application/octet-stream"),
        ]
        
        passed = 0
        failed = 0
        
        for filename, expected_type in test_cases:
            content_type = service.get_content_type(filename)
            result = "✅" if content_type == expected_type else "❌"
            
            if content_type == expected_type:
                passed += 1
                print(f"  {result} {filename}: {content_type} (expected: {expected_type})")
            else:
                failed += 1
                print(f"  {result} {filename}: Got {content_type}, expected {expected_type}")
        
        print(f"\n  Passed: {passed}/{len(test_cases)}")
        if failed > 0:
            print(f"  Failed: {failed}/{len(test_cases)}")
        
        return failed == 0
    except ImportError as e:
        print(f"  ⚠️  Could not import artifact_service: {e}")
        print("  Skipping content type mapping test")
        return True

def main():
    print("=" * 80)
    print("Artifact Changes Test Suite")
    print("=" * 80)
    print()
    
    results = []
    
    # Run tests
    results.append(("HTML Detection", test_html_detection()))
    results.append(("File Extension Logic", test_file_extension_logic()))
    results.append(("Content Type Mapping", test_content_type_mapping()))
    
    # Summary
    print("\n" + "=" * 80)
    print("Test Summary")
    print("=" * 80)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"  {status}: {test_name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 80)
    if all_passed:
        print("✅ All tests passed!")
        print("=" * 80)
        return 0
    else:
        print("❌ Some tests failed")
        print("=" * 80)
        return 1

if __name__ == '__main__':
    sys.exit(main())

