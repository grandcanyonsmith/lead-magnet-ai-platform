"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import axios from "axios";
import { logger } from "@/utils/logger";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type FormField = {
  field_id: string;
  field_type:
    | "text"
    | "textarea"
    | "email"
    | "tel"
    | "number"
    | "select"
    | "checkbox";
  label: string;
  placeholder?: string;
  required: boolean;
  validation_regex?: string;
  max_length?: number;
  options?: string[];
};

export default function PublicFormPage() {
  const params = useParams();
  // Extract slug from params or URL pathname (static export edge-rewrite compatibility, e.g. CloudFront Function)
  const getSlug = useCallback(() => {
    // First try to get from params
    const slugParam = params?.slug;
    const paramSlug = Array.isArray(slugParam)
      ? slugParam[0]
      : (slugParam as string);

    if (paramSlug && paramSlug !== "_" && paramSlug.trim() !== "") {
      return paramSlug;
    }

    // Fallback: extract from browser URL (works for static exports and direct navigation)
    if (typeof window !== "undefined") {
      const pathMatch = window.location.pathname.match(
        /\/v1\/forms\/([^/?#]+)/,
      );
      if (
        pathMatch &&
        pathMatch[1] &&
        pathMatch[1] !== "_" &&
        pathMatch[1].trim() !== ""
      ) {
        return pathMatch[1];
      }
      // Also check hash in case of SPA routing
      const hashMatch = window.location.hash.match(/\/v1\/forms\/([^/?#]+)/);
      if (
        hashMatch &&
        hashMatch[1] &&
        hashMatch[1] !== "_" &&
        hashMatch[1].trim() !== ""
      ) {
        return hashMatch[1];
      }
    }

    return paramSlug || "";
  }, [params?.slug]);

  const [slug, setSlug] = useState<string>(getSlug());

  // Update slug when params change (for client-side navigation)
  useEffect(() => {
    const newSlug = getSlug();
    if (
      newSlug &&
      newSlug !== slug &&
      newSlug.trim() !== "" &&
      newSlug !== "_"
    ) {
      setSlug(newSlug);
    }
  }, [getSlug, slug]);

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  // Polling cancellation + safety against setting state after unmount/navigation
  const pollSessionRef = useRef(0);
  const pollTimeoutRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    pollSessionRef.current += 1;
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const loadForm = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setForm(null);
      setLogoError(false);

      const apiUrl = `${API_URL}/v1/forms/${slug}`;
      const response = await axios.get(apiUrl);
      setForm(response.data);

      // Initialize form data with empty values
      const initialData: Record<string, any> = {};
      response.data.form_fields_schema?.fields?.forEach((field: FormField) => {
        if (field.field_type === "checkbox") {
          initialData[field.field_id] = false;
        } else if (field.field_type === "select") {
          initialData[field.field_id] = "";
        } else {
          initialData[field.field_id] = "";
        }
      });
      setFormData(initialData);
    } catch (error) {
      logger.debug("Failed to load public form", {
        context: "PublicForm",
        error,
      });
      // Handle errors gracefully
      const errorMessage =
        error instanceof Error
          ? error.message
          : error &&
              typeof error === "object" &&
              "response" in error &&
              error.response &&
              typeof error.response === "object" &&
              "data" in error.response &&
              error.response.data &&
              typeof error.response.data === "object" &&
              "message" in error.response.data &&
              typeof error.response.data.message === "string"
            ? error.response.data.message
            : "Form not found";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    // When the slug changes, reset any in-flight generation/polling state.
    stopPolling();
    setSuccess(false);
    setSubmitting(false);
    setGenerating(false);
    setJobId(null);
    setJobStatus(null);
    setOutputUrl(null);

    if (slug && slug.trim() !== "" && slug !== "_") {
      loadForm();
    } else {
      setForm(null);
      setError("Invalid form URL. Please check the form link.");
      setLoading(false);
    }
  }, [slug, loadForm, stopPolling]);

  const startPollingJobStatus = useCallback(
    (jobIdToPoll: string) => {
      if (!jobIdToPoll) return;

      // Reset session + clear any existing timers before starting a new poll loop.
      stopPolling();
      const session = pollSessionRef.current;

      let attempts = 0;
      const maxAttempts = 180; // ~3 minutes (1s intervals)

      const poll = async () => {
        if (pollSessionRef.current !== session) return;

        try {
          const response = await axios.get(
            `${API_URL}/v1/jobs/${jobIdToPoll}/status`,
          );

          if (pollSessionRef.current !== session) return;

          const status = response.data.status;
          setJobStatus(status);

          if (status === "completed") {
            setGenerating(false);
            return;
          }

          if (status === "failed") {
            setGenerating(false);
            setError(
              response.data.error_message || "Lead magnet generation failed",
            );
            return;
          }

          if (status === "pending" || status === "processing") {
            attempts += 1;
            if (attempts < maxAttempts) {
              pollTimeoutRef.current = window.setTimeout(poll, 1000);
            } else {
              setGenerating(false);
              setError(
                "Generation is taking longer than expected. Please check back later.",
              );
            }
            return;
          }

          // Unknown / unexpected status - keep polling a bit, then give up with a visible error.
          attempts += 1;
          if (attempts < maxAttempts) {
            pollTimeoutRef.current = window.setTimeout(poll, 2000);
          } else {
            setGenerating(false);
            setJobStatus("unknown");
            setError(
              "Unable to confirm generation status. Please check back later.",
            );
          }
        } catch (error) {
          if (pollSessionRef.current !== session) return;

          logger.debug("Could not poll public job status", {
            context: "PublicForm",
            error,
          });

          attempts += 1;
          if (attempts < maxAttempts) {
            pollTimeoutRef.current = window.setTimeout(poll, 2000);
          } else {
            setGenerating(false);
            setJobStatus("unknown");
            setError(
              "Unable to confirm generation status. Please check back later.",
            );
          }
        }
      };

      pollTimeoutRef.current = window.setTimeout(poll, 1000);
    },
    [stopPolling],
  );

  useEffect(() => {
    if (!jobId) return;
    startPollingJobStatus(jobId);
    return () => {
      stopPolling();
    };
  }, [jobId, startPollingJobStatus, stopPolling]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    stopPolling();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    setGenerating(false);
    setJobId(null);
    setJobStatus(null);
    setOutputUrl(null);

    try {
      const response = await axios.post(`${API_URL}/v1/forms/${slug}/submit`, {
        submission_data: formData,
      });

      setSuccess(true);

      // If we have a job_id, start polling for completion
      if (response.data.job_id) {
        setJobId(response.data.job_id);
        setGenerating(true);
        setJobStatus("pending");
      }

      // Show thank you message or redirect (but only if no job_id or after completion)
      if (response.data.redirect_url && !response.data.job_id) {
        setTimeout(() => {
          window.location.href = response.data.redirect_url;
        }, 2000);
      }
    } catch (error: any) {
      logger.debug("Failed to submit public form", {
        context: "PublicForm",
        error,
      });
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to submit form",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const renderField = (field: FormField) => {
    const value = formData[field.field_id] || "";

    switch (field.field_type) {
      case "textarea":
        return (
          <textarea
            id={field.field_id}
            value={value}
            onChange={(e) => handleChange(field.field_id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder={field.placeholder}
            required={field.required}
            maxLength={field.max_length}
            rows={4}
          />
        );

      case "select":
        return (
          <Select
            id={field.field_id}
            value={value}
            onChange={(nextValue) => handleChange(field.field_id, nextValue)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Select an option..."
          >
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        );

      case "checkbox":
        return (
          <div className="flex items-center">
            <Checkbox
              id={field.field_id}
              checked={value || false}
              onChange={(checked) => handleChange(field.field_id, checked)}
              className="border-gray-300"
              required={field.required}
            />
            <label
              htmlFor={field.field_id}
              className="ml-2 text-sm text-gray-700"
            >
              {field.label}
            </label>
          </div>
        );

      default:
        return (
          <input
            type={
              field.field_type === "email"
                ? "email"
                : field.field_type === "tel"
                  ? "tel"
                  : field.field_type === "number"
                    ? "number"
                    : "text"
            }
            id={field.field_id}
            value={value}
            onChange={(e) => handleChange(field.field_id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder={field.placeholder}
            required={field.required}
            maxLength={field.max_length}
            pattern={field.validation_regex}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-sm sm:text-base text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6">
        <div className="bg-white rounded-lg shadow p-6 sm:p-8 max-w-md w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
            Form Not Found
          </h1>
          <p className="text-sm sm:text-base text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    const isReady = Boolean(outputUrl) || jobStatus === "completed";
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6">
        <div className="bg-white rounded-lg shadow p-6 sm:p-8 max-w-md w-full text-center">
          {generating ? (
            <>
              <div className="mb-4">
                <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
                Generating Your Lead Magnet...
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 px-2">
                {form?.thank_you_message ||
                  "Your submission has been received. We&apos;re generating your personalized lead magnet now."}
              </p>
              {jobStatus && (
                <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                  Status:{" "}
                  {jobStatus === "pending"
                    ? "Queued"
                    : jobStatus === "processing"
                      ? "Processing"
                      : jobStatus}
                </p>
              )}
              <p className="text-xs text-gray-400 px-2">
                This may take a minute. Please don&apos;t close this page.
              </p>
            </>
          ) : isReady ? (
            <>
              <div className="mb-4">
                <svg
                  className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
                Your Lead Magnet is Ready!
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-2">
                {form?.thank_you_message ||
                  "Your personalized lead magnet has been generated successfully."}
              </p>
              <a
                href={
                  jobId
                    ? `${API_URL}/v1/jobs/${jobId}/document`
                    : outputUrl || "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full sm:w-auto px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm sm:text-base"
              >
                View Your Lead Magnet
              </a>
              {form?.redirect_url && (
                <div className="mt-4">
                  <a
                    href={form.redirect_url}
                    className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 break-all"
                  >
                    Continue to {form.redirect_url}
                  </a>
                </div>
              )}
            </>
          ) : error ? (
            <>
              <div className="mb-4">
                <svg
                  className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
                We couldn&apos;t generate your lead magnet
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-2">
                {error}
              </p>
              <button
                type="button"
                onClick={() => {
                  stopPolling();
                  setError(null);
                  setGenerating(false);
                  setJobId(null);
                  setJobStatus(null);
                  setOutputUrl(null);
                  setSuccess(false);
                }}
                className="inline-block w-full sm:w-auto px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm sm:text-base"
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <div className="mb-4">
                <svg
                  className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
                Thank You!
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 px-2">
                {form?.thank_you_message ||
                  "Your submission has been received and is being processed."}
              </p>
              {form?.redirect_url && (
                <p className="text-xs sm:text-sm text-gray-500">
                  Redirecting...
                </p>
              )}
            </>
          )}

          {form?.custom_css && (
            <style dangerouslySetInnerHTML={{ __html: form.custom_css }} />
          )}
        </div>
      </div>
    );
  }

  if (!form) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 lg:p-8">
          {/* Logo */}
          {form.logo_url && !logoError && (
            <div className="mb-4 sm:mb-6 text-center">
              <Image
                src={form.logo_url}
                alt="Logo"
                width={80}
                height={80}
                className="max-h-16 sm:max-h-20 mx-auto"
                onError={() => setLogoError(true)}
                unoptimized
              />
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
            {form.form_name}
          </h1>

          {error && (
            <div className="mb-4 sm:mb-6 bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {form.form_fields_schema?.fields?.map((field: FormField) => (
              <div key={field.field_id}>
                {field.field_type !== "checkbox" && (
                  <label
                    htmlFor={field.field_id}
                    className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2"
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                )}
                {renderField(field)}
                {field.field_type === "checkbox" && !field.required && (
                  <span className="text-xs text-gray-500 ml-6">Optional</span>
                )}
              </div>
            ))}

            <div className="pt-3 sm:pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm sm:text-base font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>

          {form.custom_css && (
            <style dangerouslySetInnerHTML={{ __html: form.custom_css }} />
          )}
        </div>
      </div>
    </div>
  );
}
