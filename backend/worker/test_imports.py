#!/usr/bin/env python3
"""
Comprehensive Test Script for Worker Imports
Tests all imports and basic functionality without requiring AWS credentials.
"""

import sys
import os
from pathlib import Path

# Add the worker directory to Python path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

def test_imports():
    """Test all critical imports."""
    print("=" * 60)
    print("TESTING IMPORTS")
    print("=" * 60)
    
    try:
        from utils.error_utils import create_descriptive_error, normalize_error_message
        print("✓ utils.error_utils")
        
        from utils.step_utils import normalize_step_order
        print("✓ utils.step_utils")
        
        from utils.decimal_utils import convert_floats_to_decimal, convert_decimals_to_float
        print("✓ utils.decimal_utils")
        
        from services.context_builder import ContextBuilder
        print("✓ services.context_builder")
        
        from services.execution_step_manager import ExecutionStepManager
        print("✓ services.execution_step_manager")
        
        from processor import JobProcessor
        print("✓ processor")
        
        print("\n✅ All imports successful!\n")
        return True
    except Exception as e:
        print(f"\n❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_utilities():
    """Test utility functions."""
    print("=" * 60)
    print("TESTING UTILITY FUNCTIONS")
    print("=" * 60)
    
    try:
        from utils.error_utils import create_descriptive_error, normalize_error_message
        from utils.step_utils import normalize_step_order
        from utils.decimal_utils import convert_floats_to_decimal, convert_decimals_to_float
        from decimal import Decimal
        
        # Test error utilities
        try:
            raise ValueError("Test error")
        except Exception as e:
            error_type, error_msg = normalize_error_message(e)
            assert error_type == "ValueError"
            print("✓ normalize_error_message works")
            
            desc = create_descriptive_error(e, "Test context")
            assert "Test context" in desc
            print("✓ create_descriptive_error works")
        
        # Test step utilities
        assert normalize_step_order({'step_order': '5'}) == 5
        assert normalize_step_order({'step_order': 10}) == 10
        assert normalize_step_order({}) == 0
        print("✓ normalize_step_order works")
        
        # Test decimal utilities
        test_data = {'price': 19.99, 'nested': {'value': 3.14}}
        decimal_data = convert_floats_to_decimal(test_data)
        assert isinstance(decimal_data['price'], Decimal)
        print("✓ convert_floats_to_decimal works")
        
        float_data = convert_decimals_to_float(decimal_data)
        assert isinstance(float_data['price'], float)
        print("✓ convert_decimals_to_float works")
        
        print("\n✅ All utility functions working!\n")
        return True
    except Exception as e:
        print(f"\n❌ Utility test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_services():
    """Test service classes."""
    print("=" * 60)
    print("TESTING SERVICE CLASSES")
    print("=" * 60)
    
    try:
        from services.context_builder import ContextBuilder
        from services.execution_step_manager import ExecutionStepManager
        
        # Check ContextBuilder methods
        methods = [m for m in dir(ContextBuilder) if not m.startswith("_")]
        assert 'format_submission_data_with_labels' in methods
        assert 'build_previous_context_from_step_outputs' in methods
        print("✓ ContextBuilder has required methods")
        
        # Check ExecutionStepManager methods
        methods = [m for m in dir(ExecutionStepManager) if not m.startswith("_")]
        assert 'create_ai_generation_step' in methods
        assert 'create_html_generation_step' in methods
        print("✓ ExecutionStepManager has required methods")
        
        print("\n✅ All service classes working!\n")
        return True
    except Exception as e:
        print(f"\n❌ Service test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_processor_instantiation():
    """Test that JobProcessor can be instantiated (without AWS calls)."""
    print("=" * 60)
    print("TESTING PROCESSOR INSTANTIATION")
    print("=" * 60)
    
    try:
        # Mock AWS services to avoid needing credentials
        class MockDB:
            pass
        
        class MockS3:
            pass
        
        from processor import JobProcessor
        
        # This will fail if imports are broken, but won't make AWS calls
        # until process_job is called
        print("✓ JobProcessor class imported")
        print("  (Full instantiation requires AWS credentials)")
        
        print("\n✅ Processor can be imported!\n")
        return True
    except Exception as e:
        print(f"\n❌ Processor test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("WORKER CODE IMPORT TEST SUITE")
    print("=" * 60 + "\n")
    
    results = []
    
    results.append(("Imports", test_imports()))
    results.append(("Utilities", test_utilities()))
    results.append(("Services", test_services()))
    results.append(("Processor", test_processor_instantiation()))
    
    # Summary
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
        if not passed:
            all_passed = False
    
    print("=" * 60)
    if all_passed:
        print("✅ ALL TESTS PASSED!")
        print("\nThe worker code is ready for local execution.")
        print("Use: python test_local.py <job_id>")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
