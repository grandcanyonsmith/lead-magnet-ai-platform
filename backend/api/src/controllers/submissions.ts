import { db, normalizeQueryResult } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { env } from '../utils/env';

const SUBMISSIONS_TABLE = env.submissionsTable;

class SubmissionsController {
  async list(_tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const formId = queryParams.form_id;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    let submissionsResult;
    if (formId) {
      submissionsResult = await db.query(
        SUBMISSIONS_TABLE,
        'gsi_form_created',
        'form_id = :form_id',
        { ':form_id': formId },
        undefined,
        limit
      );
    } else {
      // Remove tenant_id filtering - show all submissions from all accounts
      submissionsResult = { items: await db.scan(SUBMISSIONS_TABLE, limit) };
    }
    const submissions = normalizeQueryResult(submissionsResult);

    return {
      statusCode: 200,
      body: {
        submissions,
        count: submissions.length,
      },
    };
  }

  async get(_tenantId: string, submissionId: string): Promise<RouteResponse> {
    const submission = await db.get(SUBMISSIONS_TABLE, { submission_id: submissionId });

    if (!submission) {
      throw new ApiError('This form submission doesn\'t exist', 404);
    }

    // Removed tenant_id check - allow access to all submissions from all accounts

    return {
      statusCode: 200,
      body: submission,
    };
  }
}

export const submissionsController = new SubmissionsController();

