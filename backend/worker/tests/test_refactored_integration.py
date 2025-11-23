#!/usr/bin/env python3
"""
End-to-end integration tests for refactored backend services.

Tests that all refactored services work together correctly:
- OpenAI client services integration
- Step processor services integration
- Image utils integration
- Full workflow processing
"""

import sys
import os
import logging
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import pytest

# Add the worker directory to Python path
worker_dir = Path(__file__).parent.parent
sys.path.insert(0, str(worker_dir))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_openai_client_integration():
    """Test that OpenAI client services work together."""
    from services.openai_client import OpenAIClient
    from services.openai_input_builder import OpenAIInputBuilder
    from services.openai_image_handler import OpenAIImageHandler
    from services.openai_api_client import OpenAIAPIClient
    from services.openai_response_processor import OpenAIResponseProcessor
    from services.openai_error_handler import OpenAIErrorHandler
    
    with patch('services.api_key_manager.APIKeyManager.get_openai_key', return_value="test-key"), \
         patch('openai.OpenAI'):
        
        client = OpenAIClient()
        
        # Verify all services are initialized
        assert isinstance(client.image_handler, OpenAIImageHandler)
        assert isinstance(client.input_builder, OpenAIInputBuilder)
        assert isinstance(client.api_client, OpenAIAPIClient)
        assert isinstance(client.response_processor, OpenAIResponseProcessor)
        assert isinstance(client.error_handler, OpenAIErrorHandler)
        
        # Test that facade methods delegate correctly
        with patch.object(client.input_builder, 'build_api_params') as mock_build:
            mock_build.return_value = {"model": "gpt-5", "input": "test"}
            result = client.build_api_params(
                model="gpt-5",
                instructions="Test",
                input_text="test"
            )
            assert result == {"model": "gpt-5", "input": "test"}
            mock_build.assert_called_once()


def test_step_processor_integration():
    """Test that step processor services work together."""
    from services.step_processor import StepProcessor
    from services.ai_step_processor import AIStepProcessor
    from services.dependency_validation_service import DependencyValidationService
    from services.step_context_service import StepContextService
    from services.execution_step_coordinator import ExecutionStepCoordinator
    from services.step_output_builder import StepOutputBuilder
    
    mock_ai_service = Mock()
    mock_artifact_service = Mock()
    mock_db = Mock()
    mock_s3 = Mock()
    mock_usage_service = Mock()
    mock_image_artifact_service = Mock()
    
    processor = StepProcessor(
        ai_service=mock_ai_service,
        artifact_service=mock_artifact_service,
        db_service=mock_db,
        s3_service=mock_s3,
        usage_service=mock_usage_service,
        image_artifact_service=mock_image_artifact_service
    )
    
    # Verify all services are initialized
    assert isinstance(processor.ai_step_processor, AIStepProcessor)
    assert isinstance(processor.dependency_validator, DependencyValidationService)
    assert isinstance(processor.context_service, StepContextService)
    assert isinstance(processor.execution_coordinator, ExecutionStepCoordinator)
    assert isinstance(processor.output_builder, StepOutputBuilder)


def test_image_utils_integration():
    """Test that image utility modules work together."""
    from utils import image_utils
    from utils.image_extraction import extract_image_urls
    from utils.image_validation import validate_and_filter_image_urls
    from utils.image_conversion import download_image_and_convert_to_data_url
    
    # Test full pipeline using re-exported functions
    text = "Check https://example.com/image.jpg"
    
    # Extract
    urls = image_utils.extract_image_urls(text)
    assert len(urls) == 1
    
    # Validate
    valid_urls, filtered = image_utils.validate_and_filter_image_urls(urls)
    assert len(valid_urls) == 1
    
    # Convert (mocked)
    with patch('requests.get') as mock_get:
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'\x89PNG\r\n\x1a\n'
        mock_response.headers = {'Content-Type': 'image/png'}
        mock_get.return_value = mock_response
        
        with patch('utils.image_validation.validate_image_bytes', return_value=(True, "png", None)):
            data_url = image_utils.download_image_and_convert_to_data_url(valid_urls[0])
            assert data_url is not None


def test_full_workflow_processing():
    """Test full workflow processing with refactored services."""
    from services.step_processor import StepProcessor
    from core.ai_service import AIService
    
    mock_ai_service = Mock(spec=AIService)
    mock_artifact_service = Mock()
    mock_db = Mock()
    mock_s3 = Mock()
    mock_usage_service = Mock()
    mock_image_artifact_service = Mock()
    
    # Mock job data
    mock_db.get_job.return_value = {
        "job_id": "test_job",
        "tenant_id": "test_tenant",
        "execution_steps": []
    }
    
    processor = StepProcessor(
        ai_service=mock_ai_service,
        artifact_service=mock_artifact_service,
        db_service=mock_db,
        s3_service=mock_s3,
        usage_service=mock_usage_service,
        image_artifact_service=mock_image_artifact_service
    )
    
    # Mock AI step processor
    processor.ai_step_processor.process_ai_step = Mock(return_value=(
        "Test output",
        {"input_tokens": 10, "output_tokens": 20},
        {"model": "gpt-5"},
        {"response_id": "test_id", "image_urls": []},
        [],
        "artifact_id"
    ))
    
    # Test batch mode processing
    step = {
        "step_name": "Test Step",
        "model": "gpt-5",
        "instructions": "Test instructions",
        "step_type": "ai_generation",
        "step_order": 1
    }
    
    sorted_steps = [step]
    execution_steps = []
    step_outputs = []
    
    step_output_dict, image_artifact_ids = processor.process_step_batch_mode(
        step=step,
        step_index=0,
        job_id="test_job",
        tenant_id="test_tenant",
        initial_context="Initial context",
        step_outputs=step_outputs,
        sorted_steps=sorted_steps,
        execution_steps=execution_steps,
        all_image_artifact_ids=[]
    )
    
    # Verify step was processed
    assert step_output_dict["step_name"] == "Test Step"
    assert step_output_dict["step_output"] == "Test output"
    assert len(execution_steps) == 1
    assert execution_steps[0]["step_name"] == "Test Step"
    
    # Verify services were called
    processor.ai_step_processor.process_ai_step.assert_called_once()


def test_workflow_with_image_generation():
    """Test workflow processing with image generation step."""
    from services.step_processor import StepProcessor
    
    mock_ai_service = Mock()
    mock_artifact_service = Mock()
    mock_db = Mock()
    mock_s3 = Mock()
    mock_usage_service = Mock()
    mock_image_artifact_service = Mock()
    
    mock_db.get_job.return_value = {
        "job_id": "test_job",
        "tenant_id": "test_tenant",
        "execution_steps": []
    }
    
    processor = StepProcessor(
        ai_service=mock_ai_service,
        artifact_service=mock_artifact_service,
        db_service=mock_db,
        s3_service=mock_s3,
        usage_service=mock_usage_service,
        image_artifact_service=mock_image_artifact_service
    )
    
    # Mock AI step processor with image URLs
    processor.ai_step_processor.process_ai_step = Mock(return_value=(
        "Test output with image",
        {"input_tokens": 10, "output_tokens": 20},
        {"model": "gpt-5"},
        {"response_id": "test_id", "image_urls": ["https://example.com/image.jpg"]},
        ["img_artifact_id"],
        "artifact_id"
    ))
    
    step = {
        "step_name": "Image Generation Step",
        "model": "gpt-5",
        "instructions": "Generate an image",
        "step_type": "ai_generation",
        "tools": [{"type": "image_generation"}]
    }
    
    sorted_steps = [step]
    execution_steps = []
    step_outputs = []
    
    step_output_dict, image_artifact_ids = processor.process_step_batch_mode(
        step=step,
        step_index=0,
        job_id="test_job",
        tenant_id="test_tenant",
        initial_context="Initial context",
        step_outputs=step_outputs,
        sorted_steps=sorted_steps,
        execution_steps=execution_steps,
        all_image_artifact_ids=[]
    )
    
    # Verify image URLs are in output
    assert "image_urls" in step_output_dict
    assert len(step_output_dict["image_urls"]) == 1
    assert len(image_artifact_ids) == 1


def test_workflow_with_webhook_step():
    """Test workflow processing with webhook step."""
    from services.step_processor import StepProcessor
    
    mock_ai_service = Mock()
    mock_artifact_service = Mock()
    mock_db = Mock()
    mock_s3 = Mock()
    mock_usage_service = Mock()
    mock_image_artifact_service = Mock()
    
    mock_db.get_job.return_value = {
        "job_id": "test_job",
        "tenant_id": "test_tenant"
    }
    
    processor = StepProcessor(
        ai_service=mock_ai_service,
        artifact_service=mock_artifact_service,
        db_service=mock_db,
        s3_service=mock_s3,
        usage_service=mock_usage_service,
        image_artifact_service=mock_image_artifact_service
    )
    
    # Mock webhook step service
    processor.webhook_step_service.execute_webhook_step = Mock(return_value=(
        {
            "webhook_url": "https://example.com/webhook",
            "response_status": 200,
            "response_body": "OK",
            "duration_ms": 100
        },
        True
    ))
    
    step = {
        "step_name": "Webhook Step",
        "step_type": "webhook",
        "webhook_url": "https://example.com/webhook"
    }
    
    sorted_steps = [step]
    execution_steps = []
    step_outputs = []
    
    with patch('services.step_processor.get_submission_data', return_value={"submission_data": {}}):
        step_output_dict, image_artifact_ids = processor.process_step_batch_mode(
            step=step,
            step_index=0,
            job_id="test_job",
            tenant_id="test_tenant",
            initial_context="Initial context",
            step_outputs=step_outputs,
            sorted_steps=sorted_steps,
            execution_steps=execution_steps,
            all_image_artifact_ids=[]
        )
        
        # Verify webhook step was processed
        assert step_output_dict["step_name"] == "Webhook Step"
        assert "webhook" in step_output_dict["step_output"].lower()
        assert len(execution_steps) == 1
        assert execution_steps[0]["step_type"] == "webhook"


def test_error_propagation_through_layers():
    """Test that errors propagate correctly through refactored layers."""
    from services.step_processor import StepProcessor
    
    mock_ai_service = Mock()
    mock_artifact_service = Mock()
    mock_db = Mock()
    mock_s3 = Mock()
    mock_usage_service = Mock()
    mock_image_artifact_service = Mock()
    
    processor = StepProcessor(
        ai_service=mock_ai_service,
        artifact_service=mock_artifact_service,
        db_service=mock_db,
        s3_service=mock_s3,
        usage_service=mock_usage_service,
        image_artifact_service=mock_image_artifact_service
    )
    
    # Mock AI step processor to raise an error
    processor.ai_step_processor.process_ai_step = Mock(side_effect=Exception("AI service error"))
    
    step = {
        "step_name": "Test Step",
        "model": "gpt-5",
        "instructions": "Test",
        "step_type": "ai_generation"
    }
    
    sorted_steps = [step]
    execution_steps = []
    step_outputs = []
    
    # Should propagate error
    with pytest.raises(Exception, match="AI service error"):
        processor.process_step_batch_mode(
            step=step,
            step_index=0,
            job_id="test_job",
            tenant_id="test_tenant",
            initial_context="Initial context",
            step_outputs=step_outputs,
            sorted_steps=sorted_steps,
            execution_steps=execution_steps,
            all_image_artifact_ids=[]
        )


def test_multiple_steps_processing():
    """Test processing multiple steps in sequence."""
    from services.step_processor import StepProcessor
    
    mock_ai_service = Mock()
    mock_artifact_service = Mock()
    mock_db = Mock()
    mock_s3 = Mock()
    mock_usage_service = Mock()
    mock_image_artifact_service = Mock()
    
    mock_db.get_job.return_value = {
        "job_id": "test_job",
        "tenant_id": "test_tenant",
        "execution_steps": []
    }
    
    processor = StepProcessor(
        ai_service=mock_ai_service,
        artifact_service=mock_artifact_service,
        db_service=mock_db,
        s3_service=mock_s3,
        usage_service=mock_usage_service,
        image_artifact_service=mock_image_artifact_service
    )
    
    # Mock AI step processor
    def mock_process_ai_step(*args, **kwargs):
        step_index = kwargs.get('step_index', args[1])
        return (
            f"Output for step {step_index + 1}",
            {"input_tokens": 10, "output_tokens": 20},
            {"model": "gpt-5"},
            {"response_id": f"test_id_{step_index}", "image_urls": []},
            [],
            f"artifact_id_{step_index}"
        )
    
    processor.ai_step_processor.process_ai_step = Mock(side_effect=mock_process_ai_step)
    
    # Process multiple steps
    steps = [
        {"step_name": "Step 1", "model": "gpt-5", "instructions": "First", "step_type": "ai_generation", "step_order": 1},
        {"step_name": "Step 2", "model": "gpt-5", "instructions": "Second", "step_type": "ai_generation", "step_order": 2}
    ]
    
    execution_steps = []
    step_outputs = []
    all_image_artifact_ids = []
    
    # Process first step
    step_output_1, image_ids_1 = processor.process_step_batch_mode(
        step=steps[0],
        step_index=0,
        job_id="test_job",
        tenant_id="test_tenant",
        initial_context="Initial context",
        step_outputs=step_outputs,
        sorted_steps=steps,
        execution_steps=execution_steps,
        all_image_artifact_ids=all_image_artifact_ids
    )
    
    step_outputs.append(step_output_1)
    
    # Process second step (with previous step output)
    step_output_2, image_ids_2 = processor.process_step_batch_mode(
        step=steps[1],
        step_index=1,
        job_id="test_job",
        tenant_id="test_tenant",
        initial_context="Initial context",
        step_outputs=step_outputs,
        sorted_steps=steps,
        execution_steps=execution_steps,
        all_image_artifact_ids=all_image_artifact_ids
    )
    
    # Verify both steps were processed
    assert len(execution_steps) == 2
    assert execution_steps[0]["step_name"] == "Step 1"
    assert execution_steps[1]["step_name"] == "Step 2"
    assert processor.ai_step_processor.process_ai_step.call_count == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

