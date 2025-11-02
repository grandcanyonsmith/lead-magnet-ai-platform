import { ulid } from 'ulid';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import OpenAI from 'openai';
import { db } from '../utils/db';
import { validate, createWorkflowSchema, updateWorkflowSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { calculateOpenAICost } from '../services/costService';

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE || 'leadmagnet-usage-records';
const OPENAI_SECRET_NAME = process.env.OPENAI_SECRET_NAME || 'leadmagnet/openai-api-key';
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function getOpenAIClient(): Promise<OpenAI> {
  const command = new GetSecretValueCommand({ SecretId: OPENAI_SECRET_NAME });
  const response = await secretsClient.send(command);
  
  if (!response.SecretString) {
    throw new ApiError('OpenAI API key not found in secret', 500);
  }

  let apiKey: string;
  
  try {
    const parsed = JSON.parse(response.SecretString);
    apiKey = parsed.OPENAI_API_KEY || parsed.apiKey || response.SecretString;
  } catch {
    apiKey = response.SecretString;
  }
  
  if (!apiKey || apiKey.trim().length === 0) {
    throw new ApiError('OpenAI API key is empty', 500);
  }

  return new OpenAI({ apiKey });
}

/**
 * Helper function to store usage record in DynamoDB.
 */
async function storeUsageRecord(
  tenantId: string,
  serviceType: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  jobId?: string
): Promise<void> {
  try {
    const usageId = `usage_${ulid()}`;
    const usageRecord = {
      usage_id: usageId,
      tenant_id: tenantId,
      job_id: jobId || null,
      service_type: serviceType,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      created_at: new Date().toISOString(),
    };

    await db.put(USAGE_RECORDS_TABLE, usageRecord);
    console.log('[Usage Tracking] Usage record stored', {
      usageId,
      tenantId,
      serviceType,
      model,
      inputTokens,
      outputTokens,
      costUsd,
    });
  } catch (error: any) {
    console.error('[Usage Tracking] Failed to store usage record', {
      error: error.message,
      tenantId,
      serviceType,
    });
  }
}

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

  async refineInstructions(tenantId: string, body: any): Promise<RouteResponse> {
    const { current_instructions, edit_prompt, model = 'gpt-4o' } = body;

    if (!current_instructions || !current_instructions.trim()) {
      throw new ApiError('Current instructions are required', 400);
    }

    if (!edit_prompt || !edit_prompt.trim()) {
      throw new ApiError('Edit prompt is required', 400);
    }

    console.log('[Workflow Instructions Refinement] Starting refinement', {
      tenantId,
      model,
      currentInstructionsLength: current_instructions.length,
      editPromptLength: edit_prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      console.log('[Workflow Instructions Refinement] OpenAI client initialized');

      const prompt = `You are an expert AI prompt engineer. Modify the following research instructions for an AI lead magnet generator based on these requests: "${edit_prompt}"

Current Instructions:
${current_instructions}

Requirements:
1. Apply the requested changes while maintaining clarity and effectiveness
2. Keep the overall structure and format unless specifically asked to change it
3. Ensure the instructions remain actionable and specific
4. Preserve any field references like [field_name] syntax
5. Return only the modified instructions, no markdown formatting, no explanations

Return ONLY the modified instructions, no markdown formatting, no explanations.`;

      console.log('[Workflow Instructions Refinement] Calling OpenAI for refinement...', {
        model,
        promptLength: prompt.length,
      });

      const refineStartTime = Date.now();
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI prompt engineer. Return only the modified instructions without markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const refineDuration = Date.now() - refineStartTime;
      console.log('[Workflow Instructions Refinement] Refinement completed', {
        duration: `${refineDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: completion.model,
      });

      // Track usage
      const usage = completion.usage;
      if (usage) {
        const inputTokens = usage.prompt_tokens || 0;
        const outputTokens = usage.completion_tokens || 0;
        const costData = calculateOpenAICost(model, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_workflow_refine',
          model,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const instructionsContent = completion.choices[0]?.message?.content || '';
      console.log('[Workflow Instructions Refinement] Refined instructions received', {
        instructionsLength: instructionsContent.length,
        firstChars: instructionsContent.substring(0, 100),
      });
      
      // Clean up markdown code blocks if present
      let cleanedInstructions = instructionsContent.trim();
      if (cleanedInstructions.startsWith('```')) {
        cleanedInstructions = cleanedInstructions.replace(/^```\w*\s*/i, '').replace(/\s*```$/i, '');
        console.log('[Workflow Instructions Refinement] Removed ``` markers');
      }

      const totalDuration = Date.now() - refineStartTime;
      console.log('[Workflow Instructions Refinement] Success!', {
        tenantId,
        instructionsLength: cleanedInstructions.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: {
          instructions: cleanedInstructions,
        },
      };
    } catch (error: any) {
      console.error('[Workflow Instructions Refinement] Error occurred', {
        tenantId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || 'Failed to refine instructions with AI',
        500
      );
    }
  }
}

export const workflowsController = new WorkflowsController();

