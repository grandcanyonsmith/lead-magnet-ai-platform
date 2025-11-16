# Infrastructure Tests

This directory contains tests for the CDK infrastructure code.

## Test Setup

### Prerequisites

- Node.js 18+ and npm
- AWS CDK CLI installed: `npm install -g aws-cdk`
- TypeScript: `npm install -g typescript`

### Running Tests

Tests can be written using CDK's built-in testing capabilities or standard testing frameworks like Jest.

```bash
# Install test dependencies (if using Jest)
npm install --save-dev jest @types/jest ts-jest

# Run tests
npm test
```

## Test Structure

Tests should mirror the structure of the `lib/` directory:

```
tests/
├── stacks/          # Tests for CDK stacks
├── utils/           # Tests for utility functions
├── monitoring/      # Tests for monitoring helpers
└── stepfunctions/   # Tests for Step Functions definitions
```

## Writing Tests

### Stack Tests

Test stacks to ensure they create the expected resources:

```typescript
import { Template } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/stacks/database-stack';

test('DatabaseStack creates DynamoDB tables', () => {
  const app = new App();
  const stack = new DatabaseStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'workflows',
  });
});
```

### Utility Function Tests

Test utility functions for correct behavior:

```typescript
import { createTable } from '../lib/utils/dynamodb-helpers';

test('createTable creates table with correct configuration', () => {
  // Test implementation
});
```

## Best Practices

1. **Test resource creation**: Verify that stacks create expected AWS resources
2. **Test helper functions**: Ensure utility functions work correctly
3. **Test error handling**: Verify error cases are handled properly
4. **Use CDK assertions**: Leverage `aws-cdk-lib/assertions` for resource validation
5. **Mock dependencies**: Use mocks for external dependencies when testing in isolation

## Continuous Integration

Tests should be run as part of the CI/CD pipeline before deploying infrastructure changes.

