"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionsController = void 0;
const db_1 = require("../utils/db");
const errors_1 = require("../utils/errors");
const env_1 = require("../utils/env");
const SUBMISSIONS_TABLE = env_1.env.submissionsTable;
class SubmissionsController {
    async list(_tenantId, queryParams) {
        const formId = queryParams.form_id;
        const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
        let submissionsResult;
        if (formId) {
            submissionsResult = await db_1.db.query(SUBMISSIONS_TABLE, 'gsi_form_created', 'form_id = :form_id', { ':form_id': formId }, undefined, limit);
        }
        else {
            // Remove tenant_id filtering - show all submissions from all accounts
            submissionsResult = { items: await db_1.db.scan(SUBMISSIONS_TABLE, limit) };
        }
        const submissions = (0, db_1.normalizeQueryResult)(submissionsResult);
        return {
            statusCode: 200,
            body: {
                submissions,
                count: submissions.length,
            },
        };
    }
    async get(_tenantId, submissionId) {
        const submission = await db_1.db.get(SUBMISSIONS_TABLE, { submission_id: submissionId });
        if (!submission) {
            throw new errors_1.ApiError('This form submission doesn\'t exist', 404);
        }
        // Removed tenant_id check - allow access to all submissions from all accounts
        return {
            statusCode: 200,
            body: submission,
        };
    }
}
exports.submissionsController = new SubmissionsController();
//# sourceMappingURL=submissions.js.map