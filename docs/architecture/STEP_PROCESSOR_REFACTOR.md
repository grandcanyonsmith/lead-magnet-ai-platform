# Step Processor Refactoring

## Overview

The `StepProcessor` service has been refactored to decouple step execution logic from the main orchestration class. Previously, `StepProcessor` contained all execution logic for AI steps, webhooks, and other operations, making it a "God Class" that was hard to maintain and test.

The new architecture follows the **Strategy Pattern**, delegating execution to specific handlers based on the step type.

## Architecture

### 1. Coordinator (`StepProcessor`)
- **Location**: `backend/worker/services/step_processor.py`
- **Responsibilities**:
  - Initializes the `StepRegistry`.
  - Determines the step type (normalizing legacy types).
  - Retrieves the appropriate handler from the registry.
  - Manages common context logging and error handling boundaries.
  - Reloads execution state from storage (DynamoDB/S3) to ensure consistency.
  - Dispatches execution to the handler.

### 2. Registry (`StepRegistry`)
- **Location**: `backend/worker/services/steps/registry.py`
- **Responsibilities**:
  - Maps step type strings (e.g., `'ai_generation'`, `'webhook'`) to handler instances.
  - Allows dynamic registration of new handlers.

### 3. Handlers (`AbstractStepHandler`)
- **Location**: `backend/worker/services/steps/base.py` (Base class)
- **Implementations**:
  - `AIStepHandler` (`backend/worker/services/steps/handlers/ai_generation.py`): Handles AI generation, including tool usage and context building.
  - `WebhookStepHandler` (`backend/worker/services/steps/handlers/webhook.py`): Handles HTTP webhooks and Slack notifications.
  - `BrowserStepHandler` (`backend/worker/services/steps/handlers/browser_automation.py`): Handles browser automation (placeholder/CUA).
  - `HtmlStepHandler` (`backend/worker/services/steps/handlers/html_patch.py`): Handles HTML patching.

### 4. Dependency Injection
The `StepProcessor` is initialized with core services (`AIService`, `DynamoDBService`, etc.), which are bundled into a `services` dictionary and injected into each handler upon registration.

## Data Flow

1. **Job Processing**: `JobProcessor` calls `StepProcessor.process_step_batch_mode` or `process_single_step`.
2. **Routing**: `StepProcessor` inspects the `step` dictionary.
   - If `webhook_url` is present, it forces type to `'webhook'`.
   - Otherwise uses `step_type` (defaulting to `'ai_generation'`).
3. **Delegation**: `StepProcessor` looks up the handler in `StepRegistry`.
4. **Execution**: The handler's `execute` method is called with context and inputs.
5. **Persistence**: The handler is responsible for creating `ExecutionStep` records and updating the job state in DynamoDB/S3.
6. **Return**: The handler returns a result dictionary and a list of generated artifact IDs.

## Adding a New Step Type

1. Create a new handler class inheriting from `AbstractStepHandler` in `backend/worker/services/steps/handlers/`.
2. Implement the `execute` method.
3. Register the handler in `StepProcessor.__init__`:
   ```python
   self.registry.register('my_new_step', MyNewStepHandler(services))
   ```

## Testing

- Unit tests for the coordinator are in `backend/worker/test_step_processor_refactor.py`.
- Handlers should be tested individually (e.g., `test_webhook_step.py`).
