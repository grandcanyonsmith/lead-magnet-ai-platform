#!/usr/bin/env ts-node
/**
 * Test script to verify Responses API refactoring
 * Tests that all OpenAI API calls use Responses API exclusively
 */

import OpenAI from 'openai';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const OPENAI_SECRET_NAME = process.env.OPENAI_SECRET_NAME || 'leadmagnet/openai-api-key';
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function getOpenAIClient(): Promise<OpenAI> {
  const command = new GetSecretValueCommand({ SecretId: OPENAI_SECRET_NAME });
  const response = await secretsClient.send(command);
  
  if (!response.SecretString) {
    throw new Error('OpenAI API key not found in secret');
  }

  let apiKey: string;
  
  try {
    const parsed = JSON.parse(response.SecretString);
    apiKey = parsed.OPENAI_API_KEY || parsed.apiKey || response.SecretString;
  } catch {
    apiKey = response.SecretString;
  }
  
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('OpenAI API key is empty');
  }

  return new OpenAI({ apiKey });
}

async function testResponsesAPI() {
  console.log('🧪 Testing Responses API Refactoring\n');
  console.log('='.repeat(60));
  
  const openai = await getOpenAIClient();
  console.log('✅ OpenAI client initialized\n');

  const tests = [
    {
      name: 'Test 1: Workflow Generation',
      test: async () => {
        const params: any = {
          model: 'gpt-5',
          instructions: 'You are an expert at creating AI-powered lead magnets. Return only valid JSON without markdown formatting.',
          input: 'Generate a simple workflow for a fitness lead magnet',
        };
        const response = await openai.responses.create(params);
        
        // Verify response structure
        if (!response.output_text) {
          throw new Error('Missing output_text in response');
        }
        if (!response.usage) {
          throw new Error('Missing usage in response');
        }
        if (typeof response.usage.input_tokens !== 'number') {
          throw new Error('Missing input_tokens in usage');
        }
        if (typeof response.usage.output_tokens !== 'number') {
          throw new Error('Missing output_tokens in usage');
        }
        
        return {
          success: true,
          outputLength: response.output_text.length,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
      },
    },
    {
      name: 'Test 2: Template HTML Generation',
      test: async () => {
        const params: any = {
          model: 'gpt-5',
          instructions: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
          input: 'Create a simple HTML template for a fitness lead magnet',
        };
        const response = await openai.responses.create(params);
        
        if (!response.output_text) {
          throw new Error('Missing output_text in response');
        }
        if (!response.output_text.includes('<html') && !response.output_text.includes('<div')) {
          throw new Error('Response does not appear to be HTML');
        }
        
        return {
          success: true,
          outputLength: response.output_text.length,
          hasHtml: response.output_text.includes('<'),
        };
      },
    },
    {
      name: 'Test 3: Form CSS Generation',
      test: async () => {
        const params: any = {
          model: 'gpt-5',
          instructions: 'You are an expert CSS designer. Return only valid CSS code without markdown formatting.',
          input: 'Generate CSS for a simple form with name and email fields',
        };
        const response = await openai.responses.create(params);
        
        if (!response.output_text) {
          throw new Error('Missing output_text in response');
        }
        
        return {
          success: true,
          outputLength: response.output_text.length,
          hasCss: response.output_text.includes('{') && response.output_text.includes('}'),
        };
      },
    },
    {
      name: 'Test 4: Instructions Refinement',
      test: async () => {
        const params: any = {
          model: 'gpt-5',
          instructions: 'You are an expert AI prompt engineer. Return only the modified instructions without markdown formatting.',
          input: 'Modify these instructions: "Generate a report" to be more detailed',
        };
        const response = await openai.responses.create(params);
        
        if (!response.output_text) {
          throw new Error('Missing output_text in response');
        }
        
        return {
          success: true,
          outputLength: response.output_text.length,
        };
      },
    },
    {
      name: 'Test 5: Template Name Generation',
      test: async () => {
        const params: any = {
          model: 'gpt-5',
          input: 'Based on this description: "Fitness lead magnet", generate a short template name (2-4 words max)',
        };
        const response = await openai.responses.create(params);
        
        if (!response.output_text) {
          throw new Error('Missing output_text in response');
        }
        
        return {
          success: true,
          outputLength: response.output_text.length,
        };
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of tests) {
    try {
      console.log(`\n${testCase.name}`);
      console.log('-'.repeat(60));
      
      const result = await testCase.test();
      
      console.log('✅ PASSED');
      console.log(`   Output length: ${result.outputLength}`);
      if (result.inputTokens !== undefined) {
        console.log(`   Input tokens: ${result.inputTokens}`);
      }
      if (result.outputTokens !== undefined) {
        console.log(`   Output tokens: ${result.outputTokens}`);
      }
      if (result.hasHtml !== undefined) {
        console.log(`   Contains HTML: ${result.hasHtml}`);
      }
      if (result.hasCss !== undefined) {
        console.log(`   Contains CSS: ${result.hasCss}`);
      }
      
      passed++;
    } catch (error: any) {
      console.log('❌ FAILED');
      console.log(`   Error: ${error.message}`);
      if (error.stack) {
        console.log(`   Stack: ${error.stack.split('\n')[1]}`);
      }
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${tests.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Responses API refactoring is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run tests
testResponsesAPI().catch((error) => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});

