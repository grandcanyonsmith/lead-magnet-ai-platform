#!/usr/bin/env ts-node
/**
 * E2E Test: Verify o4-mini-deep-research does not automatically add web_search tool
 * 
 * This test verifies that when generating a workflow step with o4-mini-deep-research model,
 * the web_search tool is NOT automatically added unless explicitly requested.
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TENANT_ID = process.env.TENANT_ID || 'test-tenant';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

async function makeRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  const options: any = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function createTestWorkflow(): Promise<string> {
  console.log('📝 Creating test workflow...');
  
  const workflow = await makeRequest('/admin/workflows', 'POST', {
    workflow_name: 'Test Workflow for o4-mini',
    workflow_description: 'Test workflow for verifying o4-mini-deep-research tool selection',
    steps: [],
  });

  if (!workflow.workflow_id) {
    throw new Error('Failed to create workflow');
  }

  console.log(`✅ Created workflow: ${workflow.workflow_id}`);
  return workflow.workflow_id;
}

async function testStepGeneration(
  workflowId: string,
  userPrompt: string,
  testName: string
): Promise<TestResult> {
  console.log(`\n🧪 ${testName}`);
  console.log(`   Prompt: "${userPrompt}"`);

  try {
    const result = await makeRequest(`/admin/workflows/${workflowId}/ai-step`, 'POST', {
      userPrompt,
      action: 'add',
      workflowContext: {
        workflow_id: workflowId,
        workflow_name: 'Test Workflow',
        workflow_description: 'Test',
        current_steps: [],
      },
    });

    const step = result.step;
    const model = step.model;
    const tools = step.tools || [];
    const toolNames = tools.map((t: any) => (typeof t === 'string' ? t : t.type));

    console.log(`   Model: ${model}`);
    console.log(`   Tools: [${toolNames.join(', ')}]`);

    return {
      name: testName,
      passed: true,
      details: {
        model,
        tools: toolNames,
        stepName: step.step_name,
      },
    };
  } catch (error: any) {
    return {
      name: testName,
      passed: false,
      error: error.message,
    };
  }
}

async function runTests(): Promise<void> {
  console.log('🚀 Starting E2E Test: o4-mini-deep-research Tool Selection\n');
  console.log('='.repeat(70));
  console.log(`API URL: ${API_URL}`);
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log('='.repeat(70));

  const results: TestResult[] = [];
  let workflowId: string;

  try {
    // Create a test workflow
    workflowId = await createTestWorkflow();

    // Test 1: Generate step with o4-mini-deep-research without mentioning tools
    // Expected: Should NOT automatically add web_search
    const test1 = await testStepGeneration(
      workflowId,
      'Create a deep research step using o4-mini-deep-research model to analyze market trends',
      'Test 1: o4-mini-deep-research without tool mention'
    );
    results.push(test1);

    // Verify test 1: Check if web_search was automatically added
    if (test1.passed && test1.details) {
      const hasWebSearch = test1.details.tools.includes('web_search');
      const isO4Mini = test1.details.model === 'o4-mini-deep-research';
      
      if (isO4Mini && hasWebSearch) {
        test1.passed = false;
        test1.error = 'FAILED: web_search was automatically added when it should not be';
        console.log(`   ❌ FAILED: web_search was automatically added`);
      } else if (isO4Mini && !hasWebSearch) {
        console.log(`   ✅ PASSED: web_search was NOT automatically added`);
      } else if (!isO4Mini) {
        console.log(`   ⚠️  WARNING: Model is not o4-mini-deep-research (got ${test1.details.model})`);
      }
    }

    // Test 2: Generate step explicitly requesting o4-mini-deep-research with NO tools
    const test2 = await testStepGeneration(
      workflowId,
      'Create a research step using o4-mini-deep-research model with no tools - just analysis',
      'Test 2: o4-mini-deep-research explicitly requesting no tools'
    );
    results.push(test2);

    // Verify test 2
    if (test2.passed && test2.details) {
      const hasWebSearch = test2.details.tools.includes('web_search');
      const hasAnyTools = test2.details.tools.length > 0;
      const isO4Mini = test2.details.model === 'o4-mini-deep-research';
      
      if (isO4Mini && hasWebSearch) {
        test2.passed = false;
        test2.error = 'FAILED: web_search was added despite requesting no tools';
        console.log(`   ❌ FAILED: web_search was added despite requesting no tools`);
      } else if (isO4Mini && !hasWebSearch) {
        console.log(`   ✅ PASSED: No web_search tool added`);
      }
    }

    // Test 3: Generate step requesting o4-mini-deep-research with code_interpreter tool
    // Expected: Should use code_interpreter, NOT web_search
    const test3 = await testStepGeneration(
      workflowId,
      'Create a research step using o4-mini-deep-research model with code_interpreter tool for data analysis',
      'Test 3: o4-mini-deep-research requesting code_interpreter instead'
    );
    results.push(test3);

    // Verify test 3
    if (test3.passed && test3.details) {
      const hasWebSearch = test3.details.tools.includes('web_search');
      const hasCodeInterpreter = test3.details.tools.includes('code_interpreter');
      const isO4Mini = test3.details.model === 'o4-mini-deep-research';
      
      if (isO4Mini && hasWebSearch && !hasCodeInterpreter) {
        test3.passed = false;
        test3.error = 'FAILED: web_search was added instead of code_interpreter';
        console.log(`   ❌ FAILED: web_search was added instead of code_interpreter`);
      } else if (isO4Mini && hasCodeInterpreter && !hasWebSearch) {
        console.log(`   ✅ PASSED: code_interpreter used, web_search NOT added`);
      } else if (isO4Mini && hasCodeInterpreter && hasWebSearch) {
        console.log(`   ⚠️  WARNING: Both tools added (may be acceptable if user requested both)`);
      }
    }

    // Test 4: Generate step explicitly requesting web_search with o4-mini-deep-research
    // Expected: Should add web_search since explicitly requested
    const test4 = await testStepGeneration(
      workflowId,
      'Create a research step using o4-mini-deep-research model with web_search tool',
      'Test 4: o4-mini-deep-research explicitly requesting web_search'
    );
    results.push(test4);

    // Verify test 4: Should have web_search since explicitly requested
    if (test4.passed && test4.details) {
      const hasWebSearch = test4.details.tools.includes('web_search');
      const isO4Mini = test4.details.model === 'o4-mini-deep-research';
      
      if (isO4Mini && hasWebSearch) {
        console.log(`   ✅ PASSED: web_search added when explicitly requested`);
      } else if (isO4Mini && !hasWebSearch) {
        console.log(`   ⚠️  WARNING: web_search not added despite explicit request`);
      }
    }

  } catch (error: any) {
    console.error('\n❌ Test setup failed:', error.message);
    process.exit(1);
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Summary');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${index + 1}. ${status}: ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log(`Total: ${results.length} tests | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(70));

  if (failed > 0) {
    console.log('\n❌ Some tests failed. The fix may not be working correctly.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! o4-mini-deep-research does not auto-add web_search.');
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

