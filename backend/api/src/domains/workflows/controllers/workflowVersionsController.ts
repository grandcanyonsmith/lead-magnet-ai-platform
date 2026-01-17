import { RouteResponse } from "@routes/routes";
import { workflowCrudService } from "@domains/workflows/services/workflowCrudService";
import {
  ensureWorkflowVersionBaseline,
  getWorkflowVersion,
  listWorkflowVersions,
  resolveWorkflowVersion,
  restoreWorkflowVersion,
} from "@domains/workflows/services/workflowVersionService";
import { ApiError } from "@utils/errors";

class WorkflowVersionsController {
  async list(
    tenantId: string,
    workflowId: string,
    queryParams: Record<string, any>,
  ): Promise<RouteResponse> {
    const workflow = await workflowCrudService.getWorkflow(tenantId, workflowId);
    await ensureWorkflowVersionBaseline(workflow);

    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 50;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 50;
    const versions = await listWorkflowVersions(
      tenantId,
      workflowId,
      safeLimit,
    );

    return {
      statusCode: 200,
      body: {
        versions,
        count: versions.length,
        current_version: resolveWorkflowVersion(workflow),
      },
    };
  }

  async get(
    tenantId: string,
    workflowId: string,
    versionParam: string,
  ): Promise<RouteResponse> {
    const version = parseInt(versionParam, 10);
    if (!Number.isFinite(version)) {
      throw new ApiError("Version must be a number", 400);
    }

    const workflow = await workflowCrudService.getWorkflow(tenantId, workflowId);
    await ensureWorkflowVersionBaseline(workflow);
    const record = await getWorkflowVersion(tenantId, workflowId, version);

    return {
      statusCode: 200,
      body: record,
    };
  }

  async restore(
    tenantId: string,
    workflowId: string,
    versionParam: string,
  ): Promise<RouteResponse> {
    const version = parseInt(versionParam, 10);
    if (!Number.isFinite(version)) {
      throw new ApiError("Version must be a number", 400);
    }

    const workflow = await workflowCrudService.getWorkflow(tenantId, workflowId);
    await ensureWorkflowVersionBaseline(workflow);
    const updated = await restoreWorkflowVersion(tenantId, workflowId, version);

    return {
      statusCode: 200,
      body: updated,
    };
  }
}

export const workflowVersionsController = new WorkflowVersionsController();
