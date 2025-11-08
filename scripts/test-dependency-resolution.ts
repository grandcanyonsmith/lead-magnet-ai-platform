#!/usr/bin/env ts-node
/**
 * E2E Test for Async Step Execution with Dependencies
 * Tests dependency resolution, execution groups, and parallel opportunities
 */

import { resolveExecutionGroups, validateDependencies, getReadySteps, getStepStatus, buildDependencyGraph } from '../backend/api/src/utils/dependencyResolver';
import { WorkflowStep } from '../backend/api/src/utils/workflowMigration';

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(message: string, color: string = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function logTest(name: string) {
  log(`\n${'='.repeat(70)}`, BLUE);
  log(`Test: ${name}`, BLUE);
  log('='.repeat(70), BLUE);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    log(`❌ FAILED: ${message}`, RED);
    throw new Error(message);
  }
  log(`✅ PASSED: ${message}`, GREEN);
}

// Test Case 1: Sequential workflow (no dependencies, auto-detected from step_order)
function testSequentialWorkflow() {
  logTest('Sequential Workflow (Auto-detected from step_order)');
  
  const steps: WorkflowStep[] = [
    {
      step_name: 'Research',
      step_description: 'Conduct research',
      model: 'o3-deep-research',
      instructions: 'Research the topic',
      step_order: 0,
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    },
    {
      step_name: 'Analysis',
      step_description: 'Analyze research',
      model: 'gpt-5',
      instructions: 'Analyze the research',
      step_order: 1,
      tools: [],
      tool_choice: 'none',
    },
    {
      step_name: 'Format',
      step_description: 'Format output',
      model: 'gpt-5',
      instructions: 'Format the analysis',
      step_order: 2,
      tools: [],
      tool_choice: 'none',
    },
  ];
  
  const plan = resolveExecutionGroups(steps);
  
  assert(plan.totalSteps === 3, 'Total steps should be 3');
  assert(plan.executionGroups.length === 3, 'Should have 3 execution groups');
  assert(plan.executionGroups[0].stepIndices.length === 1, 'Group 0 should have 1 step');
  assert(plan.executionGroups[0].stepIndices[0] === 0, 'Group 0 should contain step 0');
  assert(plan.executionGroups[1].stepIndices[0] === 1, 'Group 1 should contain step 1');
  assert(plan.executionGroups[2].stepIndices[0] === 2, 'Group 2 should contain step 2');
  
  log(`Execution Groups: ${JSON.stringify(plan.executionGroups, null, 2)}`);
}

// Test Case 2: Parallel workflow (steps with same step_order)
function testParallelWorkflow() {
  logTest('Parallel Workflow (Same step_order)');
  
  const steps: WorkflowStep[] = [
    {
      step_name: 'Research A',
      step_description: 'Research topic A',
      model: 'o3-deep-research',
      instructions: 'Research topic A',
      step_order: 0,
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    },
    {
      step_name: 'Research B',
      step_description: 'Research topic B',
      model: 'o3-deep-research',
      instructions: 'Research topic B',
      step_order: 0, // Same order - can run in parallel
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    },
    {
      step_name: 'Combine',
      step_description: 'Combine results',
      model: 'gpt-5',
      instructions: 'Combine both research results',
      step_order: 1,
      tools: [],
      tool_choice: 'none',
    },
  ];
  
  const plan = resolveExecutionGroups(steps);
  
  assert(plan.totalSteps === 3, 'Total steps should be 3');
  assert(plan.executionGroups.length === 2, 'Should have 2 execution groups');
  assert(plan.executionGroups[0].stepIndices.length === 2, 'Group 0 should have 2 steps');
  assert(plan.executionGroups[0].canRunInParallel === true, 'Group 0 should allow parallel execution');
  assert(plan.executionGroups[0].stepIndices.includes(0), 'Group 0 should contain step 0');
  assert(plan.executionGroups[0].stepIndices.includes(1), 'Group 0 should contain step 1');
  assert(plan.executionGroups[1].stepIndices[0] === 2, 'Group 1 should contain step 2');
  
  log(`Execution Groups: ${JSON.stringify(plan.executionGroups, null, 2)}`);
}

// Test Case 3: Explicit dependencies
function testExplicitDependencies() {
  logTest('Explicit Dependencies (depends_on field)');
  
  const steps: WorkflowStep[] = [
    {
      step_name: 'Research',
      step_description: 'Conduct research',
      model: 'o3-deep-research',
      instructions: 'Research the topic',
      step_order: 0,
      depends_on: [],
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    },
    {
      step_name: 'Competitor Analysis',
      step_description: 'Analyze competitors',
      model: 'gpt-4o',
      instructions: 'Analyze competitors',
      step_order: 0,
      depends_on: [], // Can run in parallel with Research
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    },
    {
      step_name: 'SWOT Analysis',
      step_description: 'Create SWOT',
      model: 'gpt-5',
      instructions: 'Create SWOT analysis',
      step_order: 1,
      depends_on: [0, 1], // Depends on both Research and Competitor Analysis
      tools: [],
      tool_choice: 'none',
    },
  ];
  
  const plan = resolveExecutionGroups(steps);
  
  assert(plan.totalSteps === 3, 'Total steps should be 3');
  assert(plan.executionGroups.length === 2, 'Should have 2 execution groups');
  assert(plan.executionGroups[0].stepIndices.length === 2, 'Group 0 should have 2 steps');
  assert(plan.executionGroups[0].canRunInParallel === true, 'Group 0 should allow parallel execution');
  assert(plan.executionGroups[1].stepIndices[0] === 2, 'Group 1 should contain step 2');
  
  log(`Execution Groups: ${JSON.stringify(plan.executionGroups, null, 2)}`);
}

// Test Case 4: Circular dependency detection
function testCircularDependency() {
  logTest('Circular Dependency Detection');
  
  const steps: WorkflowStep[] = [
    {
      step_name: 'Step 1',
      step_description: 'Step 1',
      model: 'gpt-5',
      instructions: 'Step 1',
      step_order: 0,
      depends_on: [1], // Depends on Step 2
      tools: [],
      tool_choice: 'none',
    },
    {
      step_name: 'Step 2',
      step_description: 'Step 2',
      model: 'gpt-5',
      instructions: 'Step 2',
      step_order: 1,
      depends_on: [0], // Depends on Step 1 - CIRCULAR!
      tools: [],
      tool_choice: 'none',
    },
  ];
  
  const validation = validateDependencies(steps);
  
  assert(validation.valid === false, 'Should detect circular dependency');
  assert(validation.errors.length > 0, 'Should have error messages');
  assert(validation.errors.some(e => e.includes('Circular')), 'Error should mention circular dependency');
  
  log(`Validation Errors: ${JSON.stringify(validation.errors, null, 2)}`);
}

// Test Case 5: Invalid dependency indices
function testInvalidDependencies() {
  logTest('Invalid Dependency Indices');
  
  const steps: WorkflowStep[] = [
    {
      step_name: 'Step 1',
      step_description: 'Step 1',
      model: 'gpt-5',
      instructions: 'Step 1',
      step_order: 0,
      depends_on: [5], // Invalid: step 5 doesn't exist
      tools: [],
      tool_choice: 'none',
    },
    {
      step_name: 'Step 2',
      step_description: 'Step 2',
      model: 'gpt-5',
      instructions: 'Step 2',
      step_order: 1,
      depends_on: [0],
      tools: [],
      tool_choice: 'none',
    },
  ];
  
  const validation = validateDependencies(steps);
  
  assert(validation.valid === false, 'Should detect invalid dependency');
  assert(validation.errors.length > 0, 'Should have error messages');
  assert(validation.errors.some(e => e.includes('out of range')), 'Error should mention out of range');
  
  log(`Validation Errors: ${JSON.stringify(validation.errors, null, 2)}`);
}

// Test Case 6: Self-dependency detection
function testSelfDependency() {
  logTest('Self-Dependency Detection');
  
  const steps: WorkflowStep[] = [
    {
      step_name: 'Step 1',
      step_description: 'Step 1',
      model: 'gpt-5',
      instructions: 'Step 1',
      step_order: 0,
      depends_on: [0], // Depends on itself - invalid!
      tools: [],
      tool_choice: 'none',
    },
  ];
  
  const validation = validateDependencies(steps);
  
  assert(validation.valid === false, 'Should detect self-dependency');
  assert(validation.errors.length > 0, 'Should have error messages');
  assert(validation.errors.some(e => e.includes('cannot depend on itself')), 'Error should mention self-dependency');
  
  log(`Validation Errors: ${JSON.stringify(validation.errors, null, 2)}`);
}

// Test Case 7: Step readiness
function testStepReadiness() {
  logTest('Step Readiness Detection');
  
  const steps: WorkflowStep[] = [
    {
      step_name: 'Research',
      step_description: 'Research',
      model: 'o3-deep-research',
      instructions: 'Research',
      step_order: 0,
      depends_on: [],
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    },
    {
      step_name: 'Analysis',
      step_description: 'Analysis',
      model: 'gpt-5',
      instructions: 'Analyze',
      step_order: 1,
      depends_on: [0],
      tools: [],
      tool_choice: 'none',
    },
    {
      step_name: 'Format',
      step_description: 'Format',
      model: 'gpt-5',
      instructions: 'Format',
      step_order: 2,
      depends_on: [1],
      tools: [],
      tool_choice: 'none',
    },
  ];
  
  // No steps completed
  let readySteps = getReadySteps([], steps);
  assert(readySteps.length === 1, 'Should have 1 ready step');
  assert(readySteps[0] === 0, 'Step 0 should be ready');
  
  // Step 0 completed
  readySteps = getReadySteps([0], steps);
  assert(readySteps.length === 1, 'Should have 1 ready step');
  assert(readySteps[0] === 1, 'Step 1 should be ready');
  
  // Steps 0 and 1 completed
  readySteps = getReadySteps([0, 1], steps);
  assert(readySteps.length === 1, 'Should have 1 ready step');
  assert(readySteps[0] === 2, 'Step 2 should be ready');
  
  // All steps completed
  readySteps = getReadySteps([0, 1, 2], steps);
  assert(readySteps.length === 0, 'No steps should be ready');
  
  log(`✅ Step readiness logic working correctly`);
}

// Test Case 8: Step status tracking
function testStepStatus() {
  logTest('Step Status Tracking');
  
  const steps: WorkflowStep[] = [
    {
      step_name: 'Research',
      step_description: 'Research',
      model: 'o3-deep-research',
      instructions: 'Research',
      step_order: 0,
      depends_on: [],
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    },
    {
      step_name: 'Analysis',
      step_description: 'Analysis',
      model: 'gpt-5',
      instructions: 'Analyze',
      step_order: 1,
      depends_on: [0],
      tools: [],
      tool_choice: 'none',
    },
  ];
  
  const status = getStepStatus([0], [1], steps);
  
  assert(status.get(0) === 'completed', 'Step 0 should be completed');
  assert(status.get(1) === 'running', 'Step 1 should be running');
  
  log(`Step Status: ${JSON.stringify(Object.fromEntries(status))}`);
}

// Test Case 9: Complex dependency graph
function testComplexDependencyGraph() {
  logTest('Complex Dependency Graph');
  
  const steps: WorkflowStep[] = [
    {
      step_name: 'Research A',
      step_description: 'Research A',
      model: 'o3-deep-research',
      instructions: 'Research A',
      step_order: 0,
      depends_on: [],
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    },
    {
      step_name: 'Research B',
      step_description: 'Research B',
      model: 'o3-deep-research',
      instructions: 'Research B',
      step_order: 0,
      depends_on: [],
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    },
    {
      step_name: 'Combine',
      step_description: 'Combine',
      model: 'gpt-5',
      instructions: 'Combine',
      step_order: 1,
      depends_on: [0, 1],
      tools: [],
      tool_choice: 'none',
    },
    {
      step_name: 'Format',
      step_description: 'Format',
      model: 'gpt-5',
      instructions: 'Format',
      step_order: 2,
      depends_on: [2],
      tools: [],
      tool_choice: 'none',
    },
  ];
  
  const plan = resolveExecutionGroups(steps);
  
  assert(plan.totalSteps === 4, 'Total steps should be 4');
  assert(plan.executionGroups.length === 3, 'Should have 3 execution groups');
  assert(plan.executionGroups[0].stepIndices.length === 2, 'Group 0 should have 2 steps');
  assert(plan.executionGroups[0].canRunInParallel === true, 'Group 0 should allow parallel execution');
  
  log(`Execution Groups: ${JSON.stringify(plan.executionGroups, null, 2)}`);
}

// Test Case 10: Dependency graph building
function testDependencyGraphBuilding() {
  logTest('Dependency Graph Building');
  
  const steps: WorkflowStep[] = [
    {
      step_name: 'Step 1',
      step_description: 'Step 1',
      model: 'gpt-5',
      instructions: 'Step 1',
      step_order: 0,
      depends_on: [],
      tools: [],
      tool_choice: 'none',
    },
    {
      step_name: 'Step 2',
      step_description: 'Step 2',
      model: 'gpt-5',
      instructions: 'Step 2',
      step_order: 1,
      depends_on: [0],
      tools: [],
      tool_choice: 'none',
    },
  ];
  
  const graph = buildDependencyGraph(steps);
  
  assert(graph.steps.length === 2, 'Graph should have 2 steps');
  assert(graph.dependencies.get(0)?.length === 0, 'Step 0 should have no dependencies');
  assert(graph.dependencies.get(1)?.includes(0), 'Step 1 should depend on step 0');
  assert(graph.dependents.get(0)?.includes(1), 'Step 0 should have step 1 as dependent');
  
  log(`Dependencies: ${JSON.stringify(Object.fromEntries(graph.dependencies))}`);
  log(`Dependents: ${JSON.stringify(Object.fromEntries(graph.dependents))}`);
}

// Main test runner
async function runAllTests() {
  log('\n🧪 E2E Test Suite: Async Step Execution with Dependencies', YELLOW);
  log('='.repeat(70), YELLOW);
  
  const tests = [
    { name: 'Sequential Workflow', fn: testSequentialWorkflow },
    { name: 'Parallel Workflow', fn: testParallelWorkflow },
    { name: 'Explicit Dependencies', fn: testExplicitDependencies },
    { name: 'Circular Dependency Detection', fn: testCircularDependency },
    { name: 'Invalid Dependencies', fn: testInvalidDependencies },
    { name: 'Self-Dependency Detection', fn: testSelfDependency },
    { name: 'Step Readiness', fn: testStepReadiness },
    { name: 'Step Status Tracking', fn: testStepStatus },
    { name: 'Complex Dependency Graph', fn: testComplexDependencyGraph },
    { name: 'Dependency Graph Building', fn: testDependencyGraphBuilding },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      test.fn();
      passed++;
    } catch (error: any) {
      log(`\n❌ Test "${test.name}" failed: ${error.message}`, RED);
      failed++;
    }
  }
  
  log('\n' + '='.repeat(70), YELLOW);
  log('📊 Test Summary', YELLOW);
  log('='.repeat(70), YELLOW);
  log(`✅ Passed: ${passed}`, GREEN);
  log(`❌ Failed: ${failed}`, failed > 0 ? RED : GREEN);
  log(`📈 Total: ${tests.length}`, BLUE);
  
  if (failed === 0) {
    log('\n🎉 All tests passed! Dependency resolution is working correctly.', GREEN);
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Please review the errors above.', RED);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  log(`\n💥 Test suite crashed: ${error.message}`, RED);
  if (error.stack) {
    log(`Stack: ${error.stack}`, RED);
  }
  process.exit(1);
});

