import { ulid } from 'ulid';
import { db } from '../utils/db';
import { validate, createWorkflowSchema, updateWorkflowSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE!;

class WorkflowsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const status = queryParams.status;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    let workflows;
    if (status) {
      workflows = await db.query(
        WORKFLOWS_TABLE,
        'gsi_tenant_status',
        'tenant_id = :tenant_id AND #status = :status',
        { ':tenant_id': tenantId, ':status': status },
        { '#status': 'status' },
        limit
      );
    } else {
      workflows = await db.query(
        WORKFLOWS_TABLE,
        'gsi_tenant_status',
        'tenant_id = :tenant_id',
        { ':tenant_id': tenantId },
        undefined,
        limit
      );
    }

    // Filter out soft-deleted items
    workflows = workflows.filter((w: any) => !w.deleted_at);

    return {
      statusCode: 200,
      body: {
        workflows,
        count: workflows.length,
      },
    };
  }

  async get(tenantId: string, workflowId: string): Promise<RouteResponse> {
    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('Workflow not found', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    return {
      statusCode: 200,
      body: workflow,
    };
  }

  async create(tenantId: string, body: any): Promise<RouteResponse> {
    const data = validate(createWorkflowSchema, body);

    const workflow = {
      workflow_id: `wf_${ulid()}`,
      tenant_id: tenantId,
      ...data,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.put(WORKFLOWS_TABLE, workflow);

    return {
      statusCode: 201,
      body: workflow,
    };
  }

  async update(tenantId: string, workflowId: string, body: any): Promise<RouteResponse> {
    const existing = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('Workflow not found', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    const data = validate(updateWorkflowSchema, body);

    const updated = await db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
      ...data,
      updated_at: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      body: updated,
    };
  }

  async delete(tenantId: string, workflowId: string): Promise<RouteResponse> {
    const existing = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('Workflow not found', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    // Soft delete
    await db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
      deleted_at: new Date().toISOString(),
    });

    return {
      statusCode: 204,
      body: {},
    };
  }
}

export const workflowsController = new WorkflowsController();

