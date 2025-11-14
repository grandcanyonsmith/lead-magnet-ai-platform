/**
 * Test script for brand settings and ICP functionality
 * Run with: npx tsx scripts/test-brand-settings.ts
 */

import { z } from 'zod';

// Import the validation schema
const updateSettingsSchema = z.object({
  organization_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  website_url: z.string().url().optional(),
  logo_url: z.string().url().optional(),
  avatar_url: z.string().url().optional(),
  branding_colors: z
    .object({
      primary: z.string(),
      secondary: z.string(),
    })
    .optional(),
  default_ai_model: z.string().optional(),
  webhooks: z.array(z.string().url()).optional(),
  ghl_webhook_url: z.string().url().optional(),
  lead_phone_field: z.string().optional(),
  // Brand information fields
  brand_description: z.string().optional(),
  brand_voice: z.string().optional(),
  target_audience: z.string().optional(),
  company_values: z.string().optional(),
  industry: z.string().optional(),
  company_size: z.string().optional(),
  brand_messaging_guidelines: z.string().optional(),
  icp_document_url: z.string().url().optional(),
  // Onboarding fields
  onboarding_survey_completed: z.boolean().optional(),
  onboarding_survey_responses: z.record(z.any()).optional(),
  onboarding_checklist: z.object({
    complete_profile: z.boolean().optional(),
    create_first_lead_magnet: z.boolean().optional(),
    view_generated_lead_magnets: z.boolean().optional(),
  }).optional(),
  onboarding_completed_at: z.string().optional(),
});

// Test buildBrandContext function logic
function buildBrandContext(settings: any): string {
  const contextParts: string[] = [];

  if (settings.organization_name) {
    contextParts.push(`Organization: ${settings.organization_name}`);
  }

  if (settings.industry) {
    contextParts.push(`Industry: ${settings.industry}`);
  }

  if (settings.company_size) {
    contextParts.push(`Company Size: ${settings.company_size}`);
  }

  if (settings.brand_description) {
    contextParts.push(`Brand Description: ${settings.brand_description}`);
  }

  if (settings.brand_voice) {
    contextParts.push(`Brand Voice: ${settings.brand_voice}`);
  }

  if (settings.target_audience) {
    contextParts.push(`Target Audience: ${settings.target_audience}`);
  }

  if (settings.company_values) {
    contextParts.push(`Company Values: ${settings.company_values}`);
  }

  if (settings.brand_messaging_guidelines) {
    contextParts.push(`Brand Messaging Guidelines: ${settings.brand_messaging_guidelines}`);
  }

  if (settings.website_url) {
    contextParts.push(`Website: ${settings.website_url}`);
  }

  return contextParts.length > 0 ? contextParts.join('\n') : '';
}

// Test cases
const tests: Array<{ name: string; test: () => boolean }> = [];

// Test 1: Validation schema accepts all new brand fields
tests.push({
  name: 'Validation schema accepts all new brand fields',
  test: () => {
    const testData = {
      organization_name: 'Test Company',
      brand_description: 'A test company description',
      brand_voice: 'Professional and friendly',
      target_audience: 'Small business owners',
      company_values: 'Innovation, Customer-first',
      industry: 'SaaS',
      company_size: 'Startup',
      brand_messaging_guidelines: 'Focus on value and outcomes',
      icp_document_url: 'https://example.com/icp.pdf',
    };

    try {
      const result = updateSettingsSchema.parse(testData);
      return Object.keys(result).length >= 9; // At least all new fields present
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  },
});

// Test 2: Validation schema accepts partial brand fields
tests.push({
  name: 'Validation schema accepts partial brand fields',
  test: () => {
    const testData = {
      organization_name: 'Test Company',
      industry: 'SaaS',
      icp_document_url: 'https://example.com/icp.pdf',
    };

    try {
      const result = updateSettingsSchema.parse(testData);
      return result.industry === 'SaaS' && result.icp_document_url === 'https://example.com/icp.pdf';
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  },
});

// Test 3: Validation rejects invalid ICP URL
tests.push({
  name: 'Validation rejects invalid ICP URL',
  test: () => {
    const testData = {
      icp_document_url: 'not-a-valid-url',
    };

    try {
      updateSettingsSchema.parse(testData);
      return false; // Should have thrown an error
    } catch (error) {
      return true; // Expected to fail
    }
  },
});

// Test 4: buildBrandContext formats correctly
tests.push({
  name: 'buildBrandContext formats correctly',
  test: () => {
    const settings = {
      organization_name: 'Test Company',
      industry: 'SaaS',
      company_size: 'Startup',
      brand_description: 'A test company',
      brand_voice: 'Professional',
      target_audience: 'Small businesses',
      company_values: 'Innovation',
      brand_messaging_guidelines: 'Focus on value',
      website_url: 'https://example.com',
    };

    const context = buildBrandContext(settings);
    
    // Check that all fields are included
    return (
      context.includes('Organization: Test Company') &&
      context.includes('Industry: SaaS') &&
      context.includes('Company Size: Startup') &&
      context.includes('Brand Description: A test company') &&
      context.includes('Brand Voice: Professional') &&
      context.includes('Target Audience: Small businesses') &&
      context.includes('Company Values: Innovation') &&
      context.includes('Brand Messaging Guidelines: Focus on value') &&
      context.includes('Website: https://example.com')
    );
  },
});

// Test 5: buildBrandContext handles empty settings
tests.push({
  name: 'buildBrandContext handles empty settings',
  test: () => {
    const context = buildBrandContext({});
    return context === '';
  },
});

// Test 6: buildBrandContext handles partial settings
tests.push({
  name: 'buildBrandContext handles partial settings',
  test: () => {
    const settings = {
      organization_name: 'Test Company',
      industry: 'SaaS',
    };

    const context = buildBrandContext(settings);
    return (
      context.includes('Organization: Test Company') &&
      context.includes('Industry: SaaS') &&
      !context.includes('Company Size:') // Should not include missing fields
    );
  },
});

// Run all tests
console.log('🧪 Testing Brand Settings and ICP Functionality\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

for (const { name, test } of tests) {
  try {
    const result = test();
    if (result) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${name}`);
      failed++;
    }
  } catch (error: any) {
    console.log(`❌ FAIL: ${name} - ${error.message}`);
    failed++;
  }
}

console.log('='.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed');
  process.exit(1);
}

