import { TableMap } from '../types';
/**
 * Creates environment variables from a tables map
 *
 * Maps table keys to their corresponding environment variable names
 * using the centralized configuration.
 *
 * @param tablesMap - Map of table keys to DynamoDB table references
 * @returns Record of environment variable names to table names
 * @throws Error if required tables are missing
 */
export declare function createTableEnvironmentVars(tablesMap: TableMap): Record<string, string>;
/**
 * Generates a Secrets Manager ARN for a secret name
 *
 * @param scope - CDK construct scope (for account/region access)
 * @param secretName - Name of the secret
 * @returns ARN string for the secret
 */
export declare function getSecretArn(scope: {
    account: string;
    region: string;
}, secretName: string): string;
