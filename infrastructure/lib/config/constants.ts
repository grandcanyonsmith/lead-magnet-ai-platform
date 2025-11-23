/**
 * Centralized configuration constants for the Lead Magnet infrastructure
 * 
 * This file serves as the single source of truth for all hardcoded values
 * used across the infrastructure stacks. Use these constants instead of
 * magic strings scattered throughout the codebase.
 */

/**
 * Secret names stored in AWS Secrets Manager
 */
export const SECRET_NAMES = {
  OPENAI_API_KEY: 'leadmagnet/openai-api-key',
  TWILIO_CREDENTIALS: 'leadmagnet/twilio-credentials',
} as const;

/**
 * DynamoDB table names
 */
export function getTableNames() {
  const prefix = getEnvironmentPrefix();
  return {
    WORKFLOWS: `${prefix}leadmagnet-workflows`,
    FORMS: `${prefix}leadmagnet-forms`,
    SUBMISSIONS: `${prefix}leadmagnet-submissions`,
    JOBS: `${prefix}leadmagnet-jobs`,
    ARTIFACTS: `${prefix}leadmagnet-artifacts`,
    TEMPLATES: `${prefix}leadmagnet-templates`,
    USER_SETTINGS: `${prefix}leadmagnet-user-settings`,
    USAGE_RECORDS: `${prefix}leadmagnet-usage-records`,
    NOTIFICATIONS: `${prefix}leadmagnet-notifications`,
    USERS: `${prefix}leadmagnet-users`,
    CUSTOMERS: `${prefix}leadmagnet-customers`,
    FILES: `${prefix}leadmagnet-files`,
    IMPERSONATION_LOGS: `${prefix}leadmagnet-impersonation-logs`,
    SESSIONS: `${prefix}leadmagnet-sessions`,
    FOLDERS: `${prefix}leadmagnet-folders`,
  };
}

// Legacy export for backwards compatibility (production)
export const TABLE_NAMES = {
  WORKFLOWS: 'leadmagnet-workflows',
  FORMS: 'leadmagnet-forms',
  SUBMISSIONS: 'leadmagnet-submissions',
  JOBS: 'leadmagnet-jobs',
  ARTIFACTS: 'leadmagnet-artifacts',
  TEMPLATES: 'leadmagnet-templates',
  USER_SETTINGS: 'leadmagnet-user-settings',
  USAGE_RECORDS: 'leadmagnet-usage-records',
  NOTIFICATIONS: 'leadmagnet-notifications',
  USERS: 'leadmagnet-users',
  CUSTOMERS: 'leadmagnet-customers',
  FILES: 'leadmagnet-files',
  IMPERSONATION_LOGS: 'leadmagnet-impersonation-logs',
  SESSIONS: 'leadmagnet-sessions',
  FOLDERS: 'leadmagnet-folders',
} as const;

/**
 * Lambda function names
 */
export function getFunctionNames() {
  const prefix = getEnvironmentPrefix();
  return {
    API_HANDLER: `${prefix}leadmagnet-api-handler`,
    JOB_PROCESSOR: `${prefix}leadmagnet-job-processor`,
  };
}

// Legacy export for backwards compatibility (production)
export const FUNCTION_NAMES = {
  API_HANDLER: 'leadmagnet-api-handler',
  JOB_PROCESSOR: 'leadmagnet-job-processor',
} as const;

/**
 * Environment prefix (set via CDK context or environment variable)
 * Defaults to empty string for production, 'staging-' for staging
 */
export function getEnvironmentPrefix(): string {
  // Check CDK context first, then environment variable
  const env = process.env.CDK_ENVIRONMENT || process.env.ENVIRONMENT || '';
  return env === 'staging' ? 'staging-' : '';
}

/**
 * Get environment-specific export name prefix
 * Used for CloudFormation exports to avoid conflicts between environments
 */
export function getExportNamePrefix(): string {
  const env = process.env.CDK_ENVIRONMENT || process.env.ENVIRONMENT || '';
  return env === 'staging' ? 'Staging' : '';
}

/**
 * Stack names (used in CloudFormation)
 */
export function getStackNames() {
  const prefix = getEnvironmentPrefix();
  return {
    DATABASE: `${prefix}leadmagnet-database`,
    AUTH: `${prefix}leadmagnet-auth`,
    STORAGE: `${prefix}leadmagnet-storage`,
    WORKER: `${prefix}leadmagnet-worker`,
    COMPUTE: `${prefix}leadmagnet-compute`,
    API: `${prefix}leadmagnet-api`,
  };
}

// Legacy export for backwards compatibility (production)
export const STACK_NAMES = {
  DATABASE: 'leadmagnet-database',
  AUTH: 'leadmagnet-auth',
  STORAGE: 'leadmagnet-storage',
  WORKER: 'leadmagnet-worker',
  COMPUTE: 'leadmagnet-compute',
  API: 'leadmagnet-api',
} as const;

/**
 * Resource prefixes and naming patterns
 */
export function getResourcePrefixes() {
  const prefix = getEnvironmentPrefix();
  return {
    BUCKET: `${prefix}leadmagnet-artifacts`,
    USER_POOL: `${prefix}leadmagnet-users`,
    USER_POOL_CLIENT: 'web-app',
    STATE_MACHINE: `${prefix}leadmagnet-job-processor`,
    API_NAME: `${prefix}leadmagnet-api`,
    ECR_REPOSITORY: `leadmagnet/${prefix ? 'staging-' : ''}worker`,
    COGNITO_DOMAIN: `${prefix}leadmagnet`,
  };
}

// Legacy export for backwards compatibility (production)
export const RESOURCE_PREFIXES = {
  BUCKET: 'leadmagnet-artifacts',
  USER_POOL: 'leadmagnet-users',
  USER_POOL_CLIENT: 'web-app',
  STATE_MACHINE: 'leadmagnet-job-processor',
  API_NAME: 'leadmagnet-api',
  ECR_REPOSITORY: 'leadmagnet/worker',
  COGNITO_DOMAIN: 'leadmagnet',
} as const;

/**
 * Default Lambda configuration values
 */
export const LAMBDA_DEFAULTS = {
  API: {
    MEMORY_SIZE: 2048,
    TIMEOUT_SECONDS: 900, // 15 minutes
    LOG_RETENTION_DAYS: 7,
  },
  JOB_PROCESSOR: {
    MEMORY_SIZE: 3008,
    TIMEOUT_MINUTES: 15,
    LOG_RETENTION_DAYS: 7,
  },
  AUTO_CONFIRM: {
    RUNTIME: 'NODEJS_20_X',
  },
} as const;

/**
 * Default Step Functions configuration
 */
export const STEP_FUNCTIONS_DEFAULTS = {
  LOG_RETENTION_DAYS: 7,
  LOG_LEVEL: 'ALL',
} as const;

/**
 * S3 bucket configuration
 */
export const S3_CONFIG = {
  IMAGE_EXTENSIONS: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
  PATH_DEPTHS: ['', '/*', '/*/*'], // root, level1, level2
  TRANSITION_TO_IA_DAYS: 30,
} as const;

/**
 * CloudFront configuration
 */
export const CLOUDFRONT_CONFIG = {
  PRICE_CLASS: 'PRICE_CLASS_100',
  ERROR_RESPONSE_TTL_MINUTES: 10,
  CORS_MAX_AGE_DAYS: 1,
} as const;

/**
 * Cognito configuration
 */
export const COGNITO_CONFIG = {
  PASSWORD_MIN_LENGTH: 8,
  ACCESS_TOKEN_VALIDITY_HOURS: 1,
  ID_TOKEN_VALIDITY_HOURS: 1,
  REFRESH_TOKEN_VALIDITY_DAYS: 30,
} as const;

/**
 * ECR repository configuration
 */
export const ECR_CONFIG = {
  MAX_IMAGE_COUNT: 10,
} as const;

/**
 * Environment variable names (mapping from table keys to env var names)
 */
export const TABLE_ENV_VAR_MAP: Record<string, string> = {
  workflows: 'WORKFLOWS_TABLE',
  forms: 'FORMS_TABLE',
  submissions: 'SUBMISSIONS_TABLE',
  jobs: 'JOBS_TABLE',
  artifacts: 'ARTIFACTS_TABLE',
  templates: 'TEMPLATES_TABLE',
  userSettings: 'USER_SETTINGS_TABLE',
  usageRecords: 'USAGE_RECORDS_TABLE',
  notifications: 'NOTIFICATIONS_TABLE',
  users: 'USERS_TABLE',
  customers: 'CUSTOMERS_TABLE',
  files: 'FILES_TABLE',
  impersonationLogs: 'IMPERSONATION_LOGS_TABLE',
  sessions: 'SESSIONS_TABLE',
  folders: 'FOLDERS_TABLE',
} as const;

/**
 * Default region (fallback if not set in environment)
 */
export const DEFAULT_REGION = 'us-east-1';

/**
 * Common environment variable names
 */
export const ENV_VAR_NAMES = {
  AWS_REGION: 'AWS_REGION',
  LOG_LEVEL: 'LOG_LEVEL',
  ARTIFACTS_BUCKET: 'ARTIFACTS_BUCKET',
  CLOUDFRONT_DOMAIN: 'CLOUDFRONT_DOMAIN',
  STEP_FUNCTIONS_ARN: 'STEP_FUNCTIONS_ARN',
  LAMBDA_FUNCTION_NAME: 'LAMBDA_FUNCTION_NAME',
  OPENAI_SECRET_NAME: 'OPENAI_SECRET_NAME',
  TWILIO_SECRET_NAME: 'TWILIO_SECRET_NAME',
  PLAYWRIGHT_BROWSERS_PATH: 'PLAYWRIGHT_BROWSERS_PATH',
} as const;

/**
 * Default log level
 */
export const DEFAULT_LOG_LEVEL = 'info';

/**
 * Playwright browsers path (for containerized Lambda)
 */
export const PLAYWRIGHT_BROWSERS_PATH = '/ms-playwright';

