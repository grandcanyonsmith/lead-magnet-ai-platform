# Most Important Files to Refactor

## 🔴 Critical Priority (1000+ lines)
These files are extremely large and likely contain multiple responsibilities that should be split.

1. **`backend/worker/services/openai_client.py`** (1,218 lines)
   - **Why**: Massive service file handling OpenAI interactions
   - **Impact**: Core AI functionality, likely has multiple responsibilities
   - **Refactoring**: Split into smaller services (chat, vision, embeddings, etc.)

2. **`backend/worker/services/step_processor.py`** (1,071 lines)
   - **Why**: Very large processor handling workflow steps
   - **Impact**: Core workflow execution logic
   - **Refactoring**: Break into step-specific processors or use strategy pattern

## 🟠 High Priority (500-1000 lines)
Large files that handle complex business logic and would benefit from modularization.

3. **`backend/worker/utils/image_utils.py`** (604 lines)
   - **Why**: Large utility file for image processing
   - **Impact**: Image handling across the application
   - **Refactoring**: Split into specialized modules (conversion, validation, optimization)

4. **`frontend/src/app/dashboard/agency/users/page.tsx`** (520 lines)
   - **Why**: Large page component likely doing too much
   - **Impact**: User management UI
   - **Refactoring**: Extract components, hooks, and business logic

5. **`frontend/src/features/jobs/hooks/useJobDetail.ts`** (483 lines)
   - **Why**: Very large hook with multiple responsibilities
   - **Impact**: Job detail functionality
   - **Refactoring**: Split into smaller hooks (useJobData, useJobActions, useJobStatus, etc.)

6. **`frontend/src/features/workflows/components/workflows/edit/FormTab.tsx`** (470 lines)
   - **Why**: Large form component
   - **Impact**: Workflow editing UI
   - **Refactoring**: Extract sub-components and form logic

## 🟡 Medium-High Priority (400-500 lines)
Significant files that could be improved with better separation of concerns.

7. **`backend/api/src/controllers/workflowAIController.ts`** (734 lines)
   - **Why**: Large controller handling AI workflow operations
   - **Impact**: Core API endpoint for AI workflows
   - **Refactoring**: Extract service layer, split into multiple controllers

8. **`frontend/src/app/dashboard/workflows/[...slug]/page-client.tsx`** (462 lines)
   - **Why**: Large page component
   - **Impact**: Workflow detail/edit page
   - **Refactoring**: Extract components and custom hooks

9. **`frontend/src/app/dashboard/forms/[id]/edit/page-client.tsx`** (456 lines)
   - **Why**: Large form editing page
   - **Impact**: Form editing functionality
   - **Refactoring**: Component extraction and hook separation

10. **`frontend/src/app/v1/forms/[[...slug]]/page-client.tsx`** (451 lines)
    - **Why**: Large public form page
    - **Impact**: Public form rendering
    - **Refactoring**: Extract form components and logic

11. **`frontend/src/app/dashboard/workflows/page.tsx`** (445 lines)
    - **Why**: Large workflows listing page
    - **Impact**: Main workflows page
    - **Refactoring**: Extract table/list components and filters

12. **`backend/worker/services/job_completion_service.py`** (439 lines)
    - **Why**: Large service handling job completion
    - **Impact**: Job completion logic
    - **Refactoring**: Split into completion handlers for different job types

13. **`backend/worker/processor.py`** (434 lines)
    - **Why**: Core processor file
    - **Impact**: Main processing logic
    - **Refactoring**: Extract processing strategies

14. **`backend/worker/core/delivery_service.py`** (423 lines)
    - **Why**: Large delivery service
    - **Impact**: Artifact delivery logic
    - **Refactoring**: Split delivery methods into separate handlers

15. **`frontend/src/features/jobs/components/jobs/StepContent.tsx`** (421 lines)
    - **Why**: Large component rendering step content
    - **Impact**: Job step display
    - **Refactoring**: Extract step renderers for different step types

16. **`frontend/src/app/dashboard/workflows/[...slug]/EditWorkflowClient.tsx`** (420 lines)
    - **Why**: Large workflow editor component
    - **Impact**: Workflow editing
    - **Refactoring**: Extract editor sections into separate components

17. **`backend/api/src/controllers/workflows.ts`** (417 lines)
    - **Why**: Large workflows controller
    - **Impact**: Workflow API endpoints
    - **Refactoring**: Extract service layer, split CRUD operations

18. **`frontend/src/app/onboarding/survey/page.tsx`** (414 lines)
    - **Why**: Large onboarding page
    - **Impact**: User onboarding flow
    - **Refactoring**: Extract survey steps into components

19. **`backend/api/src/services/templateAIService.ts`** (414 lines)
    - **Why**: Large template AI service
    - **Impact**: Template generation with AI
    - **Refactoring**: Split into template generation strategies

20. **`backend/worker/core/dependency_resolver.py`** (412 lines)
    - **Why**: Large dependency resolution logic
    - **Impact**: Workflow dependency management
    - **Refactoring**: Extract resolution strategies

## 🟢 Medium Priority (300-400 lines)
Files that are getting large and should be monitored/refactored before they grow further.

21. **`backend/worker/core/db_service.py`** (406 lines)
    - **Why**: Database service with multiple responsibilities
    - **Impact**: Database operations
    - **Refactoring**: Split into repository pattern or specialized services

22. **`backend/api/src/utils/dependencyResolver.ts`** (405 lines)
    - **Why**: Large utility for dependency resolution
    - **Impact**: Dependency management
    - **Refactoring**: Extract resolution algorithms

23. **`backend/api/src/controllers/admin.ts`** (402 lines)
    - **Why**: Large admin controller
    - **Impact**: Admin operations
    - **Refactoring**: Split into admin sub-controllers

24. **`frontend/src/features/workflows/components/workflows/edit/TemplateTab.tsx`** (399 lines)
    - **Why**: Large template editing component
    - **Impact**: Template editing UI
    - **Refactoring**: Extract template editor components

25. **`frontend/src/app/dashboard/forms/new/page-client.tsx`** (391 lines)
    - **Why**: Large form creation page
    - **Impact**: Form creation
    - **Refactoring**: Extract form builder components

26. **`backend/api/src/controllers/files.ts`** (389 lines)
    - **Why**: Large files controller
    - **Impact**: File management API
    - **Refactoring**: Extract file service layer

27. **`frontend/src/features/workflows/components/workflow-pages/WorkflowFlowchart.tsx`** (382 lines)
    - **Why**: Large flowchart component
    - **Impact**: Workflow visualization
    - **Refactoring**: Extract node and edge components

28. **`backend/api/src/utils/errorHandling.ts`** (362 lines)
    - **Why**: Large error handling utility
    - **Impact**: Error handling across API
    - **Refactoring**: Split into error types and handlers

29. **`frontend/src/features/workflows/components/workflows/edit/WorkflowTab.tsx`** (355 lines)
    - **Why**: Large workflow tab component
    - **Impact**: Workflow editing
    - **Refactoring**: Extract tab sections

30. **`frontend/src/features/jobs/components/jobs/StepEditModal.tsx`** (354 lines)
    - **Why**: Large modal component
    - **Impact**: Step editing UI
    - **Refactoring**: Extract form sections

31. **`backend/worker/core/ai_service.py`** (354 lines)
    - **Why**: Large AI service
    - **Impact**: AI operations
    - **Refactoring**: Split into AI operation types

32. **`backend/api/src/utils/validation.ts`** (346 lines)
    - **Why**: Large validation utility
    - **Impact**: Input validation
    - **Refactoring**: Split into domain-specific validators

33. **`backend/api/src/controllers/artifacts.ts`** (346 lines)
    - **Why**: Large artifacts controller
    - **Impact**: Artifact management API
    - **Refactoring**: Extract artifact service

34. **`backend/worker/core/artifact_service.py`** (345 lines)
    - **Why**: Large artifact service
    - **Impact**: Artifact operations
    - **Refactoring**: Split artifact types into handlers

35. **`frontend/src/app/dashboard/workflows/new/page.tsx`** (344 lines)
    - **Why**: Large workflow creation page
    - **Impact**: Workflow creation
    - **Refactoring**: Extract workflow builder components

36. **`backend/api/src/utils/authContext.ts`** (344 lines)
    - **Why**: Large auth context utility
    - **Impact**: Authentication
    - **Refactoring**: Split auth concerns

37. **`frontend/src/features/jobs/components/jobs/StepHeader.tsx`** (343 lines)
    - **Why**: Large step header component
    - **Impact**: Step display
    - **Refactoring**: Extract header sections

38. **`frontend/src/features/artifacts/components/artifacts/PreviewRenderer.tsx`** (343 lines)
    - **Why**: Large preview renderer
    - **Impact**: Artifact preview
    - **Refactoring**: Extract renderers for different artifact types

39. **`backend/api/src/controllers/jobs.ts`** (335 lines)
    - **Why**: Large jobs controller
    - **Impact**: Job management API
    - **Refactoring**: Extract job service layer

40. **`backend/api/src/services/executionStepsService.ts`** (331 lines)
    - **Why**: Large execution steps service
    - **Impact**: Execution step management
    - **Refactoring**: Split into step type handlers

## Refactoring Strategy Recommendations

### Backend (Python)
- **Service Layer**: Split large services into smaller, focused services
- **Strategy Pattern**: Use for different processing types (steps, artifacts, etc.)
- **Repository Pattern**: Extract database operations from services
- **Factory Pattern**: For creating different handlers/processors

### Frontend (TypeScript/React)
- **Component Extraction**: Break large components into smaller, reusable ones
- **Custom Hooks**: Extract business logic from components into hooks
- **Service Layer**: Move API calls and business logic out of components
- **State Management**: Consider using state management for complex state

### General Principles
1. **Single Responsibility**: Each file should have one clear purpose
2. **Dependency Injection**: Make dependencies explicit and testable
3. **Interface Segregation**: Create focused interfaces rather than large ones
4. **Open/Closed Principle**: Design for extension without modification

## Notes
- Test files are excluded from this list (though they may also need refactoring)
- Scripts and infrastructure files are lower priority for application refactoring
- Build artifacts and generated files are excluded
- Files under 300 lines are not included but should be monitored as they grow

