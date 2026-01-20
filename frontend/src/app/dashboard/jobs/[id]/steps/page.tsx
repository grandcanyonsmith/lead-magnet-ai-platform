import StepsRedirect from "./client";

export async function generateStaticParams(): Promise<{ id: string }[]> {
  // Placeholder to satisfy static export requirements.
  return [{ id: "_" }];
}

interface JobStepsIndexPageProps {
  params: { id: string };
}

export default function JobStepsIndexPage({
  params,
}: JobStepsIndexPageProps) {
  return <StepsRedirect jobId={params?.id} />;
}
