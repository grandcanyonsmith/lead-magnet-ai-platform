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
  readonly sessionsTable: string;
  readonly usersTable: string;
  readonly customersTable: string;
  readonly filesTable: string;
  readonly impersonationLogsTable: string;
  readonly webhookLogsTable: string;
  readonly trackingEventsTable: string;

  // AWS Configuration
  readonly awsRegion: string;
  readonly awsAccountId: string;
  readonly lambdaFunctionName: string;
  readonly stepFunctionsArn: string | undefined;

  // S3 Configuration
  readonly artifactsBucket: string | undefined;
  readonly cloudfrontDomain: string;

  // Application Configuration
  readonly isLocal: boolean;
  readonly nodeEnv: string;
  readonly logLevel: string;
  readonly apiUrl: string;
  readonly apiGatewayUrl: string;

  // Secrets Configuration
  readonly openaiSecretName: string;
  readonly stripeSecretName: string;

  // Security Configuration
  readonly superAdminEmails: string[];

  // Worker Configuration
  readonly workerScriptPath: string;

  // Stripe Configuration
  readonly stripePriceId: string | undefined;
  readonly stripeMeteredPriceId: string | undefined;
  readonly stripeMeteredPriceMap: Record<string, string>;
  readonly stripeWebhookSecret: string | undefined;
  readonly stripePortalReturnUrl: string | undefined;

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
    this.webhookLogsTable = this.getWithDefault('WEBHOOK_LOGS_TABLE', 'leadmagnet-webhook-logs');
    this.trackingEventsTable = this.getWithDefault('TRACKING_EVENTS_TABLE', 'leadmagnet-tracking-events');

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
    this.stripeSecretName = this.getWithDefault('STRIPE_SECRET_NAME', 'leadmagnet/stripe-api-key');

    // Security Configuration
    const superAdminEmailsStr = this.getOptional('SUPER_ADMIN_EMAILS') || '';
    this.superAdminEmails = superAdminEmailsStr
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    // Worker Configuration
    this.workerScriptPath = this.getWithDefault('WORKER_SCRIPT_PATH', './backend/worker/worker.py');

    // Stripe Configuration
    this.stripePriceId = this.getOptional('STRIPE_PRICE_ID');
    this.stripeMeteredPriceId = this.getOptional('STRIPE_METERED_PRICE_ID');
    const meteredPriceMapRaw = this.getOptional('STRIPE_METERED_PRICE_MAP');
    this.stripeMeteredPriceMap = {};
    if (meteredPriceMapRaw) {
      try {
        const parsed = JSON.parse(meteredPriceMapRaw);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([key, value]) => {
            if (typeof value === 'string' && value.trim().length > 0) {
              this.stripeMeteredPriceMap[key] = value;
            }
          });
        } else {
          logger.warn('[EnvConfig] STRIPE_METERED_PRICE_MAP is not an object, ignoring');
        }
      } catch (error: any) {
        logger.warn('[EnvConfig] Failed to parse STRIPE_METERED_PRICE_MAP as JSON', {
          error: error.message,
        });
      }
    }
    this.stripeWebhookSecret = this.getOptional('STRIPE_WEBHOOK_SECRET');
    this.stripePortalReturnUrl = this.getOptional('STRIPE_PORTAL_RETURN_URL');

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

export const isLocal = () => env.isDevelopment();

