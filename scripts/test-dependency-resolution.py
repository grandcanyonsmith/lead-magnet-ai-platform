#!/usr/bin/env python3
"""
E2E Test for Async Step Execution with Dependencies (Python version)
Tests dependency resolution, execution groups, and parallel opportunities
"""

import sys
import os

# Add backend/worker to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

from dependency_resolver import (
    resolve_execution_groups,
    validate_dependencies,
    get_ready_steps,
    get_step_status,
    build_dependency_graph
)

# Colors for output
GREEN = '\033[32m'
RED = '\033[31m'
YELLOW = '\033[33m'
BLUE = '\033[34m'
RESET = '\033[0m'

def log(message, color=RESET):
    print(f"{color}{message}{RESET}")

def log_test(name):
    log(f"\n{'=' * 70}", BLUE)
    log(f"Test: {name}", BLUE)
    log('=' * 70, BLUE)

def assert_test(condition, message):
    if not condition:
        log(f"❌ FAILED: {message}", RED)
        raise AssertionError(message)
    log(f"✅ PASSED: {message}", GREEN)

# Test Case 1: Sequential workflow
def test_sequential_workflow():
    log_test('Sequential Workflow (Auto-detected from step_order)')
    
    steps = [
        {
            'step_name': 'Research',
            'step_description': 'Conduct research',
            'model': 'o3-deep-research',
            'instructions': 'Research the topic',
            'step_order': 0,
            'tools': ['web_search_preview'],
            'tool_choice': 'auto',
        },
        {
            'step_name': 'Analysis',
            'step_description': 'Analyze research',
            'model': 'gpt-5',
            'instructions': 'Analyze the research',
            'step_order': 1,
            'tools': [],
            'tool_choice': 'none',
        },
        {
            'step_name': 'Format',
            'step_description': 'Format output',
            'model': 'gpt-5',
            'instructions': 'Format the analysis',
            'step_order': 2,
            'tools': [],
            'tool_choice': 'none',
        },
    ]
    
    plan = resolve_execution_groups(steps)
    
    assert_test(plan['totalSteps'] == 3, 'Total steps should be 3')
    assert_test(len(plan['executionGroups']) == 3, 'Should have 3 execution groups')
    assert_test(len(plan['executionGroups'][0]['stepIndices']) == 1, 'Group 0 should have 1 step')
    assert_test(plan['executionGroups'][0]['stepIndices'][0] == 0, 'Group 0 should contain step 0')
    assert_test(plan['executionGroups'][1]['stepIndices'][0] == 1, 'Group 1 should contain step 1')
    assert_test(plan['executionGroups'][2]['stepIndices'][0] == 2, 'Group 2 should contain step 2')
    
    log(f"Execution Groups: {plan['executionGroups']}")

# Test Case 2: Parallel workflow
def test_parallel_workflow():
    log_test('Parallel Workflow (Same step_order)')
    
    steps = [
        {
            'step_name': 'Research A',
            'step_description': 'Research topic A',
            'model': 'o3-deep-research',
            'instructions': 'Research topic A',
            'step_order': 0,
            'tools': ['web_search_preview'],
            'tool_choice': 'auto',
        },
        {
            'step_name': 'Research B',
            'step_description': 'Research topic B',
            'model': 'o3-deep-research',
            'instructions': 'Research topic B',
            'step_order': 0,  # Same order - can run in parallel
            'tools': ['web_search_preview'],
            'tool_choice': 'auto',
        },
        {
            'step_name': 'Combine',
            'step_description': 'Combine results',
            'model': 'gpt-5',
            'instructions': 'Combine both research results',
            'step_order': 1,
            'tools': [],
            'tool_choice': 'none',
        },
    ]
    
    plan = resolve_execution_groups(steps)
    
    assert_test(plan['totalSteps'] == 3, 'Total steps should be 3')
    assert_test(len(plan['executionGroups']) == 2, 'Should have 2 execution groups')
    assert_test(len(plan['executionGroups'][0]['stepIndices']) == 2, 'Group 0 should have 2 steps')
    assert_test(plan['executionGroups'][0]['canRunInParallel'] == True, 'Group 0 should allow parallel execution')
    assert_test(0 in plan['executionGroups'][0]['stepIndices'], 'Group 0 should contain step 0')
    assert_test(1 in plan['executionGroups'][0]['stepIndices'], 'Group 0 should contain step 1')
    assert_test(plan['executionGroups'][1]['stepIndices'][0] == 2, 'Group 1 should contain step 2')
    
    log(f"Execution Groups: {plan['executionGroups']}")

# Test Case 3: Explicit dependencies
def test_explicit_dependencies():
    log_test('Explicit Dependencies (depends_on field)')
    
    steps = [
        {
            'step_name': 'Research',
            'step_description': 'Conduct research',
            'model': 'o3-deep-research',
            'instructions': 'Research the topic',
            'step_order': 0,
            'depends_on': [],
            'tools': ['web_search_preview'],
            'tool_choice': 'auto',
        },
        {
            'step_name': 'Competitor Analysis',
            'step_description': 'Analyze competitors',
            'model': 'gpt-4o',
            'instructions': 'Analyze competitors',
            'step_order': 0,
            'depends_on': [],  # Can run in parallel with Research
            'tools': ['web_search_preview'],
            'tool_choice': 'auto',
        },
        {
            'step_name': 'SWOT Analysis',
            'step_description': 'Create SWOT',
            'model': 'gpt-5',
            'instructions': 'Create SWOT analysis',
            'step_order': 1,
            'depends_on': [0, 1],  # Depends on both Research and Competitor Analysis
            'tools': [],
            'tool_choice': 'none',
        },
    ]
    
    plan = resolve_execution_groups(steps)
    
    assert_test(plan['totalSteps'] == 3, 'Total steps should be 3')
    assert_test(len(plan['executionGroups']) == 2, 'Should have 2 execution groups')
    assert_test(len(plan['executionGroups'][0]['stepIndices']) == 2, 'Group 0 should have 2 steps')
    assert_test(plan['executionGroups'][0]['canRunInParallel'] == True, 'Group 0 should allow parallel execution')
    assert_test(plan['executionGroups'][1]['stepIndices'][0] == 2, 'Group 1 should contain step 2')
    
    log(f"Execution Groups: {plan['executionGroups']}")

# Test Case 4: Circular dependency detection
def test_circular_dependency():
    log_test('Circular Dependency Detection')
    
    steps = [
        {
            'step_name': 'Step 1',
            'step_description': 'Step 1',
            'model': 'gpt-5',
            'instructions': 'Step 1',
            'step_order': 0,
            'depends_on': [1],  # Depends on Step 2
            'tools': [],
            'tool_choice': 'none',
        },
        {
            'step_name': 'Step 2',
            'step_description': 'Step 2',
            'model': 'gpt-5',
            'instructions': 'Step 2',
            'step_order': 1,
            'depends_on': [0],  # Depends on Step 1 - CIRCULAR!
            'tools': [],
            'tool_choice': 'none',
        },
    ]
    
    is_valid, errors = validate_dependencies(steps)
    
    assert_test(is_valid == False, 'Should detect circular dependency')
    assert_test(len(errors) > 0, 'Should have error messages')
    assert_test(any('Circular' in e for e in errors), 'Error should mention circular dependency')
    
    log(f"Validation Errors: {errors}")

# Test Case 5: Invalid dependency indices
def test_invalid_dependencies():
    log_test('Invalid Dependency Indices')
    
    steps = [
        {
            'step_name': 'Step 1',
            'step_description': 'Step 1',
            'model': 'gpt-5',
            'instructions': 'Step 1',
            'step_order': 0,
            'depends_on': [5],  # Invalid: step 5 doesn't exist
            'tools': [],
            'tool_choice': 'none',
        },
        {
            'step_name': 'Step 2',
            'step_description': 'Step 2',
            'model': 'gpt-5',
            'instructions': 'Step 2',
            'step_order': 1,
            'depends_on': [0],
            'tools': [],
            'tool_choice': 'none',
        },
    ]
    
    is_valid, errors = validate_dependencies(steps)
    
    assert_test(is_valid == False, 'Should detect invalid dependency')
    assert_test(len(errors) > 0, 'Should have error messages')
    assert_test(any('out of range' in e for e in errors), 'Error should mention out of range')
    
    log(f"Validation Errors: {errors}")

# Test Case 6: Self-dependency detection
def test_self_dependency():
    log_test('Self-Dependency Detection')
    
    steps = [
        {
            'step_name': 'Step 1',
            'step_description': 'Step 1',
            'model': 'gpt-5',
            'instructions': 'Step 1',
            'step_order': 0,
            'depends_on': [0],  # Depends on itself - invalid!
            'tools': [],
            'tool_choice': 'none',
        },
    ]
    
    is_valid, errors = validate_dependencies(steps)
    
    assert_test(is_valid == False, 'Should detect self-dependency')
    assert_test(len(errors) > 0, 'Should have error messages')
    assert_test(any('cannot depend on itself' in e for e in errors), 'Error should mention self-dependency')
    
    log(f"Validation Errors: {errors}")

# Test Case 7: Step readiness
def test_step_readiness():
    log_test('Step Readiness Detection')
    
    steps = [
        {
            'step_name': 'Research',
            'step_description': 'Research',
            'model': 'o3-deep-research',
            'instructions': 'Research',
            'step_order': 0,
            'depends_on': [],
            'tools': ['web_search_preview'],
            'tool_choice': 'auto',
        },
        {
            'step_name': 'Analysis',
            'step_description': 'Analysis',
            'model': 'gpt-5',
            'instructions': 'Analyze',
            'step_order': 1,
            'depends_on': [0],
            'tools': [],
            'tool_choice': 'none',
        },
        {
            'step_name': 'Format',
            'step_description': 'Format',
            'model': 'gpt-5',
            'instructions': 'Format',
            'step_order': 2,
            'depends_on': [1],
            'tools': [],
            'tool_choice': 'none',
        },
    ]
    
    # No steps completed
    ready_steps = get_ready_steps([], steps)
    assert_test(len(ready_steps) == 1, 'Should have 1 ready step')
    assert_test(ready_steps[0] == 0, 'Step 0 should be ready')
    
    # Step 0 completed
    ready_steps = get_ready_steps([0], steps)
    assert_test(len(ready_steps) == 1, 'Should have 1 ready step')
    assert_test(ready_steps[0] == 1, 'Step 1 should be ready')
    
    # Steps 0 and 1 completed
    ready_steps = get_ready_steps([0, 1], steps)
    assert_test(len(ready_steps) == 1, 'Should have 1 ready step')
    assert_test(ready_steps[0] == 2, 'Step 2 should be ready')
    
    # All steps completed
    ready_steps = get_ready_steps([0, 1, 2], steps)
    assert_test(len(ready_steps) == 0, 'No steps should be ready')
    
    log("✅ Step readiness logic working correctly")

# Test Case 8: Step status tracking
def test_step_status():
    log_test('Step Status Tracking')
    
    steps = [
        {
            'step_name': 'Research',
            'step_description': 'Research',
            'model': 'o3-deep-research',
            'instructions': 'Research',
            'step_order': 0,
            'depends_on': [],
            'tools': ['web_search_preview'],
            'tool_choice': 'auto',
        },
        {
            'step_name': 'Analysis',
            'step_description': 'Analysis',
            'model': 'gpt-5',
            'instructions': 'Analyze',
            'step_order': 1,
            'depends_on': [0],
            'tools': [],
            'tool_choice': 'none',
        },
    ]
    
    status = get_step_status([0], [1], steps)
    
    assert_test(status[0] == 'completed', 'Step 0 should be completed')
    assert_test(status[1] == 'running', 'Step 1 should be running')
    
    log(f"Step Status: {status}")

# Test Case 9: Complex dependency graph
def test_complex_dependency_graph():
    log_test('Complex Dependency Graph')
    
    steps = [
        {
            'step_name': 'Research A',
            'step_description': 'Research A',
            'model': 'o3-deep-research',
            'instructions': 'Research A',
            'step_order': 0,
            'depends_on': [],
            'tools': ['web_search_preview'],
            'tool_choice': 'auto',
        },
        {
            'step_name': 'Research B',
            'step_description': 'Research B',
            'model': 'o3-deep-research',
            'instructions': 'Research B',
            'step_order': 0,
            'depends_on': [],
            'tools': ['web_search_preview'],
            'tool_choice': 'auto',
        },
        {
            'step_name': 'Combine',
            'step_description': 'Combine',
            'model': 'gpt-5',
            'instructions': 'Combine',
            'step_order': 1,
            'depends_on': [0, 1],
            'tools': [],
            'tool_choice': 'none',
        },
        {
            'step_name': 'Format',
            'step_description': 'Format',
            'model': 'gpt-5',
            'instructions': 'Format',
            'step_order': 2,
            'depends_on': [2],
            'tools': [],
            'tool_choice': 'none',
        },
    ]
    
    plan = resolve_execution_groups(steps)
    
    assert_test(plan['totalSteps'] == 4, 'Total steps should be 4')
    assert_test(len(plan['executionGroups']) == 3, 'Should have 3 execution groups')
    assert_test(len(plan['executionGroups'][0]['stepIndices']) == 2, 'Group 0 should have 2 steps')
    assert_test(plan['executionGroups'][0]['canRunInParallel'] == True, 'Group 0 should allow parallel execution')
    
    log(f"Execution Groups: {plan['executionGroups']}")

# Test Case 10: Dependency graph building
def test_dependency_graph_building():
    log_test('Dependency Graph Building')
    
    steps = [
        {
            'step_name': 'Step 1',
            'step_description': 'Step 1',
            'model': 'gpt-5',
            'instructions': 'Step 1',
            'step_order': 0,
            'depends_on': [],
            'tools': [],
            'tool_choice': 'none',
        },
        {
            'step_name': 'Step 2',
            'step_description': 'Step 2',
            'model': 'gpt-5',
            'instructions': 'Step 2',
            'step_order': 1,
            'depends_on': [0],
            'tools': [],
            'tool_choice': 'none',
        },
    ]
    
    graph = build_dependency_graph(steps)
    
    assert_test(len(graph) == 2, 'Graph should have 2 steps')
    assert_test(len(graph.get(0, [])) == 0, 'Step 0 should have no dependencies')
    assert_test(0 in graph.get(1, []), 'Step 1 should depend on step 0')
    
    log(f"Dependencies: {graph}")

# Main test runner
def run_all_tests():
    log('\n🧪 E2E Test Suite: Async Step Execution with Dependencies', YELLOW)
    log('=' * 70, YELLOW)
    
    tests = [
        ('Sequential Workflow', test_sequential_workflow),
        ('Parallel Workflow', test_parallel_workflow),
        ('Explicit Dependencies', test_explicit_dependencies),
        ('Circular Dependency Detection', test_circular_dependency),
        ('Invalid Dependencies', test_invalid_dependencies),
        ('Self-Dependency Detection', test_self_dependency),
        ('Step Readiness', test_step_readiness),
        ('Step Status Tracking', test_step_status),
        ('Complex Dependency Graph', test_complex_dependency_graph),
        ('Dependency Graph Building', test_dependency_graph_building),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            log(f"\n❌ Test \"{test_name}\" failed: {e}", RED)
            failed += 1
        except Exception as e:
            log(f"\n❌ Test \"{test_name}\" crashed: {e}", RED)
            import traceback
            traceback.print_exc()
            failed += 1
    
    log('\n' + '=' * 70, YELLOW)
    log('📊 Test Summary', YELLOW)
    log('=' * 70, YELLOW)
    log(f"✅ Passed: {passed}", GREEN)
    log(f"❌ Failed: {failed}", RED if failed > 0 else GREEN)
    log(f"📈 Total: {len(tests)}", BLUE)
    
    if failed == 0:
        log('\n🎉 All tests passed! Dependency resolution is working correctly.', GREEN)
        return 0
    else:
        log('\n⚠️  Some tests failed. Please review the errors above.', RED)
        return 1

if __name__ == '__main__':
    exit_code = run_all_tests()
    sys.exit(exit_code)

