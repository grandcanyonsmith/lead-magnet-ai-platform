"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLocal = exports.getApiUrl = exports.getOpenaiSecretName = exports.getCloudfrontDomain = exports.getArtifactsBucket = exports.getStepFunctionsArn = exports.getLambdaFunctionName = exports.getAwsRegion = exports.getFoldersTable = exports.getImpersonationLogsTable = exports.getFilesTable = exports.getCustomersTable = exports.getUsersTable = exports.getSessionsTable = exports.getUsageRecordsTable = exports.getUserSettingsTable = exports.getNotificationsTable = exports.getArtifactsTable = exports.getSubmissionsTable = exports.getJobsTable = exports.getTemplatesTable = exports.getFormsTable = exports.getWorkflowsTable = exports.env = exports.EnvConfig = void 0;
const logger_1 = require("./logger");
/**
 * Centralized environment configuration service.
 * Provides typed access to all environment variables with validation and defaults.
 * Replaces 32+ individual environment variable checks throughout the codebase.
 */
class EnvConfig {
    constructor() {
        // DynamoDB Tables - required
        this.workflowsTable = this.getRequired('WORKFLOWS_TABLE');
        this.formsTable = this.getRequired('FORMS_TABLE');
        this.templatesTable = this.getRequired('TEMPLATES_TABLE');
        this.jobsTable = this.getWithDefault('JOBS_TABLE', 'leadmagnet-jobs');
        this.submissionsTable = this.getRequired('SUBMISSIONS_TABLE');
        this.artifactsTable = this.getOptional('ARTIFACTS_TABLE') || undefined;
        this.notificationsTable = this.getRequired('NOTIFICATIONS_TABLE');
        this.userSettingsTable = this.getRequired('USER_SETTINGS_TABLE');
        this.usageRecordsTable = this.getWithDefault('USAGE_RECORDS_TABLE', 'leadmagnet-usage-records');
        this.sessionsTable = this.getWithDefault('SESSIONS_TABLE', 'leadmagnet-sessions');
        this.usersTable = this.getWithDefault('USERS_TABLE', 'leadmagnet-users');
        this.customersTable = this.getWithDefault('CUSTOMERS_TABLE', 'leadmagnet-customers');
        this.filesTable = this.getWithDefault('FILES_TABLE', 'leadmagnet-files');
        this.impersonationLogsTable = this.getWithDefault('IMPERSONATION_LOGS_TABLE', 'leadmagnet-impersonation-logs');
        this.foldersTable = this.getWithDefault('FOLDERS_TABLE', 'leadmagnet-folders');
        // AWS Configuration
        this.awsRegion = this.getWithDefault('AWS_REGION', 'us-east-1');
        this.awsAccountId = this.getOptional('AWS_ACCOUNT_ID') || '471112574622';
        this.lambdaFunctionName = this.getWithDefault('LAMBDA_FUNCTION_NAME', 'leadmagnet-api-handler');
        this.stepFunctionsArn = this.getOptional('STEP_FUNCTIONS_ARN');
        // S3 Configuration
        this.artifactsBucket = this.getOptional('ARTIFACTS_BUCKET');
        this.cloudfrontDomain = (this.getOptional('CLOUDFRONT_DOMAIN') || '').trim();
        // Application Configuration
        this.isLocal = this.getWithDefault('IS_LOCAL', 'false') === 'true';
        this.nodeEnv = this.getWithDefault('NODE_ENV', 'production');
        this.logLevel = this.getWithDefault('LOG_LEVEL', 'info');
        this.apiUrl = this.getOptional('API_URL') || '';
        this.apiGatewayUrl = this.getOptional('API_GATEWAY_URL') || '';
        // Secrets Configuration
        this.openaiSecretName = this.getWithDefault('OPENAI_SECRET_NAME', 'leadmagnet/openai-api-key');
        // Security Configuration
        const superAdminEmailsStr = this.getOptional('SUPER_ADMIN_EMAILS') || '';
        this.superAdminEmails = superAdminEmailsStr
            .split(',')
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean);
        // Worker Configuration
        this.workerScriptPath = this.getWithDefault('WORKER_SCRIPT_PATH', './backend/worker/worker.py');
        // Validate critical configuration
        this.validate();
    }
    /**
     * Get a required environment variable, throwing an error if not set.
     */
    getRequired(key) {
        const value = process.env[key];
        if (!value) {
            const error = new Error(`Required environment variable ${key} is not set`);
            logger_1.logger.error(`[EnvConfig] ${error.message}`);
            throw error;
        }
        return value;
    }
    /**
     * Get an optional environment variable, returning undefined if not set.
     */
    getOptional(key) {
        return process.env[key];
    }
    /**
     * Get an environment variable with a default value if not set.
     */
    getWithDefault(key, defaultValue) {
        return process.env[key] || defaultValue;
    }
    /**
     * Validate critical configuration that might cause runtime errors.
     */
    validate() {
        const warnings = [];
        // Warn about missing optional but commonly used variables
        if (!this.artifactsBucket) {
            warnings.push('ARTIFACTS_BUCKET is not set - artifact URL generation may fail');
        }
        if (!this.stepFunctionsArn) {
            warnings.push('STEP_FUNCTIONS_ARN is not set - Step Functions execution will be disabled');
        }
        // Log warnings but don't fail
        if (warnings.length > 0) {
            logger_1.logger.warn('[EnvConfig] Configuration warnings:', { warnings });
        }
    }
    /**
     * Check if running in local/development mode.
     */
    isDevelopment() {
        return this.isLocal || this.nodeEnv === 'development';
    }
    /**
     * Get the full Lambda function ARN.
     */
    getLambdaFunctionArn() {
        return `arn:aws:lambda:${this.awsRegion}:${this.awsAccountId}:function:${this.lambdaFunctionName}`;
    }
}
exports.EnvConfig = EnvConfig;
// Export singleton instance
exports.env = new EnvConfig();
// Export individual getters for backward compatibility during migration
const getWorkflowsTable = () => exports.env.workflowsTable;
exports.getWorkflowsTable = getWorkflowsTable;
const getFormsTable = () => exports.env.formsTable;
exports.getFormsTable = getFormsTable;
const getTemplatesTable = () => exports.env.templatesTable;
exports.getTemplatesTable = getTemplatesTable;
const getJobsTable = () => exports.env.jobsTable;
exports.getJobsTable = getJobsTable;
const getSubmissionsTable = () => exports.env.submissionsTable;
exports.getSubmissionsTable = getSubmissionsTable;
const getArtifactsTable = () => exports.env.artifactsTable;
exports.getArtifactsTable = getArtifactsTable;
const getNotificationsTable = () => exports.env.notificationsTable;
exports.getNotificationsTable = getNotificationsTable;
const getUserSettingsTable = () => exports.env.userSettingsTable;
exports.getUserSettingsTable = getUserSettingsTable;
const getUsageRecordsTable = () => exports.env.usageRecordsTable;
exports.getUsageRecordsTable = getUsageRecordsTable;
const getSessionsTable = () => exports.env.sessionsTable;
exports.getSessionsTable = getSessionsTable;
const getUsersTable = () => exports.env.usersTable;
exports.getUsersTable = getUsersTable;
const getCustomersTable = () => exports.env.customersTable;
exports.getCustomersTable = getCustomersTable;
const getFilesTable = () => exports.env.filesTable;
exports.getFilesTable = getFilesTable;
const getImpersonationLogsTable = () => exports.env.impersonationLogsTable;
exports.getImpersonationLogsTable = getImpersonationLogsTable;
const getFoldersTable = () => exports.env.foldersTable;
exports.getFoldersTable = getFoldersTable;
const getAwsRegion = () => exports.env.awsRegion;
exports.getAwsRegion = getAwsRegion;
const getLambdaFunctionName = () => exports.env.lambdaFunctionName;
exports.getLambdaFunctionName = getLambdaFunctionName;
const getStepFunctionsArn = () => exports.env.stepFunctionsArn;
exports.getStepFunctionsArn = getStepFunctionsArn;
const getArtifactsBucket = () => exports.env.artifactsBucket;
exports.getArtifactsBucket = getArtifactsBucket;
const getCloudfrontDomain = () => exports.env.cloudfrontDomain;
exports.getCloudfrontDomain = getCloudfrontDomain;
const getOpenaiSecretName = () => exports.env.openaiSecretName;
exports.getOpenaiSecretName = getOpenaiSecretName;
const getApiUrl = () => exports.env.apiUrl || exports.env.apiGatewayUrl;
exports.getApiUrl = getApiUrl;
const isLocal = () => exports.env.isDevelopment();
exports.isLocal = isLocal;
//# sourceMappingURL=env.js.map