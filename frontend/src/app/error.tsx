"use client";

import { useEffect } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <FiAlertCircle className="h-6 w-6 text-destructive" />
          <h2 className="text-xl font-semibold text-foreground">
            Something went wrong
          </h2>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          {error.message ||
            "An unexpected error occurred while loading this page."}
        </p>
        <div className="flex gap-3">
          <Button onClick={reset} className="flex-1">
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/dashboard")}
            className="flex-1"
          >
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
