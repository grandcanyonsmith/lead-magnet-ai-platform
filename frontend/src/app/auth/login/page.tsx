"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authService } from "@/lib/auth";
import { api } from "@/lib/api";
import { logger } from "@/utils/logger";
import { Settings } from "@/types/settings";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pre-fill email from query params
    const emailParam = searchParams?.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const checkOnboardingAndRedirect = useCallback(async () => {
    try {
      // Check if onboarding survey is completed
      const settings = (await api.getSettings()) as Settings;
      const redirectParam = searchParams?.get("redirect");

      if (!settings.onboarding_survey_completed) {
        // Redirect to onboarding survey
        router.push("/onboarding/survey");
      } else if (redirectParam) {
        // Redirect to specified path
        router.push(redirectParam);
      } else {
        // Default to dashboard
        router.push("/dashboard");
      }
    } catch (error) {
      logger.error("Failed to check onboarding status", {
        error,
        context: "LoginPage",
      });
      // Default to dashboard on error
      router.push("/dashboard");
    }
  }, [router, searchParams]);

  const waitForCognitoTokens = useCallback(
    async (maxAttempts = 10, delay = 100): Promise<boolean> => {
      // Our app also stores tokens under custom keys (used by the API client).
      // Prefer those first so local/mock auth flows don't hang waiting for Cognito SDK keys.
      const customIdToken = localStorage.getItem("id_token");
      if (customIdToken) return true;

      const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";
      if (!clientId) return false;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const lastAuthUser = localStorage.getItem(
          `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`,
        );
        if (lastAuthUser) {
          const idToken = localStorage.getItem(
            `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`,
          );
          if (idToken) {
            return true;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return false;
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await authService.signIn(email, password);
      if (result.success) {
        // Wait for Cognito tokens to be stored
        const tokensReady = await waitForCognitoTokens();
        if (tokensReady) {
          await checkOnboardingAndRedirect();
        } else {
          // If tokens aren't ready after max attempts, still try to redirect
          logger.warn("Cognito tokens not ready after max attempts", {
            context: "LoginPage",
          });
          await checkOnboardingAndRedirect();
        }
      } else {
        setError(result.error || "Failed to sign in");
        setLoading(false);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      logger.error("Login failed", { error: err, context: "LoginPage" });
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Lead Magnet AI</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to get started
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div
                className="bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded-md flex items-start"
                role="alert"
                aria-live="polite"
              >
                <svg
                  className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Enter your password"
                />
                <div className="mt-2 text-right">
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-label={loading ? "Signing in..." : "Sign in"}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
