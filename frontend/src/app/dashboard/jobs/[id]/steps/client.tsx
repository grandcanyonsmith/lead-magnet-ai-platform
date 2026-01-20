"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/ui/LoadingState";

interface StepsRedirectProps {
  jobId?: string;
}

export default function StepsRedirect({ jobId }: StepsRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    if (jobId && jobId !== "_") {
      router.replace(`/dashboard/jobs/${jobId}`);
      return;
    }

    router.replace("/dashboard/jobs");
  }, [jobId, router]);

  return <LoadingState message="Returning to job..." fullPage />;
}
