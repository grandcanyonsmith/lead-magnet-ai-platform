"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/auth";
import { logger } from "@/utils/logger";

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const checkAuthAndRedirect = useCallback(async () => {
    if (!mounted) {
      return;
    }

    try {
      const authenticated = await authService.isAuthenticated();
      if (authenticated) {
        router.push("/dashboard");
      } else {
        router.push("/auth/login");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Auth check failed on home page", {
        error: err,
        context: "Home",
      });
      setError(errorMessage);
      // Fallback to login page on error
      router.push("/auth/login");
    }
  }, [router, mounted]);

  useEffect(() => {
    checkAuthAndRedirect();
  }, [checkAuthAndRedirect]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6" role="alert">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">Error</h1>
          <p className="text-red-600 mb-4" aria-live="polite">
            {error}
          </p>
          <p className="text-gray-600 text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          Lead Magnet AI Platform
        </h1>
        <p className="text-gray-600" aria-live="polite">
          Loading...
        </p>
        {mounted && (
          <p
            className="text-sm text-gray-400 mt-2"
            aria-label="Checking authentication status"
          >
            Checking authentication...
          </p>
        )}
      </div>
    </div>
  );
}
