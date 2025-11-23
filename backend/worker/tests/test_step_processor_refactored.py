#!/usr/bin/env python3
"""
Unit and integration tests for refactored step processor services.

Tests the modular structure:
- AIStepProcessor
- DependencyValidationService
- StepContextService
- ExecutionStepCoordinator
- StepOutputBuilder
- StepProcessor (main coordinator)
"""

import sys
import logging
from pathlib import Path
from unittest.mock import Mock, patch
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


# ============================================================================
# DependencyValidationService Tests
# ============================================================================

def test_dependency_validation_service_normalize_dependencies():
    """Test DependencyValidationService.normalize_dependencies."""
    from services.dependency_validation_service import DependencyValidationService
    
    service = DependencyValidationService()
    
    # Test with explicit dependencies
    step = {"depends_on": [1, 2]}
    steps = [{"step_order": 1}, {"step_order": 2}, {"step_order": 3}]
    
    deps = service.normalize_dependencies(step, 2, steps)
    assert deps == [1, 2]
    
    # Test with auto-detection from step_order
    step = {"step_order": 3}
    steps = [
        {"step_order": 1},
        {"step_order": 2},
        {"step_order": 3}
    ]
    
    deps = service.normalize_dependencies(step, 2, steps)
    assert 0 in deps
    assert 1 in deps


def test_dependency_validation_service_get_completed_step_indices():
    """Test DependencyValidationService.get_completed_step_indices."""
    from services.dependency_validation_service import DependencyValidationService
    
    service = DependencyValidationService()
    
    execution_steps = [
        {"step_order": 1, "step_type": "ai_generation"},
        {"step_order": 2, "step_type": "webhook"},
        {"step_order": 3, "step_type": "ai_generation"}
    ]
    
    completed = service.get_completed_step_indices(execution_steps)
    assert 0 in completed  # step_order 1 -> index 0
    assert 1 in completed  # step_order 2 -> index 1
    assert 2 in completed  # step_order 3 -> index 2


def test_dependency_validation_service_validate_dependencies():
    """Test DependencyValidationService.validate_dependencies."""
    from services.dependency_validation_service import DependencyValidationService
    
    service = DependencyValidationService()
    
    step = {"step_name": "Step 3", "depends_on": [1, 2]}
    steps = [
        {"step_order": 1},
        {"step_order": 2},
        {"step_order": 3}
    ]
    execution_steps = [
        {"step_order": 1, "step_type": "ai_generation"},
        {"step_order": 2, "step_type": "ai_generation"}
    ]
    
    # Should not raise - dependencies are satisfied
    service.validate_dependencies(step, 2, steps, execution_steps, "test_job")
    
    # Should raise - dependency not satisfied
    execution_steps = [
        {"step_order": 1, "step_type": "ai_generation"}
    ]
    
    with pytest.raises(ValueError, match="Dependencies not satisfied"):
        service.validate_dependencies(step, 2, steps, execution_steps, "test_job")


# ============================================================================
# StepContextService Tests
# ============================================================================

def test_step_context_service_build_contexts_for_step():
    """Test StepContextService.build_contexts_for_step."""
    from services.step_context_service import StepContextService
    
    service = StepContextService()
    
    step = {"step_name": "Step 2"}
    initial_context = "Initial context"
    execution_steps = [
        {"step_order": 1, "step_type": "ai_generation", "step_output": "Output 1"}
    ]
    step_deps = [0]
    step_tools = []
    
    with patch('services.context_builder.ContextBuilder.build_previous_context_from_execution_steps', return_value="Previous context"), \
         patch('services.context_builder.ContextBuilder.get_current_step_context', return_value="Current context"), \
         patch('services.context_builder.ContextBuilder.collect_previous_image_urls', return_value=[]):
        
        previous_context, current_context, image_urls = service.build_contexts_for_step(
            step=step,
            step_index=1,
            initial_context=initial_context,
            execution_steps=execution_steps,
            step_deps=step_deps,
            step_tools=step_tools,
            job_id="test_job"
        )
        
        assert previous_context == "Previous context"
        assert current_context == "Current context"
        assert image_urls is None  # No image generation tool


def test_step_context_service_build_contexts_for_batch_mode():
    """Test StepContextService.build_contexts_for_batch_mode."""
    from services.step_context_service import StepContextService
    
    service = StepContextService()
    
    step = {"step_name": "Step 2"}
    initial_context = "Initial context"
    step_outputs = [{"step_name": "Step 1", "step_output": "Output 1"}]
    sorted_steps = [{"step_order": 1}, {"step_order": 2}]
    execution_steps = []
    step_tools = []
    
    with patch('services.context_builder.ContextBuilder.build_previous_context_from_step_outputs', return_value="Previous context"), \
         patch('services.context_builder.ContextBuilder.get_current_step_context', return_value="Current context"), \
         patch('services.context_builder.ContextBuilder.collect_previous_image_urls_from_step_outputs', return_value=[]):
        
        previous_context, current_context, image_urls = service.build_contexts_for_batch_mode(
            step=step,
            step_index=1,
            initial_context=initial_context,
            step_outputs=step_outputs,
            sorted_steps=sorted_steps,
            execution_steps=execution_steps,
            step_tools=step_tools,
            job_id="test_job"
        )
        
        assert previous_context == "Previous context"
        assert current_context == "Current context"
        assert image_urls is None


# ============================================================================
# AIStepProcessor Tests
# ============================================================================

def test_ai_step_processor_initialization():
    """Test AIStepProcessor initialization."""
    from services.ai_step_processor import AIStepProcessor
    
    mock_ai_service = Mock()
    mock_artifact_service = Mock()
    mock_usage_service = Mock()
    mock_image_artifact_service = Mock()
    
    processor = AIStepProcessor(
        ai_service=mock_ai_service,
        artifact_service=mock_artifact_service,
        usage_service=mock_usage_service,
        image_artifact_service=mock_image_artifact_service
    )
    
    assert processor.ai_service == mock_ai_service
    assert processor.artifact_service == mock_artifact_service
    assert processor.usage_service == mock_usage_service
    assert processor.image_artifact_service == mock_image_artifact_service


def test_ai_step_processor_process_ai_step():
    """Test AIStepProcessor.process_ai_step."""
    from services.ai_step_processor import AIStepProcessor
    
    mock_ai_service = Mock()
    mock_artifact_service = Mock()
    mock_usage_service = Mock()
    mock_image_artifact_service = Mock()
    
    # Mock AI service response
    mock_ai_service.generate_report.return_value = (
        "Test output",
        {"input_tokens": 10, "output_tokens": 20},
        {"model": "gpt-5"},
        {"response_id": "test_id"}
    )
    
    # Mock artifact creation
    mock_artifact_service.create_artifact.return_value = "artifact_id"
    
    processor = AIStepProcessor(
        ai_service=mock_ai_service,
        artifact_service=mock_artifact_service,
        usage_service=mock_usage_service,
        image_artifact_service=mock_image_artifact_service
    )
    
    step = {"step_name": "Test Step", "model": "gpt-5", "instructions": "Test"}
    
    result = processor.process_ai_step(
        step=step,
        step_index=0,
        job_id="test_job",
        tenant_id="test_tenant",
        initial_context="Initial",
        previous_context="Previous",
        current_step_context="Current",
        step_tools=[],
        step_tool_choice="auto",
        previous_image_urls=None
    )
    
    step_output, usage_info, request_details, response_details, image_artifact_ids, step_artifact_id = result
    
    assert step_output == "Test output"
    assert usage_info["input_tokens"] == 10
    assert step_artifact_id == "artifact_id"
    mock_ai_service.generate_report.assert_called_once()


# ============================================================================
# ExecutionStepCoordinator Tests
# ============================================================================

def test_execution_step_coordinator_create_and_add_step():
    """Test ExecutionStepCoordinator.create_and_add_step."""
    from services.execution_step_coordinator import ExecutionStepCoordinator
    
    mock_db = Mock()
    mock_s3 = Mock()
    
    coordinator = ExecutionStepCoordinator(mock_db, mock_s3)
    
    execution_steps = []
    request_details = {"model": "gpt-5"}
    response_details = {"response_id": "test_id"}
    usage_info = {"input_tokens": 10, "output_tokens": 20}
    step_start_time = datetime.utcnow()
    
    coordinator.create_and_add_step(
        step_name="Test Step",
        step_index=0,
        step_model="gpt-5",
        request_details=request_details,
        response_details=response_details,
        usage_info=usage_info,
        step_start_time=step_start_time,
        step_duration=1000.0,
        step_artifact_id="artifact_id",
        execution_steps=execution_steps,
        step_type="ai_generation"
    )
    
    assert len(execution_steps) == 1
    assert execution_steps[0]["step_name"] == "Test Step"
    assert execution_steps[0]["step_order"] == 1
    assert execution_steps[0]["step_type"] == "ai_generation"


def test_execution_step_coordinator_update_execution_steps():
    """Test ExecutionStepCoordinator.update_execution_steps."""
    from services.execution_step_coordinator import ExecutionStepCoordinator
    
    mock_db = Mock()
    mock_s3 = Mock()
    
    coordinator = ExecutionStepCoordinator(mock_db, mock_s3)
    
    execution_steps = []
    step_data = {
        "step_name": "Webhook Step",
        "step_order": 1,
        "step_type": "webhook",
        "webhook_url": "https://example.com/webhook"
    }
    
    coordinator.update_execution_steps(
        execution_steps=execution_steps,
        step_data=step_data,
        step_order=1,
        step_type="webhook"
    )
    
    assert len(execution_steps) == 1
    assert execution_steps[0]["step_name"] == "Webhook Step"


# ============================================================================
# StepOutputBuilder Tests
# ============================================================================

def test_step_output_builder_build_batch_mode_output():
    """Test StepOutputBuilder.build_batch_mode_output."""
    from services.step_output_builder import StepOutputBuilder
    
    builder = StepOutputBuilder()
    
    result = builder.build_batch_mode_output(
        step_name="Test Step",
        step_index=0,
        step_output="Test output",
        step_artifact_id="artifact_id",
        image_urls=["https://example.com/image.jpg"]
    )
    
    assert result["step_name"] == "Test Step"
    assert result["step_output"] == "Test output"
    assert result["step_artifact_id"] == "artifact_id"
    assert "image_urls" in result


def test_step_output_builder_build_single_mode_output():
    """Test StepOutputBuilder.build_single_mode_output."""
    from services.step_output_builder import StepOutputBuilder
    
    builder = StepOutputBuilder()
    
    result = builder.build_single_mode_output(
        step_name="Test Step",
        step_index=0,
        step_output="Test output",
        step_artifact_id="artifact_id",
        image_urls=["https://example.com/image.jpg"],
        image_artifact_ids=["img_artifact_id"],
        usage_info={"input_tokens": 10},
        duration_ms=1000,
        success=True
    )
    
    assert result["step_name"] == "Test Step"
    assert result["step_output"] == "Test output"
    assert result["success"] is True
    assert result["duration_ms"] == 1000


# ============================================================================
# StepProcessor Integration Tests
# ============================================================================

def test_step_processor_initialization():
    """Test StepProcessor initialization with dependency injection."""
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
    
    assert processor.ai_service == mock_ai_service
    assert processor.artifact_service == mock_artifact_service
    assert processor.db == mock_db
    assert processor.s3 == mock_s3
    assert hasattr(processor, 'dependency_validator')
    assert hasattr(processor, 'context_service')
    assert hasattr(processor, 'execution_coordinator')
    assert hasattr(processor, 'output_builder')


def test_step_processor_process_step_batch_mode():
    """Test StepProcessor.process_step_batch_mode end-to-end."""
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
    
    # Mock AI step processor
    processor.ai_step_processor.process_ai_step = Mock(return_value=(
        "Test output",
        {"input_tokens": 10},
        {"model": "gpt-5"},
        {"response_id": "test_id", "image_urls": []},
        [],
        "artifact_id"
    ))
    
    step = {
        "step_name": "Test Step",
        "model": "gpt-5",
        "instructions": "Test",
        "step_type": "ai_generation"
    }
    sorted_steps = [step]
    execution_steps = []
    
    step_output_dict, image_artifact_ids = processor.process_step_batch_mode(
        step=step,
        step_index=0,
        job_id="test_job",
        tenant_id="test_tenant",
        initial_context="Initial",
        step_outputs=[],
        sorted_steps=sorted_steps,
        execution_steps=execution_steps,
        all_image_artifact_ids=[]
    )
    
    assert step_output_dict["step_name"] == "Test Step"
    assert step_output_dict["step_output"] == "Test output"
    assert len(execution_steps) == 1


def test_step_processor_process_single_step():
    """Test StepProcessor.process_single_step end-to-end."""
    from services.step_processor import StepProcessor
    
    mock_ai_service = Mock()
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
        {"input_tokens": 10},
        {"model": "gpt-5"},
        {"response_id": "test_id", "image_urls": []},
        [],
        "artifact_id"
    ))
    
    step = {
        "step_name": "Test Step",
        "model": "gpt-5",
        "instructions": "Test",
        "step_type": "ai_generation",
        "step_order": 1
    }
    steps = [step]
    execution_steps = []
    
    result = processor.process_single_step(
        step=step,
        step_index=0,
        steps=steps,
        job_id="test_job",
        job={"job_id": "test_job", "tenant_id": "test_tenant"},
        initial_context="Initial",
        execution_steps=execution_steps
    )
    
    assert result["step_name"] == "Test Step"
    assert result["step_output"] == "Test output"
    assert result["success"] is True


def test_step_processor_process_webhook_step_batch_mode():
    """Test StepProcessor webhook step processing in batch mode."""
    from services.step_processor import StepProcessor
    
    mock_ai_service = Mock()
    mock_artifact_service = Mock()
    mock_db = Mock()
    mock_s3 = Mock()
    mock_usage_service = Mock()
    mock_image_artifact_service = Mock()
    
    # Mock job data
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
            "response_body": "OK"
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
    
    with patch('services.step_processor.get_submission_data', return_value={"submission_data": {}}):
        step_output_dict, image_artifact_ids = processor.process_step_batch_mode(
            step=step,
            step_index=0,
            job_id="test_job",
            tenant_id="test_tenant",
            initial_context="Initial",
            step_outputs=[],
            sorted_steps=sorted_steps,
            execution_steps=execution_steps,
            all_image_artifact_ids=[]
        )
        
        assert step_output_dict["step_name"] == "Webhook Step"
        assert "webhook" in step_output_dict["step_output"].lower()
        assert len(execution_steps) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

