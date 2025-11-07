import JobDetailClient from './page-client'

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return []
}

export default function JobDetailPage() {
  return <JobDetailClient />
}

