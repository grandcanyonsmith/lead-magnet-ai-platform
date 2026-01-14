"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { logger } from "@/utils/logger";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        logger.debug("Authenticated, redirecting to dashboard", {
          context: "Home",
        });
        router.push("/dashboard");
      } else {
        logger.debug("Not authenticated, redirecting to login", {
          context: "Home",
        });
        router.push("/auth/login");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          Lead Magnet AI Platform
        </h1>
        <p className="text-gray-600" aria-live="polite">
          {isLoading ? "Checking authentication..." : "Redirecting..."}
        </p>
      </div>
    </div>
  );
}
