/**
 * Status constants
 */

export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS]

export const WORKFLOW_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const

export type WorkflowStatus = typeof WORKFLOW_STATUS[keyof typeof WORKFLOW_STATUS]

export const FORM_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const

export type FormStatus = typeof FORM_STATUS[keyof typeof FORM_STATUS]

export const STATUS_LABELS: Record<string, string> = {
  [JOB_STATUS.PENDING]: 'Queued',
  [JOB_STATUS.PROCESSING]: 'Generating',
  [JOB_STATUS.COMPLETED]: 'Ready',
  [JOB_STATUS.FAILED]: 'Error',
  [`workflow_${WORKFLOW_STATUS.ACTIVE}`]: 'Active',
  [`workflow_${WORKFLOW_STATUS.INACTIVE}`]: 'Inactive',
  [`form_${FORM_STATUS.ACTIVE}`]: 'Active',
  [`form_${FORM_STATUS.INACTIVE}`]: 'Inactive',
}

export const STATUS_COLORS: Record<string, string> = {
  [JOB_STATUS.PENDING]: 'yellow',
  [JOB_STATUS.PROCESSING]: 'blue',
  [JOB_STATUS.COMPLETED]: 'green',
  [JOB_STATUS.FAILED]: 'red',
  [`workflow_${WORKFLOW_STATUS.ACTIVE}`]: 'green',
  [`workflow_${WORKFLOW_STATUS.INACTIVE}`]: 'gray',
  [`form_${FORM_STATUS.ACTIVE}`]: 'green',
  [`form_${FORM_STATUS.INACTIVE}`]: 'gray',
}

