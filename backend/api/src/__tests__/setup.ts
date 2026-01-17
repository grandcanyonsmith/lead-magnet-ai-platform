/**
 * Jest test setup file
 * Configures mocks and test environment
 */

// Mock AWS SDK clients before any imports
jest.mock("@aws-sdk/client-dynamodb");
jest.mock("@aws-sdk/lib-dynamodb");
jest.mock("@aws-sdk/client-s3");
jest.mock("@aws-sdk/client-secrets-manager");
jest.mock("@aws-sdk/client-sfn");
jest.mock("@aws-sdk/client-lambda");
jest.mock("@aws-sdk/client-cognito-identity-provider");
jest.mock("@aws-sdk/client-ecs");

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.AWS_REGION = "us-east-1";
process.env.WORKFLOWS_TABLE = "test-workflows";
process.env.WORKFLOW_VERSIONS_TABLE = "test-workflow-versions";
process.env.FORMS_TABLE = "test-forms";
process.env.TEMPLATES_TABLE = "test-templates";
process.env.JOBS_TABLE = "test-jobs";
process.env.SUBMISSIONS_TABLE = "test-submissions";
process.env.NOTIFICATIONS_TABLE = "test-notifications";
process.env.USER_SETTINGS_TABLE = "test-user-settings";
process.env.USAGE_RECORDS_TABLE = "test-usage-records";
process.env.SESSIONS_TABLE = "test-sessions";
process.env.USERS_TABLE = "test-users";
process.env.ARTIFACTS_BUCKET = "test-artifacts-bucket";
process.env.OPENAI_SECRET_NAME = "test/openai-api-key";
process.env.LOG_LEVEL = "error"; // Reduce noise in tests
process.env.SHELL_TOOL_ENABLED = "true";
process.env.SHELL_TOOL_IP_LIMIT_PER_HOUR = "1000";
process.env.SHELL_TOOL_MAX_IN_FLIGHT = "100";
process.env.SHELL_TOOL_QUEUE_WAIT_MS = "0";

// Suppress console.log in tests unless explicitly needed
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
