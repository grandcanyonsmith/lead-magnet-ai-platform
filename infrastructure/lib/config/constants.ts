/**
 * Centralized configuration constants for the Lead Magnet infrastructure
 * 
 * This file serves as the single source of truth for all hardcoded values
 * used across the infrastructure stacks. Use these constants instead of
 * magic strings scattered throughout the codebase.
 */

import type { TableKey } from '../types';

/**
 * Secret names stored in AWS Secrets Manager
 */
export const SECRET_NAMES = {
  OPENAI_API_KEY: 'leadmagnet/openai-api-key',
  TWILIO_CREDENTIALS: 'leadmagnet/twilio-credentials',
  STRIPE_API_KEY: 'leadmagnet/stripe-api-key',
} as const;

/**
 * DynamoDB table names
 */
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
  FOLDERS: 'leadmagnet-folders',
  IMPERSONATION_LOGS: 'leadmagnet-impersonation-logs',
  SESSIONS: 'leadmagnet-sessions',
  WEBHOOK_LOGS: 'leadmagnet-webhook-logs',
  TRACKING_EVENTS: 'leadmagnet-tracking-events',
  RATE_LIMITS: 'leadmagnet-rate-limits',
} as const;

/**
 * Lambda function names
 */
export const FUNCTION_NAMES = {
  API_HANDLER: 'leadmagnet-api-handler',
  JOB_PROCESSOR: 'leadmagnet-job-processor',
} as const;

/**
 * Stack names (used in CloudFormation)
 */
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
export const TABLE_ENV_VAR_MAP: Record<TableKey, string> = {
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
  webhookLogs: 'WEBHOOK_LOGS_TABLE',
  trackingEvents: 'TRACKING_EVENTS_TABLE',
  rateLimits: 'RATE_LIMITS_TABLE',
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
  API_GATEWAY_URL: 'API_GATEWAY_URL',
  LAMBDA_FUNCTION_NAME: 'LAMBDA_FUNCTION_NAME',
  OPENAI_SECRET_NAME: 'OPENAI_SECRET_NAME',
  TWILIO_SECRET_NAME: 'TWILIO_SECRET_NAME',
  PLAYWRIGHT_BROWSERS_PATH: 'PLAYWRIGHT_BROWSERS_PATH',
  STRIPE_SECRET_NAME: 'STRIPE_SECRET_NAME',
  STRIPE_PRICE_ID: 'STRIPE_PRICE_ID',
  STRIPE_METERED_PRICE_ID: 'STRIPE_METERED_PRICE_ID',
  STRIPE_METERED_PRICE_MAP: 'STRIPE_METERED_PRICE_MAP',
  STRIPE_WEBHOOK_SECRET: 'STRIPE_WEBHOOK_SECRET',
  STRIPE_PORTAL_RETURN_URL: 'STRIPE_PORTAL_RETURN_URL',
  ERROR_WEBHOOK_URL: 'ERROR_WEBHOOK_URL',
  ERROR_WEBHOOK_HEADERS: 'ERROR_WEBHOOK_HEADERS',
  ERROR_WEBHOOK_TIMEOUT_MS: 'ERROR_WEBHOOK_TIMEOUT_MS',
} as const;

/**
 * Default log level
 */
export const DEFAULT_LOG_LEVEL = 'info';

/**
 * Playwright browsers path (for containerized Lambda)
 */
export const PLAYWRIGHT_BROWSERS_PATH = '/ms-playwright';

