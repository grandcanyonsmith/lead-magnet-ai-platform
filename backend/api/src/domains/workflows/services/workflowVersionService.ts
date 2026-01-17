import { db } from "@utils/db";
import { env } from "@utils/env";
import { ApiError } from "@utils/errors";
import { logger } from "@utils/logger";
import type { WorkflowStep } from "./workflow/workflowConfigSupport";

const WORKFLOW_VERSIONS_TABLE = env.workflowVersionsTable;

export interface WorkflowTrigger {
  type: "form" | "webhook";
}

export interface WorkflowVersionSnapshot {
  workflow_name: string;
  workflow_description?: string;
  steps: WorkflowStep[];
  template_id?: string;
  template_version?: number;
  trigger?: WorkflowTrigger;
  status?: "draft" | "active" | "inactive";
  folder_id?: string | null;
}

export interface WorkflowVersionRecord {
  workflow_id: string;
  tenant_id: string;
  version: number;
  snapshot: WorkflowVersionSnapshot;
  created_at: string;
}

export interface WorkflowVersionSummary {
  workflow_id: string;
  version: number;
  created_at: string;
  workflow_name: string;
  workflow_description?: string;
  step_count: number;
  template_id?: string;
  template_version?: number;
}

export const resolveWorkflowVersion = (workflow: any): number => {
  const rawVersion = workflow?.version;
  if (typeof rawVersion === "number" && Number.isFinite(rawVersion) && rawVersion > 0) {
    return rawVersion;
  }
  return 1;
};

export const buildWorkflowVersionSnapshot = (
  workflow: any,
): WorkflowVersionSnapshot => {
  return {
    workflow_name: String(workflow.workflow_name || "Untitled Workflow"),
    workflow_description: workflow.workflow_description ?? "",
    steps: Array.isArray(workflow.steps) ? workflow.steps : [],
    template_id: workflow.template_id || undefined,
    template_version:
      typeof workflow.template_version === "number"
        ? workflow.template_version
        : 0,
    trigger: workflow.trigger,
    status: workflow.status,
    folder_id:
      workflow.folder_id === null || typeof workflow.folder_id === "string"
        ? workflow.folder_id
        : undefined,
  };
};

export async function createWorkflowVersion(
  workflow: any,
  version: number,
): Promise<WorkflowVersionRecord> {
  if (!WORKFLOW_VERSIONS_TABLE) {
    throw new Error("WORKFLOW_VERSIONS_TABLE environment variable is not configured");
  }

  const record: WorkflowVersionRecord = {
    workflow_id: workflow.workflow_id,
    tenant_id: workflow.tenant_id,
    version,
    snapshot: buildWorkflowVersionSnapshot(workflow),
    created_at: new Date().toISOString(),
  };

  await db.put(WORKFLOW_VERSIONS_TABLE, record);
  return record;
}

export async function ensureWorkflowVersionBaseline(workflow: any): Promise<void> {
  if (!WORKFLOW_VERSIONS_TABLE) {
    throw new Error("WORKFLOW_VERSIONS_TABLE environment variable is not configured");
  }

  const existing = await db.query(
    WORKFLOW_VERSIONS_TABLE,
    undefined,
    "workflow_id = :workflow_id",
    { ":workflow_id": workflow.workflow_id },
    undefined,
    1,
  );

  if (existing.items.length > 0) {
    return;
  }

  const version = resolveWorkflowVersion(workflow);
  await createWorkflowVersion(workflow, version);

  logger.info("[Workflow Versions] Seeded baseline version", {
    workflowId: workflow.workflow_id,
    version,
  });
}

export async function listWorkflowVersions(
  tenantId: string,
  workflowId: string,
  limit: number = 50,
): Promise<WorkflowVersionSummary[]> {
  if (!WORKFLOW_VERSIONS_TABLE) {
    throw new Error("WORKFLOW_VERSIONS_TABLE environment variable is not configured");
  }

  const result = await db.query(
    WORKFLOW_VERSIONS_TABLE,
    undefined,
    "workflow_id = :workflow_id",
    { ":workflow_id": workflowId },
    undefined,
    limit,
  );

  return result.items
    .filter((item) => item.tenant_id === tenantId)
    .map((item) => {
      const snapshot = item.snapshot || {};
      const steps = Array.isArray(snapshot.steps) ? snapshot.steps : [];
      return {
        workflow_id: item.workflow_id,
        version: item.version,
        created_at: item.created_at,
        workflow_name: snapshot.workflow_name || "Untitled Workflow",
        workflow_description: snapshot.workflow_description || "",
        step_count: steps.length,
        template_id: snapshot.template_id || undefined,
        template_version:
          typeof snapshot.template_version === "number"
            ? snapshot.template_version
            : 0,
      };
    });
}

export async function getWorkflowVersion(
  tenantId: string,
  workflowId: string,
  version: number,
): Promise<WorkflowVersionRecord> {
  if (!WORKFLOW_VERSIONS_TABLE) {
    throw new Error("WORKFLOW_VERSIONS_TABLE environment variable is not configured");
  }

  const record = await db.get(WORKFLOW_VERSIONS_TABLE, {
    workflow_id: workflowId,
    version,
  });

  if (!record) {
    throw new ApiError("This lead magnet version doesn't exist", 404);
  }

  if (record.tenant_id !== tenantId) {
    throw new ApiError("You don't have permission to access this lead magnet", 403);
  }

  return record as WorkflowVersionRecord;
}

export async function restoreWorkflowVersion(
  tenantId: string,
  workflowId: string,
  version: number,
): Promise<any> {
  const record = await getWorkflowVersion(tenantId, workflowId, version);
  const { workflowCrudService } = await import("./workflowCrudService");

  return workflowCrudService.updateWorkflow(
    tenantId,
    workflowId,
    record.snapshot,
  );
}
