"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingState } from "@/components/ui/LoadingState";

function SettingsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams?.get("tab");
    let target = "/dashboard/settings/general";
    if (tab === "branding") {
      target = "/dashboard/settings/branding";
    } else if (tab === "delivery") {
      target = "/dashboard/settings/delivery";
    } else if (tab === "prompt-overrides") {
      target = "/dashboard/settings/prompt-overrides";
    } else if (tab === "billing") {
      target = "/dashboard/settings/billing";
    }

    router.replace(target);
  }, [router, searchParams]);

  return <LoadingState message="Loading settings..." fullPage />;
}

export default function SettingsRootPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading settings..." fullPage />}>
      <SettingsRedirect />
    </Suspense>
  );
}
