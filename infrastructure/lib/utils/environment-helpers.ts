import { TableMap, TableKey } from '../types';
import { TABLE_ENV_VAR_MAP } from '../config/constants';

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
export function createTableEnvironmentVars(tablesMap: TableMap): Record<string, string> {
  const env: Record<string, string> = {};

  // Validate that all required tables are present
  const requiredKeys = Object.values(TableKey);
  const missingKeys = requiredKeys.filter(key => !tablesMap[key]);
  
  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required tables in tablesMap: ${missingKeys.join(', ')}`
    );
  }

  // Use centralized mapping from constants
  Object.entries(tablesMap).forEach(([key, table]) => {
    const typedKey = key as TableKey;
    const envVarName = TABLE_ENV_VAR_MAP[typedKey];
    if (envVarName) {
      env[envVarName] = table.tableName;
    } else {
      console.warn(`No environment variable mapping found for table key: ${key}`);
    }
  });

  return env;
}

/**
 * Generates a Secrets Manager ARN for a secret name
 * 
 * @param scope - CDK construct scope (for account/region access)
 * @param secretName - Name of the secret
 * @returns ARN string for the secret
 */
export function getSecretArn(scope: { account: string; region: string }, secretName: string): string {
  return `arn:aws:secretsmanager:${scope.region}:${scope.account}:secret:${secretName}*`;
}

