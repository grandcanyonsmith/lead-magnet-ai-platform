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
export declare const SECRET_NAMES: {
    readonly OPENAI_API_KEY: "leadmagnet/openai-api-key";
    readonly TWILIO_CREDENTIALS: "leadmagnet/twilio-credentials";
    readonly STRIPE_API_KEY: "leadmagnet/stripe-api-key";
};
/**
 * DynamoDB table names
 */
export declare const TABLE_NAMES: {
    readonly WORKFLOWS: "leadmagnet-workflows";
    readonly WORKFLOW_VERSIONS: "leadmagnet-workflow-versions";
    readonly FORMS: "leadmagnet-forms";
    readonly SUBMISSIONS: "leadmagnet-submissions";
    readonly JOBS: "leadmagnet-jobs";
    readonly ARTIFACTS: "leadmagnet-artifacts";
    readonly TEMPLATES: "leadmagnet-templates";
    readonly USER_SETTINGS: "leadmagnet-user-settings";
    readonly USAGE_RECORDS: "leadmagnet-usage-records";
    readonly NOTIFICATIONS: "leadmagnet-notifications";
    readonly USERS: "leadmagnet-users";
    readonly CUSTOMERS: "leadmagnet-customers";
    readonly FILES: "leadmagnet-files";
    readonly FOLDERS: "leadmagnet-folders";
    readonly IMPERSONATION_LOGS: "leadmagnet-impersonation-logs";
    readonly SESSIONS: "leadmagnet-sessions";
    readonly WEBHOOK_LOGS: "leadmagnet-webhook-logs";
    readonly TRACKING_EVENTS: "leadmagnet-tracking-events";
    readonly RATE_LIMITS: "leadmagnet-rate-limits";
    readonly HTML_PATCH_REQUESTS: "leadmagnet-html-patch-requests";
};
/**
 * Lambda function names
 */
export declare const FUNCTION_NAMES: {
    readonly API_HANDLER: "leadmagnet-api-handler";
    readonly JOB_PROCESSOR: "leadmagnet-job-processor";
    readonly CUA_WORKER: "leadmagnet-cua-worker";
    readonly SHELL_WORKER: "leadmagnet-shell-worker";
};
/**
 * Stack names (used in CloudFormation)
 */
export declare const STACK_NAMES: {
    readonly DATABASE: "leadmagnet-database";
    readonly AUTH: "leadmagnet-auth";
    readonly STORAGE: "leadmagnet-storage";
    readonly WORKER: "leadmagnet-worker";
    readonly SHELL_EXECUTOR: "leadmagnet-shell-executor";
    readonly COMPUTE: "leadmagnet-compute";
    readonly API: "leadmagnet-api";
    readonly DASHBOARD: "leadmagnet-dashboard";
};
/**
 * ECS task definition family name for the shell executor.
 *
 * Important: This must remain stable across deployments.
 * Other stacks/Lambdas should reference the task definition by family (or family:* IAM wildcard)
 * rather than importing a specific TaskDefinition ARN revision via CloudFormation exports.
 */
export declare const SHELL_EXECUTOR_TASK_FAMILY: "leadmagnet-shell-executor";
/**
 * Resource prefixes and naming patterns
 */
export declare const RESOURCE_PREFIXES: {
    readonly BUCKET: "leadmagnet-artifacts";
    readonly USER_POOL: "leadmagnet-users";
    readonly USER_POOL_CLIENT: "web-app";
    readonly STATE_MACHINE: "leadmagnet-job-processor";
    readonly API_NAME: "leadmagnet-api";
    readonly ECR_REPOSITORY: "leadmagnet/worker";
    readonly COGNITO_DOMAIN: "leadmagnet";
};
/**
 * Default Lambda configuration values
 */
export declare const LAMBDA_DEFAULTS: {
    readonly API: {
        readonly MEMORY_SIZE: 2048;
        readonly TIMEOUT_SECONDS: 900;
        readonly LOG_RETENTION_DAYS: 7;
    };
    readonly JOB_PROCESSOR: {
        readonly MEMORY_SIZE: 3008;
        readonly TIMEOUT_MINUTES: 15;
        readonly LOG_RETENTION_DAYS: 7;
    };
    readonly AUTO_CONFIRM: {
        readonly RUNTIME: "NODEJS_20_X";
    };
};
/**
 * Default Step Functions configuration
 */
export declare const STEP_FUNCTIONS_DEFAULTS: {
    readonly LOG_RETENTION_DAYS: 7;
    readonly LOG_LEVEL: "ALL";
};
/**
 * S3 bucket configuration
 */
export declare const S3_CONFIG: {
    readonly IMAGE_EXTENSIONS: readonly ["png", "jpg", "jpeg", "gif", "webp", "svg"];
    readonly PATH_DEPTHS: readonly ["", "/*", "/*/*"];
    readonly TRANSITION_TO_IA_DAYS: 30;
};
/**
 * CloudFront configuration
 */
export declare const CLOUDFRONT_CONFIG: {
    readonly PRICE_CLASS: "PRICE_CLASS_100";
    readonly ERROR_RESPONSE_TTL_MINUTES: 10;
    readonly CORS_MAX_AGE_DAYS: 1;
};
/**
 * Cognito configuration
 */
export declare const COGNITO_CONFIG: {
    readonly PASSWORD_MIN_LENGTH: 8;
    readonly ACCESS_TOKEN_VALIDITY_HOURS: 1;
    readonly ID_TOKEN_VALIDITY_HOURS: 1;
    readonly REFRESH_TOKEN_VALIDITY_DAYS: 30;
};
/**
 * ECR repository configuration
 */
export declare const ECR_CONFIG: {
    readonly MAX_IMAGE_COUNT: 10;
};
/**
 * Environment variable names (mapping from table keys to env var names)
 */
export declare const TABLE_ENV_VAR_MAP: Record<TableKey, string>;
/**
 * Default region (fallback if not set in environment)
 */
export declare const DEFAULT_REGION = "us-east-1";
/**
 * Common environment variable names
 */
export declare const ENV_VAR_NAMES: {
    readonly AWS_REGION: "AWS_REGION";
    readonly LOG_LEVEL: "LOG_LEVEL";
    readonly ARTIFACTS_BUCKET: "ARTIFACTS_BUCKET";
    readonly CLOUDFRONT_DOMAIN: "CLOUDFRONT_DOMAIN";
    readonly CLOUDFRONT_DISTRIBUTION_ID: "CLOUDFRONT_DISTRIBUTION_ID";
    readonly STEP_FUNCTIONS_ARN: "STEP_FUNCTIONS_ARN";
    readonly API_GATEWAY_URL: "API_GATEWAY_URL";
    readonly LAMBDA_FUNCTION_NAME: "LAMBDA_FUNCTION_NAME";
    readonly CUA_LAMBDA_FUNCTION_NAME: "CUA_LAMBDA_FUNCTION_NAME";
    readonly SHELL_LAMBDA_FUNCTION_NAME: "SHELL_LAMBDA_FUNCTION_NAME";
    readonly OPENAI_SECRET_NAME: "OPENAI_SECRET_NAME";
    readonly TWILIO_SECRET_NAME: "TWILIO_SECRET_NAME";
    readonly PLAYWRIGHT_BROWSERS_PATH: "PLAYWRIGHT_BROWSERS_PATH";
    readonly STRIPE_SECRET_NAME: "STRIPE_SECRET_NAME";
    readonly STRIPE_PRICE_ID: "STRIPE_PRICE_ID";
    readonly STRIPE_METERED_PRICE_ID: "STRIPE_METERED_PRICE_ID";
    readonly STRIPE_METERED_PRICE_MAP: "STRIPE_METERED_PRICE_MAP";
    readonly STRIPE_WEBHOOK_SECRET: "STRIPE_WEBHOOK_SECRET";
    readonly STRIPE_PORTAL_RETURN_URL: "STRIPE_PORTAL_RETURN_URL";
    readonly ERROR_WEBHOOK_URL: "ERROR_WEBHOOK_URL";
    readonly ERROR_WEBHOOK_HEADERS: "ERROR_WEBHOOK_HEADERS";
    readonly ERROR_WEBHOOK_TIMEOUT_MS: "ERROR_WEBHOOK_TIMEOUT_MS";
    readonly SHELL_TOOL_ENABLED: "SHELL_TOOL_ENABLED";
    readonly SHELL_TOOL_IP_LIMIT_PER_HOUR: "SHELL_TOOL_IP_LIMIT_PER_HOUR";
    readonly SHELL_TOOL_MAX_IN_FLIGHT: "SHELL_TOOL_MAX_IN_FLIGHT";
    readonly SHELL_TOOL_QUEUE_WAIT_MS: "SHELL_TOOL_QUEUE_WAIT_MS";
    readonly SHELL_EXECUTOR_FUNCTION_NAME: "SHELL_EXECUTOR_FUNCTION_NAME";
    readonly SHELL_EXECUTOR_RESULTS_BUCKET: "SHELL_EXECUTOR_RESULTS_BUCKET";
    readonly SHELL_EXECUTOR_CLUSTER_ARN: "SHELL_EXECUTOR_CLUSTER_ARN";
    readonly SHELL_EXECUTOR_TASK_DEFINITION_ARN: "SHELL_EXECUTOR_TASK_DEFINITION_ARN";
    readonly SHELL_EXECUTOR_SUBNET_IDS: "SHELL_EXECUTOR_SUBNET_IDS";
    readonly SHELL_EXECUTOR_SECURITY_GROUP_ID: "SHELL_EXECUTOR_SECURITY_GROUP_ID";
    readonly SHELL_EXECUTOR_UPLOAD_MODE: "SHELL_EXECUTOR_UPLOAD_MODE";
    readonly SHELL_EXECUTOR_UPLOAD_BUCKET: "SHELL_EXECUTOR_UPLOAD_BUCKET";
    readonly SHELL_EXECUTOR_MANIFEST_NAME: "SHELL_EXECUTOR_MANIFEST_NAME";
    readonly SHELL_EXECUTOR_MANIFEST_PATH: "SHELL_EXECUTOR_MANIFEST_PATH";
    readonly SHELL_EXECUTOR_UPLOAD_PREFIX: "SHELL_EXECUTOR_UPLOAD_PREFIX";
    readonly SHELL_EXECUTOR_UPLOAD_PREFIX_TEMPLATE: "SHELL_EXECUTOR_UPLOAD_PREFIX_TEMPLATE";
    readonly SHELL_EXECUTOR_UPLOAD_DIST_SUBDIR: "SHELL_EXECUTOR_UPLOAD_DIST_SUBDIR";
    readonly SHELL_EXECUTOR_UPLOAD_ACL: "SHELL_EXECUTOR_UPLOAD_ACL";
    readonly SHELL_EXECUTOR_FORCE_SHELL_FOR_FILES: "SHELL_EXECUTOR_FORCE_SHELL_FOR_FILES";
    readonly SHELL_EXECUTOR_REWRITE_WORK_PATHS: "SHELL_EXECUTOR_REWRITE_WORK_PATHS";
    readonly SHELL_EXECUTOR_WORK_ROOT: "SHELL_EXECUTOR_WORK_ROOT";
    readonly SCRAPY_API_KEY: "SCRAPY_API_KEY";
    readonly SCRAPY_BARA_ENABLED: "SCRAPY_BARA_ENABLED";
    readonly SCRAPY_BARA_API_URL: "SCRAPY_BARA_API_URL";
};
/**
 * Default log level
 */
export declare const DEFAULT_LOG_LEVEL = "info";
/**
 * Playwright browsers path (for containerized Lambda)
 */
export declare const PLAYWRIGHT_BROWSERS_PATH = "/ms-playwright";
