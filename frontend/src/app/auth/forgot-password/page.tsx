"use client";

import { useState } from "react";
import Link from "next/link";
import { authService } from "@/lib/auth";
import { logger } from "@/utils/logger";

type Step = "request" | "confirm";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const trimmedEmail = email.trim();
    try {
      const result = await authService.forgotPassword(trimmedEmail);
      if (result.success) {
        setStep("confirm");
        setMessage("Verification code sent. Check your email.");
      } else {
        setError(result.error || "Unable to send reset code");
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unable to send reset code";
      logger.error("Forgot password request failed", {
        error: err,
        context: "ForgotPassword",
      });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    const trimmedPassword = newPassword.trim();

    try {
      const result = await authService.confirmForgotPassword(
        trimmedEmail,
        trimmedCode,
        trimmedPassword,
      );
      if (result.success) {
        setMessage("Password reset successfully. You can now sign in.");
      } else {
        setError(result.error || "Unable to reset password");
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unable to reset password";
      logger.error("Forgot password confirm failed", {
        error: err,
        context: "ForgotPassword",
      });
      setError(msg);
    } finally {
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
          <h2 className="text-3xl font-bold text-gray-900">Forgot password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Reset access to your account
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {error && (
            <div
              className="bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded-md mb-4 flex items-start"
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

          {message && (
            <div
              className="bg-green-50 border-l-4 border-green-500 text-green-800 px-4 py-3 rounded-md mb-4"
              role="status"
              aria-live="polite"
            >
              <p className="text-sm">{message}</p>
            </div>
          )}

          {step === "request" && (
            <form className="space-y-6" onSubmit={handleRequest}>
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

              <button
                type="submit"
                disabled={loading}
                aria-label={loading ? "Sending code..." : "Send reset code"}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
              >
                {loading ? "Sending..." : "Send reset code"}
              </button>
            </form>
          )}

          {step === "confirm" && (
            <form className="space-y-6" onSubmit={handleConfirm}>
              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Verification code
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Enter the code from your email"
                />
              </div>

              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  New password
                </label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Enter your new password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-label={loading ? "Resetting..." : "Reset password"}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
              >
                {loading ? "Resetting..." : "Reset password"}
              </button>
            </form>
          )}

          <div className="text-center pt-4 border-t border-gray-200 mt-6">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
