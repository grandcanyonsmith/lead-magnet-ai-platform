# Contributing to Documentation

> **Last Updated**: 2025-01-27  
> **Status**: Current  
> **Related Docs**: [Documentation Index](./README.md), [Coding Standards](./CODING_STANDARDS.md)

Guidelines for contributing to the Lead Magnet AI Platform documentation.

## Code Contribution

For code contributions, please strictly adhere to the [Coding Standards](./CODING_STANDARDS.md).

**CRITICAL RULE**: **NEVER use strict timeouts for AI operations.** See [Coding Standards](./CODING_STANDARDS.md#async-operations--timeouts) for details.

## Documentation Standards

### Structure

All documentation files should follow this structure:

1. **Header Section** (required):
   ```markdown
   # Document Title
   
   > **Last Updated**: YYYY-MM-DD  
   > **Status**: Current | Historical | Deprecated  
   > **Related Docs**: [Link to related docs]
   
   [Brief description]
   ```

2. **Content Sections**: Use clear, hierarchical headings (H2, H3, etc.)

3. **Related Documentation Section** (required at end):
   ```markdown
   ## Related Documentation
   
   - [Document Name](./FILENAME.md) - Brief description
   ```

### Formatting Standards

#### Code Blocks
- Always include language tags: ` ```bash `, ` ```python `, ` ```typescript `
- Add context comments explaining what code does
- Mark incomplete examples clearly: `# Example snippet - complete implementation needed`

#### File Paths
- Use backticks: `` `path/to/file` ``
- Use forward slashes even on Windows: `backend/api/src/index.ts`

#### Commands
- Use backticks: `` `command --flag` ``
- Show complete commands with all required parameters
- Include expected output when helpful

#### Environment Variables
- Use `$VARIABLE_NAME` format
- Show how to set: `export VARIABLE_NAME="value"`

#### API Endpoints
- Use format: `GET /api/endpoint`
- Include HTTP method and path
- Show request/response examples when relevant

### Content Guidelines

#### For AI Model Consumption

1. **Clear Metadata**: Include status, last updated date, and related docs
2. **Consistent Structure**: Use standardized sections across documents
3. **Comprehensive Cross-References**: Link to related concepts
4. **Structured Data**: Use consistent formatting for all technical elements
5. **No Hardcoded Values**: Use placeholders and instructions for finding values

#### Writing Style

- **Be Clear and Concise**: Get to the point quickly
- **Use Examples**: Show, don't just tell
- **Provide Context**: Explain why, not just what
- **Cross-Reference**: Link to related documentation
- **Update Dates**: Keep "Last Updated" dates current

### Removing Hardcoded Values

**Don't include:**
- AWS Account IDs
- Hardcoded URLs
- Credentials or passwords
- Specific resource ARNs/IDs

**Do include:**
- Instructions for finding values using AWS CLI
- CloudFormation output queries
- Environment variable placeholders
- Pattern examples

**Example:**
```markdown
# Bad
API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"

# Good
API_URL=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-api \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)
```

## Adding New Documentation

### Process

1. **Create File**: Add new `.md` file to `docs/` directory
2. **Add Header**: Include standard header with metadata
3. **Write Content**: Follow structure and formatting standards
4. **Add Cross-References**: Link to related documentation
5. **Update Index**: Add entry to `docs/README.md`
6. **Update Related Docs**: Add links from related documents

### File Naming

- Use `UPPERCASE_WITH_UNDERSCORES.md` for main docs
- Use descriptive names: `TROUBLESHOOTING.md`, `DEPLOYMENT.md`
- Keep names concise but clear

## Updating Existing Documentation

### When to Update

- Information becomes outdated
- New features are added
- Errors are discovered
- Structure needs improvement

### Update Process

1. **Review Current Content**: Understand what needs changing
2. **Update Content**: Make necessary changes
3. **Update Metadata**: Change "Last Updated" date
4. **Verify Cross-References**: Ensure links still work
5. **Check Related Docs**: Update if changes affect other docs

## Archiving Documentation

### When to Archive

- Documentation is superseded by newer versions
- Features are deprecated
- Historical reference only

### Archive Process

1. **Move to Archive**: Move file to `docs/archive/` directory
2. **Update Status**: Change status to "Historical" in header
3. **Update Index**: Remove from main index, add to archive index
4. **Update Cross-References**: Update links in related docs

## Review Checklist

Before submitting documentation changes:

- [ ] Header section includes all required metadata
- [ ] "Last Updated" date is current
- [ ] Related Documentation section included
- [ ] No hardcoded credentials or account IDs
- [ ] Code examples include language tags
- [ ] Cross-references are accurate
- [ ] Formatting is consistent
- [ ] Content is clear and accurate
- [ ] Examples are complete or marked as snippets

## Related Documentation

- [Documentation Index](./README.md) - Main documentation navigation
- [Architecture Overview](./ARCHITECTURE.md) - System architecture
- [Deployment Guide](./DEPLOYMENT.md) - Deployment documentation

---

**Note**: This documentation is optimized for both human readers and AI model consumption. Follow these guidelines to ensure consistency and maintainability.

