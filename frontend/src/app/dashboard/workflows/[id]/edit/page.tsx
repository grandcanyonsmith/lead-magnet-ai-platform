import EditWorkflowClient from "./client";

export async function generateStaticParams(): Promise<{ id: string }[]> {
  // Return at least one placeholder route to satisfy Next.js static export requirements
  // Actual routes will be handled client-side via CloudFront fallback
  return [{ id: "_" }];
}

export const dynamicParams = true;

export default function EditWorkflowPage() {
  return <EditWorkflowClient />;
}
