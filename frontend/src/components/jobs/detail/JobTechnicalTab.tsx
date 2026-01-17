import { TechnicalDetails } from "@/components/jobs/TechnicalDetails";
import type { Form, FormSubmission } from "@/types/form";
import type { Job } from "@/types/job";

interface JobTechnicalTabProps {
  job: Job;
  form: Form | null;
  submission?: FormSubmission | null;
}

export function JobTechnicalTab({
  job,
  form,
  submission,
}: JobTechnicalTabProps) {
  return <TechnicalDetails job={job} form={form} submission={submission} />;
}
