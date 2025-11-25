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
export declare const SECRET_NAMES: {
    readonly OPENAI_API_KEY: "leadmagnet/openai-api-key";
    readonly TWILIO_CREDENTIALS: "leadmagnet/twilio-credentials";
};
/**
 * DynamoDB table names
 */
export declare const TABLE_NAMES: {
    readonly WORKFLOWS: "leadmagnet-workflows";
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
    readonly IMPERSONATION_LOGS: "leadmagnet-impersonation-logs";
    readonly SESSIONS: "leadmagnet-sessions";
    readonly WEBHOOK_LOGS: "leadmagnet-webhook-logs";
};
/**
 * Lambda function names
 */
export declare const FUNCTION_NAMES: {
    readonly API_HANDLER: "leadmagnet-api-handler";
    readonly JOB_PROCESSOR: "leadmagnet-job-processor";
};
/**
 * Stack names (used in CloudFormation)
 */
export declare const STACK_NAMES: {
    readonly DATABASE: "leadmagnet-database";
    readonly AUTH: "leadmagnet-auth";
    readonly STORAGE: "leadmagnet-storage";
    readonly WORKER: "leadmagnet-worker";
    readonly COMPUTE: "leadmagnet-compute";
    readonly API: "leadmagnet-api";
};
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
export declare const TABLE_ENV_VAR_MAP: Record<string, string>;
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
    readonly STEP_FUNCTIONS_ARN: "STEP_FUNCTIONS_ARN";
    readonly LAMBDA_FUNCTION_NAME: "LAMBDA_FUNCTION_NAME";
    readonly OPENAI_SECRET_NAME: "OPENAI_SECRET_NAME";
    readonly TWILIO_SECRET_NAME: "TWILIO_SECRET_NAME";
    readonly PLAYWRIGHT_BROWSERS_PATH: "PLAYWRIGHT_BROWSERS_PATH";
};
/**
 * Default log level
 */
export declare const DEFAULT_LOG_LEVEL = "info";
/**
 * Playwright browsers path (for containerized Lambda)
 */
export declare const PLAYWRIGHT_BROWSERS_PATH = "/ms-playwright";
