import { logger } from './logger';

/**
 * Centralized environment configuration service.
 * Provides typed access to all environment variables with validation and defaults.
 * Replaces 32+ individual environment variable checks throughout the codebase.
 */
export class EnvConfig {
  // DynamoDB Tables
  readonly workflowsTable: string;
  readonly formsTable: string;
  readonly templatesTable: string;
  readonly jobsTable: string;
  readonly submissionsTable: string;
  readonly artifactsTable: string | undefined;
  readonly notificationsTable: string;
  readonly userSettingsTable: string;
  readonly usageRecordsTable: string;

  // AWS Configuration
  readonly awsRegion: string;
  readonly awsAccountId: string;
  readonly lambdaFunctionName: string;
  readonly stepFunctionsArn: string | undefined;

  // S3 Configuration
  readonly artifactsBucket: string | undefined;

  // Application Configuration
  readonly isLocal: boolean;
  readonly nodeEnv: string;
  readonly logLevel: string;

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

    // AWS Configuration
    this.awsRegion = this.getWithDefault('AWS_REGION', 'us-east-1');
    this.awsAccountId = this.getOptional('AWS_ACCOUNT_ID') || '471112574622';
    this.lambdaFunctionName = this.getWithDefault('LAMBDA_FUNCTION_NAME', 'leadmagnet-api-handler');
    this.stepFunctionsArn = this.getOptional('STEP_FUNCTIONS_ARN');

    // S3 Configuration
    this.artifactsBucket = this.getOptional('ARTIFACTS_BUCKET');

    // Application Configuration
    this.isLocal = process.env.IS_LOCAL === 'true';
    this.nodeEnv = process.env.NODE_ENV || 'production';
    this.logLevel = process.env.LOG_LEVEL || 'info';

    // Validate critical configuration
    this.validate();
  }

  /**
   * Get a required environment variable, throwing an error if not set.
   */
  private getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      const error = new Error(`Required environment variable ${key} is not set`);
      logger.error(`[EnvConfig] ${error.message}`);
      throw error;
    }
    return value;
  }

  /**
   * Get an optional environment variable, returning undefined if not set.
   */
  private getOptional(key: string): string | undefined {
    return process.env[key];
  }

  /**
   * Get an environment variable with a default value if not set.
   */
  private getWithDefault(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  /**
   * Validate critical configuration that might cause runtime errors.
   */
  private validate(): void {
    const warnings: string[] = [];

    // Warn about missing optional but commonly used variables
    if (!this.artifactsBucket) {
      warnings.push('ARTIFACTS_BUCKET is not set - artifact URL generation may fail');
    }

    if (!this.stepFunctionsArn) {
      warnings.push('STEP_FUNCTIONS_ARN is not set - Step Functions execution will be disabled');
    }

    // Log warnings but don't fail
    if (warnings.length > 0) {
      logger.warn('[EnvConfig] Configuration warnings:', { warnings });
    }
  }

  /**
   * Check if running in local/development mode.
   */
  isDevelopment(): boolean {
    return this.isLocal || this.nodeEnv === 'development';
  }

  /**
   * Get the full Lambda function ARN.
   */
  getLambdaFunctionArn(): string {
    return `arn:aws:lambda:${this.awsRegion}:${this.awsAccountId}:function:${this.lambdaFunctionName}`;
  }
}

// Export singleton instance
export const env = new EnvConfig();

// Export individual getters for backward compatibility during migration
export const getWorkflowsTable = () => env.workflowsTable;
export const getFormsTable = () => env.formsTable;
export const getTemplatesTable = () => env.templatesTable;
export const getJobsTable = () => env.jobsTable;
export const getSubmissionsTable = () => env.submissionsTable;
export const getArtifactsTable = () => env.artifactsTable;
export const getNotificationsTable = () => env.notificationsTable;
export const getUserSettingsTable = () => env.userSettingsTable;
export const getUsageRecordsTable = () => env.usageRecordsTable;
export const getAwsRegion = () => env.awsRegion;
export const getLambdaFunctionName = () => env.lambdaFunctionName;
export const getStepFunctionsArn = () => env.stepFunctionsArn;
export const getArtifactsBucket = () => env.artifactsBucket;
export const isLocal = () => env.isDevelopment();

