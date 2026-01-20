# Computer Use API Implementation - Deployment Summary

## ✅ Deployment Complete

The Computer Use API (CUA) loop implementation has been successfully deployed to AWS Lambda.

### Changes Deployed

1. **Browser Service** (`browser_service.py`)
   - Playwright-based browser automation
   - Supports click, type, scroll, keypress, wait actions
   - Screenshot capture functionality

2. **CUA Loop** (`image_handler.py`)
   - Full Computer Use API loop implementation
   - Executes actions → captures screenshots → sends back to model
   - Handles safety checks
   - Uploads screenshots to S3

3. **AI Service Integration** (`ai_service.py`)
   - Detects `computer-use-preview` model usage
   - Routes to CUA loop automatically
   - Returns screenshot URLs in response

4. **Lambda Configuration**
   - Memory: 3008MB (increased from 2048MB)
   - Timeout: 900 seconds (15 minutes)
   - Code size: ~64MB

### ⚠️ Important Note: Playwright Browsers

**Playwright browsers are NOT included in the deployment package.** They need to be installed separately for Lambda.

**Options:**

1. **Install at Runtime** (Current approach)
   - Browsers will be installed on first invocation
   - Adds ~30-60 seconds to cold start time
   - Code will automatically install browsers when needed

2. **Lambda Layer** (Recommended for production)
   - Create a Lambda Layer with Playwright browsers
   - Reduces cold start time
   - Requires creating a layer with browsers pre-installed

3. **Container Image** (Alternative)
   - Use Lambda container image with browsers pre-installed
   - Requires Docker build with browsers

### Testing

Local tests passed:
- ✅ Playwright Installation
- ✅ Browser Service (navigation, screenshot capture)
- ✅ CUA Loop Structure

### Next Steps

1. **Test with a real workflow** that uses `computer-use-preview`
2. **Monitor cold start times** - first invocation will install browsers
3. **Consider creating a Lambda Layer** for browsers to reduce cold start

### Function Details

There are two ways CUA runs in this system:

1. **Workflow processing (automatic)**: runs inside the **job processor** Lambda during normal workflow execution.
2. **Admin step tester (streaming)**: the API `/admin/cua/execute` endpoint invokes a dedicated Lambda function.

**Deployed Lambda functions (default names):**

- **Job Processor**: (stack-created; see CloudFormation output `JobProcessorLambdaArn`)
- **CUA Streaming Worker**: `leadmagnet-cua-worker`
- **Shell Streaming Worker**: `leadmagnet-shell-worker`

**Region**: `us-east-1`
**Memory/Timeout**: Set via CDK defaults (see `infrastructure/lib/config/constants.ts`)

### Usage

The CUA loop will automatically activate when:
- Model is `computer-use-preview` (or contains `computer-use`)
- Tool `computer_use_preview` is in the tools list

No additional configuration needed - it works automatically!

### Environment Selection

By default, CUA uses the Playwright browser environment. You can override this with:

- Tool config: set `environment` on the `computer_use_preview` tool (e.g. `docker_vm` or `playwright`)
- Env var: `CUA_ENVIRONMENT=docker_vm|playwright`

Tool config takes precedence over the env var.

### Docker VM Configuration

When using `docker_vm`, the worker will execute actions via `docker exec` + `xdotool`
and capture screenshots from the container. These settings are configurable:

- `CUA_DOCKER_CONTAINER_NAME` (default `cua-image`)
- `CUA_DOCKER_VNC_DISPLAY` (default `:99`)
- `CUA_DOCKER_AUTO_START` (default `true`)
- `CUA_DOCKER_RUN_CMD` (optional, create container if missing; supports `{container_name}`, `{display}`, `{display_width}`, `{display_height}`)
- `CUA_DOCKER_STOP_ON_CLEANUP` (default `false`)
- `CUA_DOCKER_XDOTOOL_CMD` (default `xdotool`)
- `CUA_DOCKER_XDOTOOL_DELAY_MS` (default `50`)
- `CUA_DOCKER_SCREENSHOT_CMD` (default `import -window root png:-`)
- `CUA_DOCKER_SCROLL_STEP` (default `120`)
- `CUA_DOCKER_READY_TIMEOUT_SECONDS` (default `20`)
- `CUA_DOCKER_WINDOW_ID` (optional; focus a specific window before actions)
- `CUA_DOCKER_BIN` (default `docker`)

Your container must have `xdotool` and whatever screenshot tool you configure
(`import` from ImageMagick by default).

