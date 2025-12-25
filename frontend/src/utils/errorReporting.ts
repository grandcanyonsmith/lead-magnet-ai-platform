import type { ErrorInfo } from "react";

// Match BaseApiClient default so hosted builds work even if env vars are missing.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://czp5b77azd.execute-api.us-east-1.amazonaws.com";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  // Custom storage keys
  let token =
    localStorage.getItem("access_token") || localStorage.getItem("id_token");
  if (token) return token;

  // Cognito SDK storage format
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";
  if (!clientId) return null;

  const lastAuthUser = localStorage.getItem(
    `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`,
  );
  if (!lastAuthUser) return null;

  token =
    localStorage.getItem(
      `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`,
    ) ||
    localStorage.getItem(
      `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`,
    );

  return token;
}

function getOptionalHeader(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const value = localStorage.getItem(key);
  return value && value.trim().length > 0 ? value : undefined;
}

export function reportReactError(error: Error, errorInfo: ErrorInfo): void {
  // Only report in production to avoid noise.
  if (process.env.NODE_ENV !== "production") return;
  if (typeof window === "undefined") return;

  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const sessionId = getOptionalHeader("impersonation_session_id");
    if (sessionId) headers["X-Session-Id"] = sessionId;

    const viewMode = getOptionalHeader("agency_view_mode");
    if (viewMode) headers["X-View-Mode"] = viewMode;

    const selectedCustomerId = getOptionalHeader("agency_selected_customer_id");
    if (selectedCustomerId)
      headers["X-Selected-Customer-Id"] = selectedCustomerId;

    const payload = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      path: window.location.pathname,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      timestamp: new Date().toISOString(),
    };

    // Best-effort: don't block rendering / reload flows.
    void fetch(`${API_URL}/admin/client-errors`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Swallow to avoid recursive errors in the error boundary.
  }
}
