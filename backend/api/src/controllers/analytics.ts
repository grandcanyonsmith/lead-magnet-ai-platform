import { db } from '../utils/db';
import { RouteResponse } from '../routes';

const JOBS_TABLE = process.env.JOBS_TABLE!;
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE!;
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE!;

class AnalyticsController {
  async getAnalytics(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const days = queryParams.days ? parseInt(queryParams.days) : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // Get all jobs for tenant in date range
    const jobs = await db.query(
      JOBS_TABLE,
      'gsi_tenant_created',
      'tenant_id = :tenant_id AND created_at >= :start_date',
      { ':tenant_id': tenantId, ':start_date': startDateStr }
    );

    // Get all submissions for tenant in date range
    const submissions = await db.query(
      SUBMISSIONS_TABLE,
      'gsi_tenant_created',
      'tenant_id = :tenant_id AND created_at >= :start_date',
      { ':tenant_id': tenantId, ':start_date': startDateStr }
    );

    // Get all workflows for tenant
    const workflows = await db.query(
      WORKFLOWS_TABLE,
      'gsi_tenant_status',
      'tenant_id = :tenant_id',
      { ':tenant_id': tenantId }
    );

    // Calculate metrics
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((j: any) => j.status === 'completed').length;
    const failedJobs = jobs.filter((j: any) => j.status === 'failed').length;
    const pendingJobs = jobs.filter((j: any) => j.status === 'pending' || j.status === 'processing').length;

    const totalSubmissions = submissions.length;
    const totalWorkflows = workflows.filter((w: any) => !w.deleted_at).length;
    const activeWorkflows = workflows.filter((w: any) => w.status === 'active' && !w.deleted_at).length;

    // Calculate success rate
    const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    // Calculate average processing time for completed jobs
    const completedJobsWithTimes = jobs.filter(
      (j: any) => j.status === 'completed' && j.completed_at && j.created_at
    );
    let avgProcessingTime = 0;
    if (completedJobsWithTimes.length > 0) {
      const totalTime = completedJobsWithTimes.reduce((sum: number, j: any) => {
        const start = new Date(j.created_at).getTime();
        const end = new Date(j.completed_at).getTime();
        return sum + (end - start);
      }, 0);
      avgProcessingTime = Math.round(totalTime / completedJobsWithTimes.length / 1000); // seconds
    }

    // Group jobs by day
    const jobsByDay: Record<string, number> = {};
    jobs.forEach((j: any) => {
      const date = j.created_at.split('T')[0];
      jobsByDay[date] = (jobsByDay[date] || 0) + 1;
    });

    // Group submissions by day
    const submissionsByDay: Record<string, number> = {};
    submissions.forEach((s: any) => {
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
    const jobsByWorkflow: Record<string, number> = {};
    jobs.forEach((j: any) => {
      jobsByWorkflow[j.workflow_id] = (jobsByWorkflow[j.workflow_id] || 0) + 1;
    });

    return {
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
  }
}

export const analyticsController = new AnalyticsController();

