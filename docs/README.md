# Lead Magnet AI Platform - Documentation

> **Last Updated**: 2025-01-27  
> **Status**: Current  
> **Target Audience**: Developers, Operators, AI Models

Welcome to the Lead Magnet AI Platform documentation. This index provides organized access to all documentation resources, optimized for both human readers and AI model consumption.

## Documentation Structure

This documentation is organized into logical categories for easy navigation and discovery.

### 📚 Categories

#### Getting Started
Essential guides for new users and developers.

- **[Quick Start Guide](./getting-started/QUICK_START.md)** - Get up and running quickly with the platform
  - Platform URLs and access
  - Test commands and verification
  - First workflow creation
- **[Quick GitHub Setup](./getting-started/QUICK_GITHUB_SETUP.md)** - Fast GitHub repository setup
- **[Quick Edit Testing](./getting-started/QUICK_EDIT_TESTING.md)** - Quick testing guide for editing features

#### Architecture
Technical architecture and system design documentation.

- **[Architecture Overview](./architecture/ARCHITECTURE.md)** - Complete system architecture and technology stack
  - Technology stack details
  - Project structure
  - Database schema
  - Security and monitoring
- **[Flow Diagram](./architecture/FLOW_DIAGRAM.md)** - Visual process flow diagrams
  - Complete form submission flow
  - Job processing workflow
  - Artifact creation process
- **[Execution Paths](./architecture/EXECUTION_PATHS.md)** - Detailed execution flow documentation
- **[Workflow Formats](./architecture/WORKFLOW_FORMATS.md)** - Workflow format specifications
- **[Image Generation Flow](./architecture/IMAGE_GENERATION_FLOW.md)** - Image generation process documentation

#### Deployment
Deployment guides and infrastructure setup.

- **[Deployment Guide](./deployment/DEPLOYMENT.md)** - Complete deployment instructions
  - Prerequisites and setup
  - Infrastructure deployment
  - CI/CD configuration
  - Post-deployment tasks
- **[Worker Deployment](./deployment/DEPLOY_WORKER.md)** - Worker service deployment guide
- **[CUA Deployment](./deployment/CUA_DEPLOYMENT.md)** - Computer Use API deployment
- **[Lambda Build Options](./deployment/LAMBDA_BUILD_OPTIONS.md)** - Lambda build configuration
- **[GitHub Secrets Setup](./deployment/GITHUB_SECRETS_SETUP.md)** - CI/CD secrets configuration

#### Development
Development-specific documentation.

- **[Local Development](./development/LOCAL_DEVELOPMENT.md)** - Local development environment setup
- **[Contributing Guide](./development/CONTRIBUTING.md)** - Contribution guidelines and standards
- **[Debug Jobs](./development/DEBUG_JOBS.md)** - Debugging job processing

#### Testing
Comprehensive testing documentation and guides.

- **[Testing Guide](./testing/TESTING_GUIDE.md)** - General testing overview and best practices
- **[Manual Testing Guide](./testing/MANUAL_TESTING_GUIDE.md)** - Manual testing procedures
- **[Frontend Test Guide](./testing/FRONTEND_TEST_GUIDE.md)** - Frontend testing strategies
- **[Mobile Testing](./testing/MOBILE_TESTING.md)** - Mobile device testing guide
- **[Mobile QA Report](./testing/MOBILE_QA_REPORT.md)** - Mobile quality assurance report
- **[Complete Mobile Testing Summary](./testing/COMPLETE_MOBILE_TESTING_SUMMARY.md)** - Comprehensive mobile testing summary
- **[Workflow Edit Mobile Test](./testing/WORKFLOW_EDIT_MOBILE_TEST.md)** - Mobile workflow editing tests
- **[Test Quick Edit](./testing/TEST_QUICK_EDIT.md)** - Quick edit feature testing
- **[Test Workflow Generation E2E](./testing/TEST_WORKFLOW_GENERATION_E2E.md)** - End-to-end workflow generation tests
- **[Test Image Rendering](./testing/test-image-rendering.md)** - Image rendering tests
- **[Settings Page Test Summary](./testing/SETTINGS_PAGE_TEST_SUMMARY.md)** - Settings page testing results

#### Technical
Technical specifications and implementation details.

- **[Authentication](./technical/AUTHENTICATION.md)** - Authentication system documentation
- **[Webhook](./technical/WEBHOOK.md)** - Webhook implementation and usage
- **[Artifact URLs](./technical/ARTIFACT_URLS.md)** - Artifact URL handling and structure
- **[Image Processing Utils](./technical/IMAGE_PROCESSING_UTILS.md)** - Image processing utilities
- **[Execution Steps S3 Optimization](./technical/EXECUTION_STEPS_S3_OPTIMIZATION.md)** - S3 optimization for execution steps
- **[Course Topic Dossier Instructions](./technical/COURSE_TOPIC_DOSSIER_INSTRUCTIONS.md)** - Course topic dossier specifications

#### Refactoring
Refactoring documentation and audits.

- **[AI Service Refactoring](./refactoring/AI_SERVICE_REFACTORING.md)** - AI service architecture and refactoring details
  - Helper methods documentation
  - Code metrics and improvements
  - Testing information
- **[Computer Use Timeout Audit](./refactoring/COMPUTER_USE_TIMEOUT_AUDIT.md)** - Computer use timeout audit report

#### Reference
Reference materials and operational documentation.

- **[Resources](./reference/RESOURCES.md)** - AWS resource inventory and management
  - Resource listings and IDs
  - Management commands
  - Cost breakdown
- **[Troubleshooting](./reference/TROUBLESHOOTING.md)** - Common issues and solutions
  - Log event troubleshooting
  - API error handling
  - Best practices
- **[Glossary](./reference/GLOSSARY.md)** - Terminology and definitions
- **[Changelog](./reference/CHANGELOG.md)** - Complete version history and changes
  - Recent changes and fixes
  - Feature additions
  - Breaking changes

#### Reports
Usage reports and analytics data.

- **[Computer Use Usage Report](./reports/computer-use-usage-report.json)** - Computer use usage analytics
- **[Legacy Workflow Usage Report](./reports/legacy-workflow-usage-report.json)** - Legacy workflow usage data

## Quick Navigation

### For New Users
1. Start with [Quick Start Guide](./getting-started/QUICK_START.md)
2. Review [Architecture Overview](./architecture/ARCHITECTURE.md) for system understanding
3. Follow [Deployment Guide](./deployment/DEPLOYMENT.md) for setup

### For Developers
1. Read [Architecture Overview](./architecture/ARCHITECTURE.md) for system design
2. Review [Flow Diagram](./architecture/FLOW_DIAGRAM.md) for process understanding
3. Check [Local Development](./development/LOCAL_DEVELOPMENT.md) for setup
4. Review [AI Service Refactoring](./refactoring/AI_SERVICE_REFACTORING.md) for code details

### For Operators
1. Use [Resources](./reference/RESOURCES.md) for resource management
2. Reference [Troubleshooting](./reference/TROUBLESHOOTING.md) for issue resolution
3. Monitor [Changelog](./reference/CHANGELOG.md) for updates

### For AI Models
This documentation is structured for optimal AI consumption:

- **Clear Metadata**: Each document includes status, last updated date, and related docs
- **Consistent Structure**: Standardized sections and formatting across all documents
- **Cross-References**: Documents link to related content for comprehensive understanding
- **Structured Data**: Consistent formatting for paths, commands, and resources

**Recommended Reading Order for AI Models:**
1. [Architecture Overview](./architecture/ARCHITECTURE.md) - System understanding
2. [Flow Diagram](./architecture/FLOW_DIAGRAM.md) - Process flows
3. [Deployment Guide](./deployment/DEPLOYMENT.md) - Infrastructure details
4. [Resources](./reference/RESOURCES.md) - Resource inventory
5. [Troubleshooting](./reference/TROUBLESHOOTING.md) - Error handling patterns

## Document Metadata

Each document includes:
- **Last Updated**: Date of last modification
- **Status**: Current | Historical | Deprecated
- **Related Docs**: Links to related documentation
- **Target Audience**: Intended readers

## Contributing to Documentation

See [Contributing Guide](./development/CONTRIBUTING.md) for documentation contribution guidelines.

## Related Documentation

- [Root README](../readme.md) - Project overview

---

**Note**: This documentation is optimized for both human readers and AI model consumption. All documents follow consistent formatting standards and include comprehensive cross-references.

