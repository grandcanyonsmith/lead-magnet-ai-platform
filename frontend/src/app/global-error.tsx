"use client";

import { useEffect } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global app error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <FiAlertCircle className="h-6 w-6 text-destructive" />
              <h2 className="text-xl font-semibold text-foreground">
                App unavailable
              </h2>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              {error.message ||
                "A critical error prevented the app from rendering."}
            </p>
            <div className="flex gap-3">
              <Button onClick={reset} className="flex-1">
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex-1"
              >
                Reload app
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
