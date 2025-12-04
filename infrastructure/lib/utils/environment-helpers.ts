import { TableMap } from '../types';

/**
 * Creates environment variables from a tables map
 */
export function createTableEnvironmentVars(tablesMap: TableMap): Record<string, string> {
  const env: Record<string, string> = {};

  // Map table keys to environment variable names
  const tableEnvMap: Record<string, string> = {
    workflows: 'WORKFLOWS_TABLE',
    forms: 'FORMS_TABLE',
    submissions: 'SUBMISSIONS_TABLE',
    jobs: 'JOBS_TABLE',
    artifacts: 'ARTIFACTS_TABLE',
    templates: 'TEMPLATES_TABLE',
    userSettings: 'USER_SETTINGS_TABLE',
    usageRecords: 'USAGE_RECORDS_TABLE',
    notifications: 'NOTIFICATIONS_TABLE',
  };

  Object.entries(tablesMap).forEach(([key, table]) => {
    const envVarName = tableEnvMap[key];
    if (envVarName) {
      env[envVarName] = table.tableName;
    }
  });

  return env;
}

