import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';

const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE!;

class SubmissionsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const formId = queryParams.form_id;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    let submissions;
    if (formId) {
      submissions = await db.query(
        SUBMISSIONS_TABLE,
        'gsi_form_created',
        'form_id = :form_id',
        { ':form_id': formId },
        undefined,
        limit
      );
    } else {
      submissions = await db.query(
        SUBMISSIONS_TABLE,
        'gsi_tenant_created',
        'tenant_id = :tenant_id',
        { ':tenant_id': tenantId },
        undefined,
        limit
      );
    }

    return {
      statusCode: 200,
      body: {
        submissions,
        count: submissions.length,
      },
    };
  }

  async get(tenantId: string, submissionId: string): Promise<RouteResponse> {
    const submission = await db.get(SUBMISSIONS_TABLE, { submission_id: submissionId });

    if (!submission) {
      throw new ApiError('Submission not found', 404);
    }

    if (submission.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    return {
      statusCode: 200,
      body: submission,
    };
  }
}

export const submissionsController = new SubmissionsController();

