import { db } from "../../utils/db";
import { env } from "../../utils/env";
import { logger } from "../../utils/logger";

const SUBMISSIONS_TABLE = env.submissionsTable;

export class SubmissionPreviewService {
  async attachPreviewsToJobs(jobs: any[]): Promise<any[]> {
    const submissionIds = [
      ...new Set(
        jobs
          .map((j: any) => j.submission_id)
          .filter((id) => id !== undefined && id !== null),
      ),
    ];

    const submissionKeys = submissionIds.map((id) => ({ submission_id: id }));
    const submissionsMap = new Map();

    if (submissionKeys.length > 0) {
      try {
        const submissions = await db.batchGet(SUBMISSIONS_TABLE, submissionKeys);
        submissions.forEach((s) => submissionsMap.set(s.submission_id, s));
      } catch (error) {
        logger.warn("Failed to batch fetch submissions", { error });
      }
    }

    return jobs.map((job: any) => {
      if (job.submission_id) {
        const submission = submissionsMap.get(job.submission_id);
        if (submission) {
          try {
            let nameFromData = null;
            if (submission.submission_data) {
              nameFromData =
                submission.submission_data.name ||
                submission.submission_data.full_name ||
                submission.submission_data.first_name ||
                submission.submission_data.Name ||
                null;
            }

            let formDataPreview = null;
            if (submission.submission_data) {
              const entries = Object.entries(submission.submission_data);
              const nameFields = ["name", "Name", "full_name", "first_name"];
              const nameEntries: [string, any][] = [];
              const otherEntries: [string, any][] = [];

              entries.forEach(([key, value]) => {
                if (nameFields.includes(key)) {
                  nameEntries.push([key, value]);
                } else {
                  otherEntries.push([key, value]);
                }
              });

              const prioritizedEntries = [
                ...nameEntries,
                ...otherEntries,
              ].slice(0, 5);
              formDataPreview = Object.fromEntries(prioritizedEntries);
            }

            job.submission_preview = {
              submitter_name: submission.submitter_name || nameFromData || null,
              submitter_email: submission.submitter_email || null,
              submitter_phone: submission.submitter_phone || null,
              form_data_preview: formDataPreview,
            };
          } catch (error) {
            // Ignore preview errors
          }
        }
      }
      return job;
    });
  }
}

export const submissionPreviewService = new SubmissionPreviewService();
