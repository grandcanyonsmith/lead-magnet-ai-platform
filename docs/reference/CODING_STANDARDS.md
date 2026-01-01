# Coding Standards

> **Last Updated**: 2025-12-26  
> **Status**: Current  
> **Related Docs**: [Documentation Index](./README.md)

This document outlines the coding standards and best practices for the Lead Magnet AI Platform.

## Backend Guidelines

### Async Operations & Timeouts

**CRITICAL RULE**: **NEVER use strict timeouts for AI operations or long-running tasks.**

The platform relies heavily on AI models (like GPT-5.2) and external services that have variable and sometimes unpredictable latency. Imposing strict timeouts (e.g., using `withTimeout` or `Promise.race`) often leads to premature failures for valid operations that are simply taking longer than expected.

**Guidelines:**
1.  **Remove Timeouts**: Do not wrap OpenAI API calls or other long-running async operations in timeout helpers. Let the underlying infrastructure (Lambda, API Gateway) or the provider's native timeout settings handle limits.
2.  **Handle Latency Gracefully**: Design the system to handle long-running requests asynchronously (e.g., job queues, background processing) rather than synchronous blocking calls where possible.
3.  **Use Native Provider Timeouts**: If a timeout is absolutely necessary (e.g., to prevent hanging connections), use the client library's built-in timeout configuration (e.g., OpenAI client `timeout` option) rather than a custom wrapper, and set it to a very generous limit (e.g., 10-15 minutes).

**Bad Example:**
```typescript
// BAD: Wraps call in a strict timeout that cuts off valid long-running requests
import { withTimeout } from './utils/timeout';

const result = await withTimeout(
  openai.chat.completions.create({ ... }),
  30000 // 30s timeout - Too short!
);
```

**Good Example:**
```typescript
// GOOD: Let the operation run naturally
const result = await openai.chat.completions.create({ ... });
```

### AI Service Integration

- **Reasoning Effort**: For complex tasks (e.g., workflow editing), prefer `reasoning: { effort: 'medium' }` or `high` to ensure quality, but be aware this increases latency.
- **Parallelization**: When fetching context or multiple independent data points, always use `Promise.all` to fetch concurrently rather than sequentially.

## Frontend Guidelines

### Async Data Loading

- **Loading States**: Always implement loading states for async operations.
- **Optimistic UI**: Use optimistic updates where appropriate to improve perceived performance.
- **Error Handling**: Gracefully handle errors from backend APIs, including 503s or network errors which might occur during high load.

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Local Development Guide](./LOCAL_DEVELOPMENT.md)

