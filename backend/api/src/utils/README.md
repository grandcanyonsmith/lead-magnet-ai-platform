# Utils Directory

This directory contains utility functions and helpers used throughout the API codebase. All utilities follow consistent patterns for error handling, validation, and documentation.

## Structure

### Core Utilities

- **`types.ts`** - Shared type definitions used across utility modules
- **`validators.ts`** - Reusable validation functions and type guards
- **`errorHandling.ts`** - Error handling patterns, retry logic, and timeout utilities
- **`logger.ts`** - Centralized logging utility
- **`errors.ts`** - Custom error classes for API responses
- **`env.ts`** - Environment configuration management

### Data & Storage

- **`db.ts`** - DynamoDB service wrapper
- **`cache.ts`** - In-memory caching utilities
- **`pagination.ts`** - Pagination helpers for database queries

### Authentication & Authorization

- **`authContext.ts`** - Authentication context extraction from JWT claims
- **`rbac.ts`** - Role-based access control helpers
- **`webhookToken.ts`** - Webhook token generation and validation

### Workflow Utilities

- **`workflowPromptBuilder.ts`** - Builds prompts for workflow generation
- **`workflowConfigParser.ts`** - Parses AI-generated workflow configurations
- **`workflowMigration.ts`** - Legacy workflow format migration utilities
- **`dependencyResolver.ts`** - Dependency graph resolution for workflow steps
- **`executionStepsUtils.ts`** - Execution steps URL generation

### Form Utilities

- **`formFieldUtils.ts`** - Form field management and required field enforcement
- **`validation.ts`** - Zod schemas for request validation

### Async & Helpers

- **`asyncHelpers.ts`** - Async operation helpers (parallel, sequential, batch)
- **`retry.ts`** - Retry logic with exponential backoff
- **`timeout.ts`** - Timeout utilities for async operations
- **`transformers.ts`** - Data transformation utilities
- **`openaiHelpers.ts`** - OpenAI API call helpers with timeout

### External Data

- **`icpFetcher.ts`** - ICP (Ideal Customer Profile) document fetching
- **`jobProcessingUtils.ts`** - Job processing utilities

## Usage Patterns

### Validation

Always validate inputs using the validators module:

```typescript
import { validateNonEmptyString, validateUrl } from './validators';

function processData(data: unknown) {
  validateNonEmptyString(data, 'data');
  // ... process data
}
```

### Error Handling

Use error handling utilities for consistent error management:

```typescript
import { safeReturn, retryWithBackoff } from './errorHandling';

const result = await safeReturn(() => riskyOperation());
if (result === null) {
  // Handle error
}

const data = await retryWithBackoff(
  () => fetchData(),
  { maxAttempts: 3 }
);
```

### Timeout Handling

Use timeout utilities for operations that may hang:

```typescript
import { withTimeout } from './timeout';

const result = await withTimeout(
  fetchData(),
  5000,
  'Data fetch timed out'
);
```

### Async Operations

Use async helpers for parallel or sequential execution:

```typescript
import { parallel, batch } from './asyncHelpers';

// Execute in parallel
const results = await parallel([
  () => fetchUser(userId1),
  () => fetchUser(userId2),
  () => fetchUser(userId3),
]);

// Process in batches
const processed = await batch(
  items,
  async (item) => await processItem(item),
  { batchSize: 10, maxConcurrency: 5 }
);
```

## Type Safety

All utilities use TypeScript types from `types.ts`. Import types as needed:

```typescript
import { WorkflowStep, PaginationParams } from './types';
```

## Error Patterns

All utilities follow consistent error handling:

- **Validation errors** throw `ValidationError` from `errors.ts`
- **Network/transient errors** use retry logic from `errorHandling.ts`
- **Timeout errors** use timeout utilities
- **All errors** are logged using the `logger` utility

## Testing

Unit tests for utilities are located in `__tests__/` directory. Each utility module should have corresponding test files.

## Best Practices

1. **Always validate inputs** - Use validators before processing
2. **Use type guards** - Leverage TypeScript type guards from validators
3. **Handle errors gracefully** - Use safeReturn or try/catch as appropriate
4. **Log operations** - Use logger for debugging and monitoring
5. **Document functions** - Include JSDoc with examples for complex functions
6. **Use consistent patterns** - Follow established patterns in existing utilities

## Migration Notes

When refactoring code to use these utilities:

1. Replace inline validation with validators module functions
2. Replace manual retry logic with `retryWithBackoff`
3. Replace manual timeout handling with `withTimeout`
4. Replace `any` types with proper types from `types.ts`
5. Use async helpers for parallel/sequential operations

