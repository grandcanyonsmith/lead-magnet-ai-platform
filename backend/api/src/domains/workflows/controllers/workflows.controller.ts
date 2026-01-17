import { RouteResponse } from '@routes/routes';
import { workflowCrudService } from '@domains/workflows/services/workflowCrudService';

class WorkflowsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const { workflows, count } = await workflowCrudService.listWorkflows(tenantId, queryParams);
    
    return {
      statusCode: 200,
      body: {
        workflows,
        count,
      },
    };
  }

  async get(tenantId: string, workflowId: string): Promise<RouteResponse> {
    const workflow = await workflowCrudService.getWorkflow(tenantId, workflowId);
    
    return {
      statusCode: 200,
      body: workflow,
    };
  }

  async create(tenantId: string, body: any): Promise<RouteResponse> {
    const workflow = await workflowCrudService.createWorkflow(tenantId, body);
    
    return {
      statusCode: 201,
      body: workflow,
    };
  }

  async update(tenantId: string, workflowId: string, body: any): Promise<RouteResponse> {
    const workflow = await workflowCrudService.updateWorkflow(tenantId, workflowId, body);
    
    return {
      statusCode: 200,
      body: workflow,
    };
  }

  async delete(tenantId: string, workflowId: string): Promise<RouteResponse> {
    await workflowCrudService.deleteWorkflow(tenantId, workflowId);
    
    return {
      statusCode: 204,
      body: {},
    };
  }

  async duplicate(tenantId: string, workflowId: string): Promise<RouteResponse> {
    const workflow = await workflowCrudService.duplicateWorkflow(tenantId, workflowId);

    return {
      statusCode: 201,
      body: workflow,
    };
  }
}

export const workflowsController = new WorkflowsController();
