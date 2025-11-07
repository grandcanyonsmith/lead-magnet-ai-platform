export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return []
}

import PublicFormClient from './page-client'

export default function PublicFormPage() {
  return <PublicFormClient />
}
