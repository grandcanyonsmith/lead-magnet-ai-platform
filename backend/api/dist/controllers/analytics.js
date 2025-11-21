"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsController = void 0;
const db_1 = require("../utils/db");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
const JOBS_TABLE = env_1.env.jobsTable;
const SUBMISSIONS_TABLE = env_1.env.submissionsTable;
const WORKFLOWS_TABLE = env_1.env.workflowsTable;
if (!JOBS_TABLE) {
    logger_1.logger.error('[Analytics Controller] JOBS_TABLE environment variable is not set');
}
if (!SUBMISSIONS_TABLE) {
    logger_1.logger.error('[Analytics Controller] SUBMISSIONS_TABLE environment variable is not set');
}
if (!WORKFLOWS_TABLE) {
    logger_1.logger.error('[Analytics Controller] WORKFLOWS_TABLE environment variable is not set');
}
class AnalyticsController {
    async getAnalytics(tenantId, queryParams) {
        logger_1.logger.info('[Analytics] Starting analytics query', { tenantId, queryParams });
        // Validate environment variables
        if (!JOBS_TABLE || !SUBMISSIONS_TABLE || !WORKFLOWS_TABLE) {
            throw new errors_1.ApiError('Analytics service configuration error: Missing required environment variables', 500);
        }
        const days = queryParams.days ? parseInt(queryParams.days) : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString();
        let jobs = [];
        let submissions = [];
        let workflows = [];
        try {
            // Get all jobs for tenant in date range
            const jobsResult = await db_1.db.query(JOBS_TABLE, 'gsi_tenant_created', 'tenant_id = :tenant_id AND created_at >= :start_date', { ':tenant_id': tenantId, ':start_date': startDateStr });
            jobs = (0, db_1.normalizeQueryResult)(jobsResult);
            logger_1.logger.info('[Analytics] Jobs query completed', { count: jobs.length });
        }
        catch (error) {
            logger_1.logger.error('[Analytics] Jobs query error', {
                error: error.message,
                errorName: error.name,
                table: JOBS_TABLE,
            });
            if (error.name !== 'ResourceNotFoundException' && error.name !== 'AccessDeniedException') {
                throw error;
            }
        }
        try {
            // Get all submissions for tenant in date range
            const submissionsResult = await db_1.db.query(SUBMISSIONS_TABLE, 'gsi_tenant_created', 'tenant_id = :tenant_id AND created_at >= :start_date', { ':tenant_id': tenantId, ':start_date': startDateStr });
            submissions = (0, db_1.normalizeQueryResult)(submissionsResult);
            logger_1.logger.info('[Analytics] Submissions query completed', { count: submissions.length });
        }
        catch (error) {
            logger_1.logger.error('[Analytics] Submissions query error', {
                error: error.message,
                errorName: error.name,
                table: SUBMISSIONS_TABLE,
            });
            if (error.name !== 'ResourceNotFoundException' && error.name !== 'AccessDeniedException') {
                throw error;
            }
        }
        try {
            // Get all workflows for tenant
            const workflowsResult = await db_1.db.query(WORKFLOWS_TABLE, 'gsi_tenant_status', 'tenant_id = :tenant_id', { ':tenant_id': tenantId });
            workflows = (0, db_1.normalizeQueryResult)(workflowsResult);
            logger_1.logger.info('[Analytics] Workflows query completed', { count: workflows.length });
        }
        catch (error) {
            logger_1.logger.error('[Analytics] Workflows query error', {
                error: error.message,
                errorName: error.name,
                table: WORKFLOWS_TABLE,
            });
            if (error.name !== 'ResourceNotFoundException' && error.name !== 'AccessDeniedException') {
                throw error;
            }
        }
        // Calculate metrics
        const totalJobs = jobs.length;
        const completedJobs = jobs.filter((j) => j.status === 'completed').length;
        const failedJobs = jobs.filter((j) => j.status === 'failed').length;
        const pendingJobs = jobs.filter((j) => j.status === 'pending' || j.status === 'processing').length;
        const totalSubmissions = submissions.length;
        const totalWorkflows = workflows.filter((w) => !w.deleted_at).length;
        const activeWorkflows = workflows.filter((w) => w.status === 'active' && !w.deleted_at).length;
        // Calculate success rate
        const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;
        // Calculate average processing time for completed jobs
        const completedJobsWithTimes = jobs.filter((j) => j.status === 'completed' && j.completed_at && j.created_at);
        let avgProcessingTime = 0;
        if (completedJobsWithTimes.length > 0) {
            const totalTime = completedJobsWithTimes.reduce((sum, j) => {
                const start = new Date(j.created_at).getTime();
                const end = new Date(j.completed_at).getTime();
                return sum + (end - start);
            }, 0);
            avgProcessingTime = Math.round(totalTime / completedJobsWithTimes.length / 1000); // seconds
        }
        // Group jobs by day
        const jobsByDay = {};
        jobs.forEach((j) => {
            const date = j.created_at.split('T')[0];
            jobsByDay[date] = (jobsByDay[date] || 0) + 1;
        });
        // Group submissions by day
        const submissionsByDay = {};
        submissions.forEach((s) => {
            const date = s.created_at.split('T')[0];
            submissionsByDay[date] = (submissionsByDay[date] || 0) + 1;
        });
        // Jobs by status
        const jobsByStatus = {
            completed: completedJobs,
            failed: failedJobs,
            pending: pendingJobs,
        };
        // Jobs by workflow
        const jobsByWorkflow = {};
        jobs.forEach((j) => {
            jobsByWorkflow[j.workflow_id] = (jobsByWorkflow[j.workflow_id] || 0) + 1;
        });
        const response = {
            statusCode: 200,
            body: {
                overview: {
                    total_jobs: totalJobs,
                    completed_jobs: completedJobs,
                    failed_jobs: failedJobs,
                    pending_jobs: pendingJobs,
                    total_submissions: totalSubmissions,
                    total_workflows: totalWorkflows,
                    active_workflows: activeWorkflows,
                    success_rate: Math.round(successRate * 100) / 100,
                    avg_processing_time_seconds: avgProcessingTime,
                },
                trends: {
                    jobs_by_day: jobsByDay,
                    submissions_by_day: submissionsByDay,
                },
                breakdown: {
                    jobs_by_status: jobsByStatus,
                    jobs_by_workflow: jobsByWorkflow,
                },
            },
        };
        logger_1.logger.info('[Analytics] Returning response', {
            statusCode: response.statusCode,
            bodyKeys: Object.keys(response.body),
            overview: response.body.overview,
        });
        return response;
    }
}
exports.analyticsController = new AnalyticsController();
//# sourceMappingURL=analytics.js.map