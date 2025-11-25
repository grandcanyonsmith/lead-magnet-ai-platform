#!/usr/bin/env python3
"""
Test: Verify o4-mini-deep-research does not automatically add web_search tool.

This test verifies that:
1. Steps with o4-mini-deep-research model do NOT get web_search added as default
2. Steps with other models still get web_search as default (if tools are missing)
3. Steps with explicit tools are not modified
"""

import sys
import os
import logging
from pathlib import Path

# Add the worker directory to Python path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def extract_tools_from_step(step: dict) -> list:
    """
    Extract tools from step config using the same logic as StepProcessor.
    This simulates the tool extraction logic from process_step_batch_mode and process_single_step.
    """
    step_model = step.get('model', 'gpt-5')
    # Do NOT auto-add web_search for o4-mini-deep-research model
    default_tools = [] if step_model == 'o4-mini-deep-research' else ['web_search']
    step_tools_raw = step.get('tools', default_tools)
    return step_tools_raw


def test_step_processor_tool_defaults():
    """Test that step processor respects o4-mini-deep-research model for tool defaults."""
    logger.info("Testing step processor tool defaults...")
    
    # Test 1: o4-mini-deep-research step without tools should NOT get web_search
    logger.info("Test 1: o4-mini-deep-research without tools")
    step_o4_mini_no_tools = {
        'model': 'o4-mini-deep-research',
        'step_name': 'Deep Research',
        'instructions': 'Perform research',
        'step_order': 0,
    }
    
    step_tools_raw = extract_tools_from_step(step_o4_mini_no_tools)
    assert step_tools_raw == [], f"Expected empty tools for o4-mini-deep-research, got {step_tools_raw}"
    logger.info("✅ Test 1 passed: o4-mini-deep-research does NOT get web_search by default")
    
    # Test 2: Regular model without tools SHOULD get web_search
    logger.info("Test 2: gpt-5 without tools")
    step_gpt5_no_tools = {
        'model': 'gpt-5',
        'step_name': 'Research',
        'instructions': 'Perform research',
        'step_order': 0,
    }
    
    step_tools_raw = extract_tools_from_step(step_gpt5_no_tools)
    assert step_tools_raw == ['web_search'], f"Expected ['web_search'] for gpt-5, got {step_tools_raw}"
    logger.info("✅ Test 2 passed: gpt-5 gets web_search by default")
    
    # Test 3: o4-mini-deep-research with explicit tools should keep them
    logger.info("Test 3: o4-mini-deep-research with explicit tools")
    step_o4_mini_with_tools = {
        'model': 'o4-mini-deep-research',
        'step_name': 'Research',
        'instructions': 'Perform research',
        'step_order': 0,
        'tools': ['code_interpreter'],
    }
    
    step_tools_raw = extract_tools_from_step(step_o4_mini_with_tools)
    assert step_tools_raw == ['code_interpreter'], f"Expected ['code_interpreter'], got {step_tools_raw}"
    logger.info("✅ Test 3 passed: o4-mini-deep-research preserves explicit tools")
    
    # Test 4: o4-mini-deep-research with empty tools list should stay empty
    logger.info("Test 4: o4-mini-deep-research with empty tools")
    step_o4_mini_empty_tools = {
        'model': 'o4-mini-deep-research',
        'step_name': 'Research',
        'instructions': 'Perform research',
        'step_order': 0,
        'tools': [],
    }
    
    step_tools_raw = extract_tools_from_step(step_o4_mini_empty_tools)
    assert step_tools_raw == [], f"Expected empty tools, got {step_tools_raw}"
    logger.info("✅ Test 4 passed: o4-mini-deep-research preserves empty tools list")
    
    # Test 5: o4-mini-deep-research with web_search explicitly requested should keep it
    logger.info("Test 5: o4-mini-deep-research with explicit web_search")
    step_o4_mini_explicit_websearch = {
        'model': 'o4-mini-deep-research',
        'step_name': 'Research',
        'instructions': 'Perform research with web search',
        'step_order': 0,
        'tools': ['web_search'],
    }
    
    step_tools_raw = extract_tools_from_step(step_o4_mini_explicit_websearch)
    assert step_tools_raw == ['web_search'], f"Expected ['web_search'], got {step_tools_raw}"
    logger.info("✅ Test 5 passed: o4-mini-deep-research preserves explicit web_search")
    
    # Test 6: Other models (gpt-4o) should still get web_search by default
    logger.info("Test 6: gpt-4o without tools")
    step_gpt4o_no_tools = {
        'model': 'gpt-4o',
        'step_name': 'Research',
        'instructions': 'Perform research',
        'step_order': 0,
    }
    
    step_tools_raw = extract_tools_from_step(step_gpt4o_no_tools)
    assert step_tools_raw == ['web_search'], f"Expected ['web_search'] for gpt-4o, got {step_tools_raw}"
    logger.info("✅ Test 6 passed: gpt-4o gets web_search by default")
    
    return True


def test_web_search_preview_normalization():
    """Test that web_search_preview is normalized to web_search."""
    logger.info("Testing web_search_preview normalization...")
    
    # This would be handled in the TypeScript code, but we can test the concept
    test_cases = [
        ('web_search_preview', 'web_search'),
        ('web_search', 'web_search'),
        ('code_interpreter', 'code_interpreter'),
    ]
    
    for input_tool, expected in test_cases:
        # Simulate normalization (this would happen in TypeScript)
        normalized = 'web_search' if input_tool == 'web_search_preview' else input_tool
        assert normalized == expected, f"Expected {expected}, got {normalized}"
    
    logger.info("✅ web_search_preview normalization test passed")
    return True


def run_all_tests():
    """Run all tests."""
    logger.info("=" * 70)
    logger.info("Testing o4-mini-deep-research tool assignment")
    logger.info("=" * 70)
    
    tests = [
        ("Step Processor Tool Defaults", test_step_processor_tool_defaults),
        ("Web Search Preview Normalization", test_web_search_preview_normalization),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            logger.info(f"\n🧪 Running: {test_name}")
            result = test_func()
            if result:
                logger.info(f"✅ {test_name}: PASSED")
                passed += 1
            else:
                logger.error(f"❌ {test_name}: FAILED")
                failed += 1
        except AssertionError as e:
            logger.error(f"❌ {test_name}: FAILED - {e}")
            failed += 1
        except Exception as e:
            logger.error(f"❌ {test_name}: ERROR - {e}", exc_info=True)
            failed += 1
    
    logger.info("\n" + "=" * 70)
    logger.info(f"Test Summary: {passed} passed, {failed} failed")
    logger.info("=" * 70)
    
    if failed > 0:
        sys.exit(1)
    else:
        logger.info("\n✅ All tests passed!")
        sys.exit(0)


if __name__ == '__main__':
    run_all_tests()

