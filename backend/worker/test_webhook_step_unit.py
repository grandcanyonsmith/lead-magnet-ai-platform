"""
Unit test for webhook step service.
Tests webhook step execution without requiring AWS resources.
"""

import sys
import os
import json
import logging
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from typing import Dict, Any

# Add the worker directory to Python path so imports work
from pathlib import Path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

from services.webhook_step_service import WebhookStepService

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_webhook_step_payload_structure():
    """Test that webhook payload has the correct nested structure."""
    logger.info("Testing webhook payload structure...")
    
    service = WebhookStepService()
    
    # Mock data
    step = {
        'step_name': 'Test Webhook Step',
        'webhook_url': 'https://example.com/webhook',
        'webhook_headers': {'Authorization': 'Bearer token123'},
        'webhook_data_selection': {
            'include_submission': True,
            'include_job_info': True,
            'exclude_step_indices': []
        }
    }
    
    job_id = 'test_job_123'
    job = {
        'job_id': job_id,
        'workflow_id': 'test_workflow',
        'status': 'processing',
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat()
    }
    
    submission = {
        'submission_data': {
            'name': 'Test User',
            'email': 'test@example.com',
            'phone': '+1234567890'
        }
    }
    
    step_outputs = [
        {
            'step_name': 'Step 1',
            'output': 'This is step 1 output',
            'artifact_id': 'art_123',
            'image_urls': []
        },
        {
            'step_name': 'Step 2',
            'output': 'This is step 2 output',
            'artifact_id': 'art_456',
            'image_urls': ['https://example.com/image1.png']
        }
    ]
    
    sorted_steps = [
        {'step_name': 'Step 1', 'step_order': 0},
        {'step_name': 'Step 2', 'step_order': 1},
        {'step_name': 'Test Webhook Step', 'step_order': 2}
    ]
    
    # Build payload
    payload = service._build_webhook_payload(
        job_id=job_id,
        job=job,
        submission=submission,
        step_outputs=step_outputs,
        sorted_steps=sorted_steps,
        step_index=2,
        data_selection=step['webhook_data_selection']
    )
    
    # Verify payload structure
    assert 'submission_data' in payload, "Payload should include submission_data"
    assert 'step_outputs' in payload, "Payload should include step_outputs"
    assert 'job_info' in payload, "Payload should include job_info"
    
    # Verify submission_data
    assert payload['submission_data']['name'] == 'Test User'
    assert payload['submission_data']['email'] == 'test@example.com'
    
    # Verify step_outputs structure
    assert 'step_0' in payload['step_outputs'], "Should include step_0"
    assert 'step_1' in payload['step_outputs'], "Should include step_1"
    assert payload['step_outputs']['step_0']['step_name'] == 'Step 1'
    assert payload['step_outputs']['step_0']['output'] == 'This is step 1 output'
    assert payload['step_outputs']['step_1']['image_urls'] == ['https://example.com/image1.png']
    
    # Verify job_info
    assert payload['job_info']['job_id'] == job_id
    assert payload['job_info']['workflow_id'] == 'test_workflow'
    
    logger.info("✅ Payload structure test passed!")
    logger.info(f"Payload keys: {list(payload.keys())}")
    logger.info(f"Step outputs keys: {list(payload['step_outputs'].keys())}")
    return True


def test_webhook_step_exclude_steps():
    """Test that excluded steps are not included in payload."""
    logger.info("Testing webhook step exclusion...")
    
    service = WebhookStepService()
    
    step_outputs = [
        {'step_name': 'Step 1', 'output': 'Output 1', 'artifact_id': 'art_1', 'image_urls': []},
        {'step_name': 'Step 2', 'output': 'Output 2', 'artifact_id': 'art_2', 'image_urls': []},
        {'step_name': 'Step 3', 'output': 'Output 3', 'artifact_id': 'art_3', 'image_urls': []}
    ]
    
    sorted_steps = [
        {'step_name': 'Step 1', 'step_order': 0},
        {'step_name': 'Step 2', 'step_order': 1},
        {'step_name': 'Step 3', 'step_order': 2},
        {'step_name': 'Webhook Step', 'step_order': 3}
    ]
    
    data_selection = {
        'include_submission': True,
        'include_job_info': True,
        'exclude_step_indices': [1]  # Exclude step 1
    }
    
    payload = service._build_webhook_payload(
        job_id='test_job',
        job={'job_id': 'test_job'},
        submission={'submission_data': {}},
        step_outputs=step_outputs,
        sorted_steps=sorted_steps,
        step_index=3,
        data_selection=data_selection
    )
    
    # Step 0 should be included
    assert 'step_0' in payload['step_outputs'], "Step 0 should be included"
    
    # Step 1 should be excluded
    assert 'step_1' not in payload['step_outputs'], "Step 1 should be excluded"
    
    # Step 2 should be included
    assert 'step_2' in payload['step_outputs'], "Step 2 should be included"
    
    logger.info("✅ Step exclusion test passed!")
    return True


@patch('services.webhook_step_service.requests.post')
def test_webhook_step_execution_success(mock_post):
    """Test successful webhook step execution."""
    logger.info("Testing webhook step execution (success case)...")
    
    # Mock successful HTTP response
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.text = '{"status": "ok"}'
    mock_response.raise_for_status = Mock()
    mock_post.return_value = mock_response
    
    service = WebhookStepService()
    
    step = {
        'step_name': 'Test Webhook',
        'webhook_url': 'https://example.com/webhook',
        'webhook_headers': {'X-Custom': 'value'},
        'webhook_data_selection': {
            'include_submission': True,
            'include_job_info': True,
            'exclude_step_indices': []
        }
    }
    
    result, success = service.execute_webhook_step(
        step=step,
        step_index=0,
        job_id='test_job',
        job={'job_id': 'test_job'},
        submission={'submission_data': {}},
        step_outputs=[],
        sorted_steps=[step]
    )
    
    assert success, "Webhook should succeed"
    assert result['success'] is True
    assert result['response_status'] == 200
    assert result['webhook_url'] == 'https://example.com/webhook'
    assert 'payload' in result
    
    # Verify request was made correctly
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert call_args[0][0] == 'https://example.com/webhook'
    assert 'json' in call_args[1]
    assert 'headers' in call_args[1]
    assert call_args[1]['headers']['X-Custom'] == 'value'
    assert call_args[1]['headers']['Content-Type'] == 'application/json'
    
    logger.info("✅ Webhook execution success test passed!")
    return True


@patch('services.webhook_step_service.requests.post')
def test_webhook_step_execution_failure(mock_post):
    """Test webhook step execution failure handling."""
    logger.info("Testing webhook step execution (failure case)...")
    
    # Mock failed HTTP response
    import requests
    mock_response = Mock()
    mock_response.status_code = 500
    mock_response.text = 'Internal Server Error'
    mock_error = requests.exceptions.HTTPError()
    mock_error.response = mock_response
    mock_post.side_effect = mock_error
    
    service = WebhookStepService()
    
    step = {
        'step_name': 'Test Webhook',
        'webhook_url': 'https://example.com/webhook',
        'webhook_headers': {},
        'webhook_data_selection': {
            'include_submission': True,
            'include_job_info': True,
            'exclude_step_indices': []
        }
    }
    
    result, success = service.execute_webhook_step(
        step=step,
        step_index=0,
        job_id='test_job',
        job={'job_id': 'test_job'},
        submission={'submission_data': {}},
        step_outputs=[],
        sorted_steps=[step]
    )
    
    assert not success, "Webhook should fail"
    assert result['success'] is False
    assert result['response_status'] == 500
    assert 'error' in result
    
    logger.info("✅ Webhook execution failure test passed!")
    return True


def main():
    """Run all webhook step unit tests."""
    logger.info("=" * 80)
    logger.info("Unit Tests: Webhook Step Feature")
    logger.info("=" * 80)
    
    tests = [
        ("Payload Structure", test_webhook_step_payload_structure),
        ("Step Exclusion", test_webhook_step_exclude_steps),
        ("Execution Success", test_webhook_step_execution_success),
        ("Execution Failure", test_webhook_step_execution_failure),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        logger.info(f"\n{'=' * 80}")
        logger.info(f"Running: {test_name}")
        logger.info(f"{'=' * 80}")
        
        try:
            if test_func():
                passed += 1
                logger.info(f"✅ {test_name} PASSED")
            else:
                failed += 1
                logger.error(f"❌ {test_name} FAILED")
        except AssertionError as e:
            failed += 1
            logger.error(f"❌ {test_name} FAILED: {e}")
        except Exception as e:
            failed += 1
            logger.error(f"❌ {test_name} FAILED with exception: {e}", exc_info=True)
    
    logger.info(f"\n{'=' * 80}")
    logger.info(f"Test Results: {passed} passed, {failed} failed")
    logger.info(f"{'=' * 80}")
    
    if failed == 0:
        logger.info("🎉 All unit tests PASSED! Webhook step feature is working correctly.")
        return 0
    else:
        logger.error(f"❌ {failed} test(s) FAILED")
        return 1


if __name__ == '__main__':
    sys.exit(main())

