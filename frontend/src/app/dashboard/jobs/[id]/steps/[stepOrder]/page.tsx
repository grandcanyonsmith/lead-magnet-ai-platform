import StepDetailClient from "./client";

export async function generateStaticParams(): Promise<
  { id: string; stepOrder: string }[]
> {
  // Placeholder to satisfy static export requirements.
  return [{ id: "_", stepOrder: "_" }];
}

export default function JobStepDetailPage() {
  return <StepDetailClient />;
}
