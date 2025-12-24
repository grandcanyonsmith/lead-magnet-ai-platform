# Lead Magnet AI Platform - Documentation

> **Last Updated**: 2025-12-23
> **Status**: Current  
> **Target Audience**: Developers, Operators, AI Models

Welcome to the Lead Magnet AI Platform documentation. This index provides organized access to all documentation resources, optimized for both human readers and AI model consumption.

## Documentation Structure

This documentation is organized into logical categories for easy navigation and discovery.

### 📚 Categories

#### Getting Started
Essential guides for new users and developers.

- **[Quick Start Guide](./QUICK_START.md)** - Get up and running quickly with the platform
  - Platform URLs and access
  - Test commands and verification
  - First workflow creation
- **[Local Development Guide](./LOCAL_DEVELOPMENT.md)** - Set up your local environment
  - Prerequisites and installation
  - Running services locally (ports 3000/3001)
  - Local testing

#### Architecture
Technical architecture and system design documentation.

- **[Architecture Overview](./ARCHITECTURE.md)** - Complete system architecture and technology stack
  - Technology stack details
  - Project structure
  - Database schema
  - Security and monitoring
- **[API Contracts](./contracts/README.md)** - Human-readable API definitions
  - Endpoint definitions
  - Request/Response shapes
  - Client mapping
- **[Authentication](./AUTHENTICATION.md)** - Auth flows and security
  - User pools and identity
  - Role-based access
- **[Flow Diagram](./FLOW_DIAGRAM.md)** - Visual process flow diagrams
  - Complete form submission flow
  - Job processing workflow
  - Artifact creation process

#### Deployment
Deployment guides and infrastructure setup.

- **[Deployment Guide](./DEPLOYMENT.md)** - Complete deployment instructions
  - Prerequisites and setup
  - Infrastructure deployment
  - CI/CD configuration
  - Post-deployment tasks
- **[Lambda Build Options](./LAMBDA_BUILD_OPTIONS.md)** - Deep dive into Lambda packaging
  - Docker builds vs Zip bundles
  - Layer configurations

#### Operations
Operational documentation for running and maintaining the platform.

- **[Resources](./RESOURCES.md)** - AWS resource inventory and management
  - Resource listings and IDs
  - Management commands
  - Cost breakdown
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions
  - Log event troubleshooting
  - API error handling
  - Best practices
- **[GitHub Secrets Setup](./GITHUB_SECRETS_SETUP.md)** - CI/CD secrets management

#### Development
Development-specific documentation.

- **[Testing Guide](./testing/README.md)** - Comprehensive testing index
  - E2E suites and scripts
  - Manual testing playbooks
  - Unit test locations
- **[AI Service Refactoring](./AI_SERVICE_REFACTORING.md)** - AI service architecture and refactoring details
  - Helper methods documentation
  - Code metrics and improvements
  - Testing information

#### History
Historical records and changelogs.

- **[Changelog](./CHANGELOG.md)** - Complete version history and changes
  - Recent changes and fixes
  - Feature additions
  - Breaking changes

#### Archive
Historical documentation (completed/superseded).

- **[Archived Documentation](./archive/README.md)** - Historical reference documents
  - Completed refactoring plans
  - Historical changelogs
  - Superseded documentation

## Quick Navigation

### For New Users
1. Start with [Quick Start Guide](./QUICK_START.md)
2. Review [Architecture Overview](./ARCHITECTURE.md) for system understanding
3. Follow [Deployment Guide](./DEPLOYMENT.md) for setup

### For Developers
1. Read [Architecture Overview](./ARCHITECTURE.md) for system design
2. Review [Flow Diagram](./FLOW_DIAGRAM.md) for process understanding
3. Check [AI Service Refactoring](./AI_SERVICE_REFACTORING.md) for code details

### For Operators
1. Use [Resources](./RESOURCES.md) for resource management
2. Reference [Troubleshooting](./TROUBLESHOOTING.md) for issue resolution
3. Monitor [Changelog](./CHANGELOG.md) for updates

### For AI Models
This documentation is structured for optimal AI consumption:

- **Clear Metadata**: Each document includes status, last updated date, and related docs
- **Consistent Structure**: Standardized sections and formatting across all documents
- **Cross-References**: Documents link to related content for comprehensive understanding
- **Structured Data**: Consistent formatting for paths, commands, and resources

**Recommended Reading Order for AI Models:**
1. [Architecture Overview](./ARCHITECTURE.md) - System understanding
2. [Flow Diagram](./FLOW_DIAGRAM.md) - Process flows
3. [Deployment Guide](./DEPLOYMENT.md) - Infrastructure details
4. [Resources](./RESOURCES.md) - Resource inventory
5. [Troubleshooting](./TROUBLESHOOTING.md) - Error handling patterns

## Document Metadata

Each document includes:
- **Last Updated**: Date of last modification
- **Status**: Current | Historical | Deprecated
- **Related Docs**: Links to related documentation
- **Target Audience**: Intended readers

## Contributing to Documentation

See [Contributing Guide](./CONTRIBUTING.md) for documentation contribution guidelines.

## Related Documentation

- [Root README](../readme.md) - Project overview
- [Local Development Guide](./LOCAL_DEVELOPMENT.md) - Local setup
- [Frontend Test Guide](./testing/FRONTEND_TEST_GUIDE.md) - Frontend testing

---

**Note**: This documentation is optimized for both human readers and AI model consumption. All documents follow consistent formatting standards and include comprehensive cross-references.
