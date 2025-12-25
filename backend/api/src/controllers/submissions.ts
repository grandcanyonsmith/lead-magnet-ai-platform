import { db, normalizeQueryResult } from "../utils/db";
import { ApiError } from "../utils/errors";
import { RouteResponse } from "../routes";
import { env } from "../utils/env";

const SUBMISSIONS_TABLE = env.submissionsTable;

class SubmissionsController {
  async list(
    tenantId: string,
    queryParams: Record<string, any>,
  ): Promise<RouteResponse> {
    const formId = queryParams.form_id;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    let submissionsResult;
    if (formId) {
      submissionsResult = await db.query(
        SUBMISSIONS_TABLE,
        "gsi_form_created",
        "form_id = :form_id",
        { ":form_id": formId },
        undefined,
        limit,
      );
    } else {
      submissionsResult = await db.query(
        SUBMISSIONS_TABLE,
        "gsi_tenant_created",
        "tenant_id = :tenant_id",
        { ":tenant_id": tenantId },
        undefined,
        limit,
      );
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

  async get(tenantId: string, submissionId: string): Promise<RouteResponse> {
    const submission = await db.get(SUBMISSIONS_TABLE, {
      submission_id: submissionId,
    });

    if (!submission) {
      throw new ApiError("This form submission doesn't exist", 404);
    }

    if (submission.tenant_id !== tenantId) {
      throw new ApiError(
        "You don't have permission to access this submission",
        403,
      );
    }

    return {
      statusCode: 200,
      body: submission,
    };
  }
}

export const submissionsController = new SubmissionsController();
