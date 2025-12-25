"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { BillingClient } from "@/lib/api/billing.client";
import { FiCheck, FiDollarSign, FiZap } from "react-icons/fi";
import { getIdToken } from "@/lib/auth";

export default function SetupBillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        router.push("/auth/login?redirect=/setup-billing");
        return;
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, [router]);

  const handleStartSubscription = async () => {
    setLoading(true);
    setError("");

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const billingClient = new BillingClient({
        getToken: () => token,
      });

      // Create checkout session
      const baseUrl = window.location.origin;
      const { checkout_url } = await billingClient.createCheckoutSession(
        `${baseUrl}/dashboard?billing=success`,
        `${baseUrl}/setup-billing`,
      );

      // Redirect to Stripe Checkout
      window.location.href = checkout_url;
    } catch (err: any) {
      console.error("Failed to create checkout session:", err);
      setError(
        err.message || "Failed to create checkout session. Please try again.",
      );
      setLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Complete Your Setup
          </h1>
          <p className="text-xl text-gray-600">
            Start your subscription to unlock the full power of Lead Magnet AI
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Pricing Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-2">Pro Plan</h2>
            <div className="flex items-baseline justify-center mb-4">
              <span className="text-5xl font-extrabold text-white">$29</span>
              <span className="text-xl text-primary-100 ml-2">/month</span>
            </div>
            <p className="text-primary-100 text-lg">
              + metered usage beyond included allowance
            </p>
          </div>

          {/* Features */}
          <div className="px-8 py-10">
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                What&apos;s included:
              </h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <FiCheck className="w-6 h-6 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">
                      $10 included usage per month
                    </p>
                    <p className="text-sm text-gray-600">
                      Equivalent to ~20,000 AI-generated words or ~5 complete
                      workflows
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <FiCheck className="w-6 h-6 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">
                      2x markup on OpenAI costs
                    </p>
                    <p className="text-sm text-gray-600">
                      Usage beyond included allowance is charged at 2x the
                      actual OpenAI API cost
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <FiZap className="w-6 h-6 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">
                      Unlimited workflows & forms
                    </p>
                    <p className="text-sm text-gray-600">
                      Create as many lead magnets as you need
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <FiZap className="w-6 h-6 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">
                      Advanced AI models
                    </p>
                    <p className="text-sm text-gray-600">
                      Access to GPT-4, Claude, and other state-of-the-art models
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <FiDollarSign className="w-6 h-6 text-purple-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">
                      Transparent billing
                    </p>
                    <p className="text-sm text-gray-600">
                      Track your usage and costs in real-time from your
                      dashboard
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
              <p className="text-sm text-blue-800">
                <strong>How billing works:</strong> You&apos;ll be charged
                $29/month for your base subscription. This includes $10 of
                usage. If you exceed $10 in usage during a billing period,
                you&apos;ll be charged for the overage at the end of the month.
                Cancel anytime.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleStartSubscription}
              disabled={loading}
              className="w-full flex items-center justify-center px-8 py-4 bg-primary-600 text-white text-lg font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  Creating checkout session...
                </>
              ) : (
                <>
                  Start Subscription
                  <FiCheck className="w-5 h-5 ml-2" />
                </>
              )}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              Secure payment processed by Stripe
            </p>
          </div>
        </div>

        {/* Skip Option */}
        <div className="text-center mt-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-gray-600 hover:text-gray-900 underline"
          >
            I&apos;ll set this up later
          </button>
        </div>
      </div>
    </div>
  );
}
