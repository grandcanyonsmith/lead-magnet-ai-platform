# Testing Guide

## Overview

The API uses Jest for testing with TypeScript support. Tests are located in `src/__tests__/`.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Test Structure

```
src/__tests__/
├── setup.ts              # Test configuration and mocks
├── utils/
│   ├── mocks.ts          # Mock utilities
│   └── awsMocks.ts       # AWS SDK mocks
├── controllers/          # Controller tests
├── services/             # Service tests
└── utils/                # Utility function tests
```

## Writing Tests

### Example Controller Test

```typescript
import { createMockAuthenticatedEvent } from '../utils/mocks';
import { setupDynamoDBItem, resetMocks } from '../utils/awsMocks';

describe('MyController', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should handle request', async () => {
    const event = createMockAuthenticatedEvent('user-id', 'customer-id');
    setupDynamoDBItem('table-name', { id: 'test' }, { id: 'test', data: 'value' });
    
    // Test implementation
  });
});
```

## Mocking AWS Services

The test utilities provide mocks for:
- DynamoDB (via `setupDynamoDBItem`)
- S3 (via `setupS3Object`)
- Secrets Manager (via `setupSecret`)

## Test Coverage

Target coverage: 80%+

Coverage reports are generated in the `coverage/` directory.

