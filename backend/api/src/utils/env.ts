import { logger } from "./logger";

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
  readonly rateLimitsTable: string;
  readonly htmlPatchRequestsTable: string;

  // AWS Configuration
  readonly awsRegion: string;
  readonly awsAccountId: string;
  readonly lambdaFunctionName: string;
  readonly stepFunctionsArn: string | undefined;

  // S3 Configuration
  readonly artifactsBucket: string | undefined;
  readonly cloudfrontDomain: string;
  readonly cloudfrontDistributionId: string;

  // Application Configuration
  readonly isLocal: boolean;
  readonly nodeEnv: string;
  readonly logLevel: string;
  readonly apiUrl: string;
  readonly apiGatewayUrl: string;

  // Secrets Configuration
  readonly openaiSecretName: string;
  readonly stripeSecretName: string;
  readonly scrapyApiKey: string | undefined;

  // Security Configuration
  readonly superAdminEmails: string[];

  // Worker Configuration
  readonly workerScriptPath: string;
  readonly cuaLambdaFunctionName: string;
  readonly shellLambdaFunctionName: string;

  // Stripe Configuration
  readonly stripePriceId: string | undefined;
  readonly stripeMeteredPriceId: string | undefined;
  readonly stripeMeteredPriceMap: Record<string, string>;
  readonly stripeWebhookSecret: string | undefined;
  readonly stripePortalReturnUrl: string | undefined;

  // Error Reporting (optional)
  readonly errorWebhookUrl: string | undefined;
  readonly errorWebhookHeaders: Record<string, string>;
  readonly errorWebhookTimeoutMs: number;

  // Shell tool (ECS executor) configuration
  readonly shellToolEnabled: boolean;
  readonly shellToolIpLimitPerHour: number;
  readonly shellToolMaxInFlight: number;
  readonly shellToolQueueWaitMs: number;

  readonly shellExecutorResultsBucket: string | undefined;
  readonly shellExecutorClusterArn: string | undefined;
  readonly shellExecutorTaskDefinitionArn: string | undefined;
  readonly shellExecutorSubnetIds: string[];
  readonly shellExecutorSecurityGroupId: string | undefined;

  // Scrapy Bara API Configuration
  readonly scrapyBaraEnabled: boolean;
  readonly scrapyBaraApiUrl: string | undefined;

  constructor() {
    // DynamoDB Tables - required
    this.workflowsTable = this.getRequired("WORKFLOWS_TABLE");
    this.formsTable = this.getRequired("FORMS_TABLE");
    this.templatesTable = this.getRequired("TEMPLATES_TABLE");
    this.jobsTable = this.getWithDefault("JOBS_TABLE", "leadmagnet-jobs");
    this.submissionsTable = this.getRequired("SUBMISSIONS_TABLE");
    this.artifactsTable = this.getOptional("ARTIFACTS_TABLE") || undefined;
    this.notificationsTable = this.getRequired("NOTIFICATIONS_TABLE");
    this.userSettingsTable = this.getRequired("USER_SETTINGS_TABLE");
    this.usageRecordsTable = this.getWithDefault(
      "USAGE_RECORDS_TABLE",
      "leadmagnet-usage-records",
    );
    this.sessionsTable = this.getWithDefault(
      "SESSIONS_TABLE",
      "leadmagnet-sessions",
    );
    this.usersTable = this.getWithDefault("USERS_TABLE", "leadmagnet-users");
    this.customersTable = this.getWithDefault(
      "CUSTOMERS_TABLE",
      "leadmagnet-customers",
    );
    this.filesTable = this.getWithDefault("FILES_TABLE", "leadmagnet-files");
    this.impersonationLogsTable = this.getWithDefault(
      "IMPERSONATION_LOGS_TABLE",
      "leadmagnet-impersonation-logs",
    );
    this.webhookLogsTable = this.getWithDefault(
      "WEBHOOK_LOGS_TABLE",
      "leadmagnet-webhook-logs",
    );
    this.trackingEventsTable = this.getWithDefault(
      "TRACKING_EVENTS_TABLE",
      "leadmagnet-tracking-events",
    );
    this.rateLimitsTable = this.getWithDefault(
      "RATE_LIMITS_TABLE",
      "leadmagnet-rate-limits",
    );
    this.htmlPatchRequestsTable = this.getWithDefault(
      "HTML_PATCH_REQUESTS_TABLE",
      "leadmagnet-html-patch-requests",
    );

    // AWS Configuration
    this.awsRegion = this.getWithDefault("AWS_REGION", "us-east-1");
    this.awsAccountId = this.getOptional("AWS_ACCOUNT_ID") || "471112574622";
    this.lambdaFunctionName = this.getWithDefault(
      "LAMBDA_FUNCTION_NAME",
      "leadmagnet-api-handler",
    );
    this.stepFunctionsArn = this.getOptional("STEP_FUNCTIONS_ARN");

    // S3 Configuration
    this.artifactsBucket = this.getOptional("ARTIFACTS_BUCKET");
    this.cloudfrontDomain = (
      this.getOptional("CLOUDFRONT_DOMAIN") || ""
    ).trim();
    this.cloudfrontDistributionId = (
      this.getOptional("CLOUDFRONT_DISTRIBUTION_ID") || ""
    ).trim();

    // Application Configuration
    this.isLocal = this.getWithDefault("IS_LOCAL", "false") === "true";
    this.nodeEnv = this.getWithDefault("NODE_ENV", "production");
    this.logLevel = this.getWithDefault("LOG_LEVEL", "info");
    this.apiUrl = this.getOptional("API_URL") || "";
    this.apiGatewayUrl = this.getOptional("API_GATEWAY_URL") || "";

    // Secrets Configuration
    this.openaiSecretName = this.getWithDefault(
      "OPENAI_SECRET_NAME",
      "leadmagnet/openai-api-key",
    );
    this.stripeSecretName = this.getWithDefault(
      "STRIPE_SECRET_NAME",
      "leadmagnet/stripe-api-key",
    );
    this.scrapyApiKey = this.getOptional("SCRAPY_API_KEY");

    // Security Configuration
    const superAdminEmailsStr = this.getOptional("SUPER_ADMIN_EMAILS") || "";
    this.superAdminEmails = superAdminEmailsStr
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    // Worker Configuration
    this.workerScriptPath = this.getWithDefault(
      "WORKER_SCRIPT_PATH",
      "./backend/worker/worker.py",
    );

    // Admin streaming worker lambdas (can be overridden in deployed environment)
    this.cuaLambdaFunctionName = this.getWithDefault(
      "CUA_LAMBDA_FUNCTION_NAME",
      "leadmagnet-cua-worker",
    );
    this.shellLambdaFunctionName = this.getWithDefault(
      "SHELL_LAMBDA_FUNCTION_NAME",
      "leadmagnet-shell-worker",
    );

    // Stripe Configuration
    this.stripePriceId = this.getOptional("STRIPE_PRICE_ID");
    this.stripeMeteredPriceId = this.getOptional("STRIPE_METERED_PRICE_ID");
    const meteredPriceMapRaw = this.getOptional("STRIPE_METERED_PRICE_MAP");
    this.stripeMeteredPriceMap = {};
    if (meteredPriceMapRaw) {
      try {
        const parsed = JSON.parse(meteredPriceMapRaw);
        if (parsed && typeof parsed === "object") {
          Object.entries(parsed).forEach(([key, value]) => {
            if (typeof value === "string" && value.trim().length > 0) {
              this.stripeMeteredPriceMap[key] = value;
            }
          });
        } else {
          logger.warn(
            "[EnvConfig] STRIPE_METERED_PRICE_MAP is not an object, ignoring",
          );
        }
      } catch (error: any) {
        logger.warn(
          "[EnvConfig] Failed to parse STRIPE_METERED_PRICE_MAP as JSON",
          {
            error: error.message,
          },
        );
      }
    }
    this.stripeWebhookSecret = this.getOptional("STRIPE_WEBHOOK_SECRET");
    this.stripePortalReturnUrl = this.getOptional("STRIPE_PORTAL_RETURN_URL");

    // Error reporting webhook (optional)
    const errorWebhookUrlRaw = (
      this.getOptional("ERROR_WEBHOOK_URL") || ""
    ).trim();
    this.errorWebhookUrl =
      errorWebhookUrlRaw.length > 0 ? errorWebhookUrlRaw : undefined;

    const errorWebhookHeadersRaw = this.getOptional("ERROR_WEBHOOK_HEADERS");
    this.errorWebhookHeaders = {};
    if (errorWebhookHeadersRaw) {
      try {
        const parsed = JSON.parse(errorWebhookHeadersRaw);
        if (parsed && typeof parsed === "object") {
          Object.entries(parsed).forEach(([key, value]) => {
            if (typeof value === "string" && value.trim().length > 0) {
              this.errorWebhookHeaders[key] = value;
            }
          });
        } else {
          logger.warn(
            "[EnvConfig] ERROR_WEBHOOK_HEADERS is not an object, ignoring",
          );
        }
      } catch (error: any) {
        logger.warn(
          "[EnvConfig] Failed to parse ERROR_WEBHOOK_HEADERS as JSON",
          {
            error: error.message,
          },
        );
      }
    }

    const timeoutRaw = (
      this.getOptional("ERROR_WEBHOOK_TIMEOUT_MS") || ""
    ).trim();
    const parsedTimeout = timeoutRaw ? parseInt(timeoutRaw, 10) : NaN;
    this.errorWebhookTimeoutMs = Number.isFinite(parsedTimeout)
      ? Math.max(250, parsedTimeout)
      : 3000;

    // Shell tool config (defaults are conservative; enable explicitly)
    this.shellToolEnabled =
      (this.getOptional("SHELL_TOOL_ENABLED") || "").trim() === "true";
    const ipLimitRaw = (
      this.getOptional("SHELL_TOOL_IP_LIMIT_PER_HOUR") || ""
    ).trim();
    const parsedIpLimit = ipLimitRaw ? parseInt(ipLimitRaw, 10) : NaN;
    this.shellToolIpLimitPerHour = Number.isFinite(parsedIpLimit)
      ? Math.max(1, parsedIpLimit)
      : 10;

    const maxInFlightRaw = (
      this.getOptional("SHELL_TOOL_MAX_IN_FLIGHT") || ""
    ).trim();
    const parsedMaxInFlight = maxInFlightRaw
      ? parseInt(maxInFlightRaw, 10)
      : NaN;
    this.shellToolMaxInFlight = Number.isFinite(parsedMaxInFlight)
      ? Math.max(1, parsedMaxInFlight)
      : 5;

    const waitMsRaw = (
      this.getOptional("SHELL_TOOL_QUEUE_WAIT_MS") || ""
    ).trim();
    const parsedWaitMs = waitMsRaw ? parseInt(waitMsRaw, 10) : NaN;
    this.shellToolQueueWaitMs = Number.isFinite(parsedWaitMs)
      ? Math.max(0, parsedWaitMs)
      : 0;

    this.shellExecutorResultsBucket =
      (this.getOptional("SHELL_EXECUTOR_RESULTS_BUCKET") || "").trim() ||
      undefined;
    this.shellExecutorClusterArn =
      (this.getOptional("SHELL_EXECUTOR_CLUSTER_ARN") || "").trim() ||
      undefined;
    this.shellExecutorTaskDefinitionArn =
      (this.getOptional("SHELL_EXECUTOR_TASK_DEFINITION_ARN") || "").trim() ||
      undefined;
    this.shellExecutorSecurityGroupId =
      (this.getOptional("SHELL_EXECUTOR_SECURITY_GROUP_ID") || "").trim() ||
      undefined;
    const subnetIdsRaw = (
      this.getOptional("SHELL_EXECUTOR_SUBNET_IDS") || ""
    ).trim();
    this.shellExecutorSubnetIds = subnetIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Scrapy Bara API Configuration
    this.scrapyBaraEnabled =
      (this.getOptional("SCRAPY_BARA_ENABLED") || "").trim() === "true";
    this.scrapyBaraApiUrl = (
      this.getOptional("SCRAPY_BARA_API_URL") || ""
    ).trim() || undefined;

    // Validate critical configuration
    this.validate();
  }

  /**
   * Get a required environment variable, throwing an error if not set.
   */
  private getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      const error = new Error(
        `Required environment variable ${key} is not set`,
      );
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
      warnings.push(
        "ARTIFACTS_BUCKET is not set - artifact URL generation may fail",
      );
    }

    if (!this.stepFunctionsArn) {
      warnings.push(
        "STEP_FUNCTIONS_ARN is not set - Step Functions execution will be disabled",
      );
    }

    if (this.shellToolEnabled) {
      if (!this.shellExecutorResultsBucket)
        warnings.push(
          "SHELL_EXECUTOR_RESULTS_BUCKET is not set (shell tool enabled)",
        );
      if (!this.shellExecutorClusterArn)
        warnings.push(
          "SHELL_EXECUTOR_CLUSTER_ARN is not set (shell tool enabled)",
        );
      if (!this.shellExecutorTaskDefinitionArn)
        warnings.push(
          "SHELL_EXECUTOR_TASK_DEFINITION_ARN is not set (shell tool enabled)",
        );
      if (!this.shellExecutorSecurityGroupId)
        warnings.push(
          "SHELL_EXECUTOR_SECURITY_GROUP_ID is not set (shell tool enabled)",
        );
      if (
        !this.shellExecutorSubnetIds ||
        this.shellExecutorSubnetIds.length === 0
      ) {
        warnings.push(
          "SHELL_EXECUTOR_SUBNET_IDS is not set (shell tool enabled)",
        );
      }
    }

    // Log warnings but don't fail
    if (warnings.length > 0) {
      logger.warn("[EnvConfig] Configuration warnings:", { warnings });
    }
  }

  /**
   * Check if running in local/development mode.
   */
  isDevelopment(): boolean {
    return this.isLocal || this.nodeEnv === "development";
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
