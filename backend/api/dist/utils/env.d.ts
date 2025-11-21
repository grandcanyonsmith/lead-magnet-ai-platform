/**
 * Centralized environment configuration service.
 * Provides typed access to all environment variables with validation and defaults.
 * Replaces 32+ individual environment variable checks throughout the codebase.
 */
export declare class EnvConfig {
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
    readonly foldersTable: string;
    readonly awsRegion: string;
    readonly awsAccountId: string;
    readonly lambdaFunctionName: string;
    readonly stepFunctionsArn: string | undefined;
    readonly artifactsBucket: string | undefined;
    readonly cloudfrontDomain: string;
    readonly isLocal: boolean;
    readonly nodeEnv: string;
    readonly logLevel: string;
    readonly apiUrl: string;
    readonly apiGatewayUrl: string;
    readonly openaiSecretName: string;
    readonly superAdminEmails: string[];
    readonly workerScriptPath: string;
    constructor();
    /**
     * Get a required environment variable, throwing an error if not set.
     */
    private getRequired;
    /**
     * Get an optional environment variable, returning undefined if not set.
     */
    private getOptional;
    /**
     * Get an environment variable with a default value if not set.
     */
    private getWithDefault;
    /**
     * Validate critical configuration that might cause runtime errors.
     */
    private validate;
    /**
     * Check if running in local/development mode.
     */
    isDevelopment(): boolean;
    /**
     * Get the full Lambda function ARN.
     */
    getLambdaFunctionArn(): string;
}
export declare const env: EnvConfig;
export declare const getWorkflowsTable: () => string;
export declare const getFormsTable: () => string;
export declare const getTemplatesTable: () => string;
export declare const getJobsTable: () => string;
export declare const getSubmissionsTable: () => string;
export declare const getArtifactsTable: () => string | undefined;
export declare const getNotificationsTable: () => string;
export declare const getUserSettingsTable: () => string;
export declare const getUsageRecordsTable: () => string;
export declare const getSessionsTable: () => string;
export declare const getUsersTable: () => string;
export declare const getCustomersTable: () => string;
export declare const getFilesTable: () => string;
export declare const getImpersonationLogsTable: () => string;
export declare const getFoldersTable: () => string;
export declare const getAwsRegion: () => string;
export declare const getLambdaFunctionName: () => string;
export declare const getStepFunctionsArn: () => string | undefined;
export declare const getArtifactsBucket: () => string | undefined;
export declare const getCloudfrontDomain: () => string;
export declare const getOpenaiSecretName: () => string;
export declare const getApiUrl: () => string;
export declare const isLocal: () => boolean;
//# sourceMappingURL=env.d.ts.map