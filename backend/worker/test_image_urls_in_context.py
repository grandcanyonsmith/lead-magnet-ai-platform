#!/usr/bin/env python3
"""
Test that converted base64 image URLs are passed to subsequent steps.
This verifies the full flow: base64 conversion -> execution step storage -> context building.
"""

import sys
import os
import json
import base64
import logging
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch

# Add the worker directory to Python path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_test_base64_image():
    """Create a small test PNG image in base64."""
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


def test_execution_step_stores_image_urls():
    """Test that execution steps store image URLs from response_details."""
    logger.info("Testing execution step storage of image URLs...")
    
    try:
        from services.execution_step_manager import ExecutionStepManager
        from datetime import datetime
        
        # Create mock response_details with image URLs (simulating base64 conversion)
        response_details = {
            'output_text': '{"assets": [{"id": "img1", "data": "https://example.com/img1.png"}]}',
            'image_urls': ['https://example.com/img1.png', 'https://example.com/img2.png'],
            'usage': {'input_tokens': 100, 'output_tokens': 200, 'total_tokens': 300},
            'model': 'gpt-5'
        }
        
        # Create execution step
        step_data = ExecutionStepManager.create_ai_generation_step(
            step_name='Visual Asset Generation',
            step_order=1,
            step_model='gpt-5',
            request_details={'model': 'gpt-5'},
            response_details=response_details,
            usage_info={'input_tokens': 100, 'output_tokens': 200},
            step_start_time=datetime.utcnow(),
            step_duration=1000.0,
            artifact_id='art_123'
        )
        
        # Verify image URLs are stored
        assert 'image_urls' in step_data, "Execution step should have image_urls field"
        assert step_data['image_urls'] == ['https://example.com/img1.png', 'https://example.com/img2.png'], \
            f"Expected 2 image URLs, got {step_data['image_urls']}"
        
        logger.info("✅ Execution step storage test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Execution step storage test FAILED: {e}", exc_info=True)
        return False


def test_context_builder_includes_image_urls():
    """Test that context builder includes image URLs from execution steps."""
    logger.info("Testing context builder includes image URLs...")
    
    try:
        from services.context_builder import ContextBuilder
        
        # Create mock execution steps with image URLs
        execution_steps = [
            {
                'step_name': 'Visual Asset Generation',
                'step_order': 1,
                'step_type': 'ai_generation',
                'output': 'Generated visual assets',
                'image_urls': ['https://example.com/img1.png', 'https://example.com/img2.png']
            },
            {
                'step_name': 'Content Writing',
                'step_order': 2,
                'step_type': 'ai_generation',
                'output': 'Generated content',
                'image_urls': []  # No images in this step
            }
        ]
        
        initial_context = "Form submission data"
        
        # Build context for step 3 (should include steps 1 and 2)
        context = ContextBuilder.build_previous_context_from_execution_steps(
            initial_context=initial_context,
            execution_steps=execution_steps,
            current_step_order=3,
            dependency_indices=None  # Include all previous steps
        )
        
        # Verify image URLs are included in context
        assert 'Generated Images:' in context, "Context should include 'Generated Images:' section"
        assert 'https://example.com/img1.png' in context, "Context should include first image URL"
        assert 'https://example.com/img2.png' in context, "Context should include second image URL"
        assert 'Step 1: Visual Asset Generation' in context, "Context should include step 1"
        assert 'Step 2: Content Writing' in context, "Context should include step 2"
        
        # Verify format
        lines = context.split('\n')
        generated_images_section = False
        for i, line in enumerate(lines):
            if 'Generated Images:' in line:
                generated_images_section = True
                # Next lines should be image URLs
                assert i + 1 < len(lines), "Should have image URLs after 'Generated Images:'"
                assert '- https://example.com/img1.png' in lines[i+1] or '- https://example.com/img1.png' in lines[i+2], \
                    "Image URLs should be formatted with '-' prefix"
                break
        
        assert generated_images_section, "Should have found 'Generated Images:' section"
        
        logger.info("✅ Context builder test PASSED")
        logger.info(f"Context preview (first 500 chars):\n{context[:500]}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Context builder test FAILED: {e}", exc_info=True)
        return False


def test_full_flow_simulation():
    """Simulate the full flow: base64 conversion -> execution step -> context building."""
    logger.info("Testing full flow simulation...")
    
    try:
        from services.openai_client import OpenAIClient
        from services.execution_step_manager import ExecutionStepManager
        from services.context_builder import ContextBuilder
        from datetime import datetime
        
        # Step 1: Simulate base64 image conversion
        mock_image_handler = Mock()
        mock_image_handler.upload_base64_image_to_s3 = Mock(side_effect=[
            "https://cloudfront.example.com/tenant/job/img1.png",
            "https://cloudfront.example.com/tenant/job/img2.png"
        ])
        
        client = OpenAIClient()
        
        # Create JSON with base64 images
        base64_image = create_test_base64_image()
        json_with_base64 = json.dumps({
            "assets": [
                {
                    "id": "img1",
                    "name": "image1.png",
                    "content_type": "image/png",
                    "encoding": "base64",
                    "data": base64_image
                },
                {
                    "id": "img2",
                    "name": "image2.png",
                    "content_type": "image/png",
                    "encoding": "base64",
                    "data": base64_image
                }
            ]
        })
        
        # Convert base64 to URLs
        updated_content, image_urls = client._extract_and_convert_base64_images(
            content=json_with_base64,
            image_handler=mock_image_handler,
            tenant_id="test_tenant",
            job_id="test_job"
        )
        
        assert len(image_urls) == 2, f"Expected 2 URLs, got {len(image_urls)}"
        assert mock_image_handler.upload_base64_image_to_s3.call_count == 2
        
        # Step 2: Create execution step with converted URLs
        response_details = {
            'output_text': updated_content,
            'image_urls': image_urls,
            'usage': {'input_tokens': 100, 'output_tokens': 200, 'total_tokens': 300},
            'model': 'gpt-5'
        }
        
        execution_step = ExecutionStepManager.create_ai_generation_step(
            step_name='Visual Asset Generation',
            step_order=1,
            step_model='gpt-5',
            request_details={'model': 'gpt-5'},
            response_details=response_details,
            usage_info={'input_tokens': 100, 'output_tokens': 200},
            step_start_time=datetime.utcnow(),
            step_duration=1000.0,
            artifact_id='art_123'
        )
        
        assert execution_step['image_urls'] == image_urls, "Execution step should store converted URLs"
        
        # Step 3: Build context for next step
        context = ContextBuilder.build_previous_context_from_execution_steps(
            initial_context="Form data",
            execution_steps=[execution_step],
            current_step_order=2,
            dependency_indices=None
        )
        
        # Verify URLs are in context
        assert image_urls[0] in context, "First URL should be in context"
        assert image_urls[1] in context, "Second URL should be in context"
        assert 'Generated Images:' in context, "Context should include image section"
        
        logger.info("✅ Full flow simulation test PASSED")
        logger.info(f"Image URLs in context: {image_urls}")
        logger.info(f"Context includes URLs: {all(url in context for url in image_urls)}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Full flow simulation test FAILED: {e}", exc_info=True)
        return False


def test_dependency_context_filtering():
    """Test that dependency indices filter context to only required steps."""
    logger.info("Testing dependency-aware context filtering...")

    try:
        from services.context_builder import ContextBuilder

        step_outputs = [
            {"step_name": "Alpha", "step_index": 0, "output": "A", "image_urls": []},
            {"step_name": "Beta", "step_index": 1, "output": "B", "image_urls": []},
            {"step_name": "Gamma", "step_index": 2, "output": "C", "image_urls": []},
        ]
        sorted_steps = [
            {"step_name": "Alpha"},
            {"step_name": "Beta"},
            {"step_name": "Gamma"},
        ]

        dependency_context = ContextBuilder.build_previous_context_from_step_outputs(
            initial_context="",
            step_outputs=step_outputs,
            sorted_steps=sorted_steps,
            dependency_indices=[0, 2],
            include_form_submission=False,
        )

        assert "Alpha" in dependency_context, "Dependency context should include Alpha"
        assert "Gamma" in dependency_context, "Dependency context should include Gamma"
        assert "Beta" not in dependency_context, "Dependency context should exclude Beta"

        execution_steps = [
            {
                "step_name": "Alpha",
                "step_order": 1,
                "step_type": "ai_generation",
                "output": "A",
                "image_urls": [],
            },
            {
                "step_name": "Beta",
                "step_order": 2,
                "step_type": "ai_generation",
                "output": "B",
                "image_urls": [],
            },
            {
                "step_name": "Gamma",
                "step_order": 3,
                "step_type": "ai_generation",
                "output": "C",
                "image_urls": [],
            },
        ]

        dependency_context_exec = ContextBuilder.build_previous_context_from_execution_steps(
            initial_context="",
            execution_steps=execution_steps,
            current_step_order=4,
            dependency_indices=[0, 2],
            include_form_submission=False,
        )

        assert "Step 1: Alpha" in dependency_context_exec, "Execution context should include Alpha"
        assert "Step 3: Gamma" in dependency_context_exec, "Execution context should include Gamma"
        assert "Step 2: Beta" not in dependency_context_exec, "Execution context should exclude Beta"

        logger.info("✅ Dependency context filtering test PASSED")
        return True
    except Exception as e:
        logger.error(f"❌ Dependency context filtering test FAILED: {e}", exc_info=True)
        return False


def main():
    """Run all tests."""
    logger.info("=" * 80)
    logger.info("Testing Image URLs in Context Flow")
    logger.info("=" * 80)
    
    tests = [
        ("Execution Step Stores Image URLs", test_execution_step_stores_image_urls),
        ("Context Builder Includes Image URLs", test_context_builder_includes_image_urls),
        ("Full Flow Simulation", test_full_flow_simulation),
        ("Dependency Context Filtering", test_dependency_context_filtering),
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
        except Exception as e:
            failed += 1
            logger.error(f"❌ {test_name} FAILED with exception: {e}", exc_info=True)
    
    logger.info(f"\n{'=' * 80}")
    logger.info(f"Test Results: {passed} passed, {failed} failed")
    logger.info(f"{'=' * 80}")
    
    if failed == 0:
        logger.info("🎉 All tests PASSED! Image URLs are being passed to next steps.")
        return 0
    else:
        logger.error(f"❌ {failed} test(s) FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())

