#!/usr/bin/env python3
"""
Unit test for webhook artifacts functionality.
Tests that the webhook payload includes artifacts without requiring a full job execution.
"""

import sys
import os
import json
import logging
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Add the worker directory to Python path so imports work
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

from delivery_service import DeliveryService
from db_service import DynamoDBService
from ai_service import AIService

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_mock_artifacts():
    """Create mock artifacts for testing."""
    return [
        {
            'artifact_id': 'art_image_001',
            'artifact_type': 'image',
            'artifact_name': 'image_1.png',
            'public_url': 'https://example.com/images/image_1.png',
            'file_size_bytes': 12345,
            'mime_type': 'image/png',
            'created_at': datetime.utcnow().isoformat(),
            'job_id': 'test_job_001'
        },
        {
            'artifact_id': 'art_html_001',
            'artifact_type': 'html_final',
            'artifact_name': 'final.html',
            'public_url': 'https://example.com/final.html',
            'file_size_bytes': 54321,
            'mime_type': 'text/html',
            'created_at': datetime.utcnow().isoformat(),
            'job_id': 'test_job_001'
        },
        {
            'artifact_id': 'art_md_001',
            'artifact_type': 'step_output',
            'artifact_name': 'step_1_report.md',
            'public_url': 'https://example.com/reports/step_1_report.md',
            'file_size_bytes': 23456,
            'mime_type': 'text/markdown',
            'created_at': datetime.utcnow().isoformat(),
            'job_id': 'test_job_001'
        },
        {
            'artifact_id': 'art_image_002',
            'artifact_type': 'image',
            'artifact_name': 'image_2.jpg',
            'public_url': 'https://example.com/images/image_2.jpg',
            'file_size_bytes': 34567,
            'mime_type': 'image/jpeg',
            'created_at': datetime.utcnow().isoformat(),
            'job_id': 'test_job_001'
        }
    ]


def test_webhook_payload_structure():
    """Test that webhook payload includes artifacts in correct structure."""
    logger.info("=" * 80)
    logger.info("Test: Webhook Payload Structure")
    logger.info("=" * 80)
    
    # Create mock services
    mock_db = Mock(spec=DynamoDBService)
    mock_ai = Mock(spec=AIService)
    
    # Mock artifacts query
    mock_artifacts = create_mock_artifacts()
    mock_db.query_artifacts_by_job_id.return_value = mock_artifacts
    
    # Create delivery service
    delivery_service = DeliveryService(mock_db, mock_ai)
    
    # Mock requests.post to capture the payload
    captured_payload = {}
    
    def mock_post(url, json=None, headers=None, timeout=None):
        captured_payload['url'] = url
        captured_payload['json'] = json
        captured_payload['headers'] = headers
        # Return a mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'OK'
        mock_response.raise_for_status = Mock()
        return mock_response
    
    # Test data
    job_id = 'test_job_001'
    webhook_url = 'https://httpbin.org/post'
    webhook_headers = {'X-Test-Header': 'test-value'}
    output_url = 'https://example.com/final.html'
    submission = {
        'submission_data': {
            'name': 'Test User',
            'email': 'test@example.com',
            'phone': '+1234567890'
        }
    }
    job = {
        'job_id': job_id,
        'workflow_id': 'wf_test_001',
        'status': 'completed'
    }
    
    # Send webhook with mocked requests
    with patch('delivery_service.requests.post', side_effect=mock_post):
        try:
            delivery_service.send_webhook_notification(
                webhook_url=webhook_url,
                webhook_headers=webhook_headers,
                job_id=job_id,
                output_url=output_url,
                submission=submission,
                job=job
            )
        except Exception as e:
            logger.error(f"Error sending webhook: {e}")
            return False
    
    # Verify payload structure
    payload = captured_payload.get('json', {})
    
    logger.info(f"Payload keys: {list(payload.keys())}")
    
    # Check required fields
    required_fields = ['job_id', 'status', 'output_url', 'artifacts', 'images', 'html_files', 'markdown_files']
    missing_fields = [field for field in required_fields if field not in payload]
    
    if missing_fields:
        logger.error(f"Missing required fields: {missing_fields}")
        return False
    
    logger.info("✅ All required fields present")
    
    # Verify artifacts array
    artifacts = payload.get('artifacts', [])
    if len(artifacts) != 4:
        logger.error(f"Expected 4 artifacts, got {len(artifacts)}")
        return False
    
    logger.info(f"✅ Artifacts array has {len(artifacts)} items")
    
    # Verify artifact metadata structure
    for artifact in artifacts:
        required_artifact_fields = ['artifact_id', 'artifact_type', 'artifact_name', 'public_url']
        missing = [field for field in required_artifact_fields if field not in artifact]
        if missing:
            logger.error(f"Artifact missing fields: {missing}")
            return False
    
    logger.info("✅ All artifacts have required metadata")
    
    # Verify categorization
    images = payload.get('images', [])
    html_files = payload.get('html_files', [])
    markdown_files = payload.get('markdown_files', [])
    
    logger.info(f"Images: {len(images)}")
    logger.info(f"HTML files: {len(html_files)}")
    logger.info(f"Markdown files: {len(markdown_files)}")
    
    if len(images) != 2:
        logger.error(f"Expected 2 images, got {len(images)}")
        return False
    
    if len(html_files) != 1:
        logger.error(f"Expected 1 HTML file, got {len(html_files)}")
        return False
    
    if len(markdown_files) != 1:
        logger.error(f"Expected 1 markdown file, got {len(markdown_files)}")
        return False
    
    logger.info("✅ Artifact categorization correct")
    
    # Verify image artifacts
    image_ids = {img['artifact_id'] for img in images}
    expected_image_ids = {'art_image_001', 'art_image_002'}
    if image_ids != expected_image_ids:
        logger.error(f"Image IDs don't match. Expected {expected_image_ids}, got {image_ids}")
        return False
    
    logger.info("✅ Image artifacts correctly identified")
    
    # Verify HTML file
    html_ids = {html['artifact_id'] for html in html_files}
    expected_html_ids = {'art_html_001'}
    if html_ids != expected_html_ids:
        logger.error(f"HTML IDs don't match. Expected {expected_html_ids}, got {html_ids}")
        return False
    
    logger.info("✅ HTML artifacts correctly identified")
    
    # Verify markdown file
    md_ids = {md['artifact_id'] for md in markdown_files}
    expected_md_ids = {'art_md_001'}
    if md_ids != expected_md_ids:
        logger.error(f"Markdown IDs don't match. Expected {expected_md_ids}, got {md_ids}")
        return False
    
    logger.info("✅ Markdown artifacts correctly identified")
    
    # Print sample payload structure
    logger.info("\n" + "=" * 80)
    logger.info("Sample Payload Structure:")
    logger.info("=" * 80)
    sample_payload = {
        'job_id': payload['job_id'],
        'status': payload['status'],
        'artifacts_count': len(payload['artifacts']),
        'images_count': len(payload['images']),
        'html_files_count': len(payload['html_files']),
        'markdown_files_count': len(payload['markdown_files']),
        'sample_artifact': payload['artifacts'][0] if payload['artifacts'] else None
    }
    logger.info(json.dumps(sample_payload, indent=2, default=str))
    
    logger.info("\n" + "=" * 80)
    logger.info("✅ All tests passed!")
    logger.info("=" * 80)
    
    return True


def test_artifact_with_none_filename():
    """Test webhook payload when artifact has None file_name."""
    logger.info("\n" + "=" * 80)
    logger.info("Test: Artifact with None file_name")
    logger.info("=" * 80)
    
    # Create mock services
    mock_db = Mock(spec=DynamoDBService)
    mock_ai = Mock(spec=AIService)
    
    # Mock artifact with None file_name (edge case)
    mock_artifacts = [
        {
            'artifact_id': 'art_test_001',
            'artifact_type': 'image',
            'artifact_name': None,  # None artifact_name
            'file_name': None,  # None file_name (key exists but value is None)
            'public_url': 'https://example.com/test.png',
            'file_size_bytes': 12345,
            'mime_type': 'image/png',
            'created_at': datetime.utcnow().isoformat(),
            'job_id': 'test_job_none'
        }
    ]
    mock_db.query_artifacts_by_job_id.return_value = mock_artifacts
    
    # Create delivery service
    delivery_service = DeliveryService(mock_db, mock_ai)
    
    # Mock requests.post to capture the payload
    captured_payload = {}
    
    def mock_post(url, json=None, headers=None, timeout=None):
        captured_payload['json'] = json
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'OK'
        mock_response.raise_for_status = Mock()
        return mock_response
    
    # Test data
    job_id = 'test_job_none'
    webhook_url = 'https://httpbin.org/post'
    webhook_headers = {}
    output_url = 'https://example.com/final.html'
    submission = {'submission_data': {}}
    job = {'job_id': job_id, 'workflow_id': 'wf_test_001'}
    
    # Send webhook with mocked requests - should not crash
    with patch('delivery_service.requests.post', side_effect=mock_post):
        try:
            delivery_service.send_webhook_notification(
                webhook_url=webhook_url,
                webhook_headers=webhook_headers,
                job_id=job_id,
                output_url=output_url,
                submission=submission,
                job=job
            )
        except AttributeError as e:
            if "'NoneType' object has no attribute 'lower'" in str(e):
                logger.error("❌ Failed: Still crashes when file_name is None")
                return False
            raise
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return False
    
    # Verify payload structure
    payload = captured_payload.get('json', {})
    
    # Check that artifact_name is an empty string, not None
    artifacts = payload.get('artifacts', [])
    if len(artifacts) != 1:
        logger.error(f"Expected 1 artifact, got {len(artifacts)}")
        return False
    
    artifact_name = artifacts[0].get('artifact_name')
    if artifact_name is None:
        logger.error("artifact_name should not be None")
        return False
    
    if artifact_name != '':
        logger.warning(f"artifact_name is '{artifact_name}', expected empty string")
        # This is acceptable - the important thing is it's not None
    
    logger.info("✅ Artifact with None file_name handled correctly")
    
    return True


def test_empty_artifacts():
    """Test webhook payload when no artifacts exist."""
    logger.info("\n" + "=" * 80)
    logger.info("Test: Empty Artifacts")
    logger.info("=" * 80)
    
    # Create mock services
    mock_db = Mock(spec=DynamoDBService)
    mock_ai = Mock(spec=AIService)
    
    # Mock empty artifacts query
    mock_db.query_artifacts_by_job_id.return_value = []
    
    # Create delivery service
    delivery_service = DeliveryService(mock_db, mock_ai)
    
    # Mock requests.post to capture the payload
    captured_payload = {}
    
    def mock_post(url, json=None, headers=None, timeout=None):
        captured_payload['json'] = json
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'OK'
        mock_response.raise_for_status = Mock()
        return mock_response
    
    # Test data
    job_id = 'test_job_empty'
    webhook_url = 'https://httpbin.org/post'
    webhook_headers = {}
    output_url = 'https://example.com/final.html'
    submission = {'submission_data': {}}
    job = {'job_id': job_id, 'workflow_id': 'wf_test_001'}
    
    # Send webhook with mocked requests
    with patch('delivery_service.requests.post', side_effect=mock_post):
        try:
            delivery_service.send_webhook_notification(
                webhook_url=webhook_url,
                webhook_headers=webhook_headers,
                job_id=job_id,
                output_url=output_url,
                submission=submission,
                job=job
            )
        except Exception as e:
            logger.error(f"Error sending webhook: {e}")
            return False
    
    # Verify payload structure
    payload = captured_payload.get('json', {})
    
    # Check that arrays exist but are empty
    if payload.get('artifacts') != []:
        logger.error("Artifacts array should be empty")
        return False
    
    if payload.get('images') != []:
        logger.error("Images array should be empty")
        return False
    
    if payload.get('html_files') != []:
        logger.error("HTML files array should be empty")
        return False
    
    if payload.get('markdown_files') != []:
        logger.error("Markdown files array should be empty")
        return False
    
    logger.info("✅ Empty artifacts handled correctly")
    
    return True


def main():
    """Run all tests."""
    logger.info("=" * 80)
    logger.info("Webhook Artifacts Unit Tests")
    logger.info("=" * 80)
    
    tests = [
        ("Webhook Payload Structure", test_webhook_payload_structure),
        ("Artifact with None file_name", test_artifact_with_none_filename),
        ("Empty Artifacts", test_empty_artifacts),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.error(f"Test '{test_name}' failed with exception: {e}", exc_info=True)
            results.append((test_name, False))
    
    # Summary
    logger.info("\n" + "=" * 80)
    logger.info("Test Summary")
    logger.info("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        logger.info(f"{status}: {test_name}")
    
    logger.info(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("\n" + "=" * 80)
        logger.info("✅ All tests passed!")
        logger.info("=" * 80)
        return 0
    else:
        logger.error("\n" + "=" * 80)
        logger.error("❌ Some tests failed")
        logger.error("=" * 80)
        return 1


if __name__ == '__main__':
    sys.exit(main())

