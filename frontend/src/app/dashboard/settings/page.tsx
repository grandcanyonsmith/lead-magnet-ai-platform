"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingState } from "@/components/ui/LoadingState";

export default function SettingsRootPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams?.get("tab");
    const target =
      tab === "branding"
        ? "/dashboard/settings/branding"
        : tab === "delivery"
          ? "/dashboard/settings/delivery"
          : tab === "billing"
            ? "/dashboard/settings/billing"
            : "/dashboard/settings/general";

    router.replace(target);
  }, [router, searchParams]);

    return <LoadingState message="Loading settings..." fullPage />;
}
