/**
 * Base API client with common functionality
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { ApiError } from "./errors";
import { logger } from "@/utils/logger";

// Default to production API URL so hosted builds work even if env vars are missing.
// For local dev on localhost, fall back to the local API automatically to avoid accidentally
// calling production when NEXT_PUBLIC_API_URL isn't set.
const API_URL = (() => {
  const envUrl = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (envUrl) return envUrl;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      // Typical local setup: Next.js on :3000, API on :3001.
      const origin = window.location.origin || "http://localhost:3000";
      return origin.replace(/:\d+$/, ":3001");
    }
  }

  return "https://czp5b77azd.execute-api.us-east-1.amazonaws.com";
})();

export interface TokenProvider {
  getToken(): string | null;
}

export class BaseApiClient {
  protected client: AxiosInstance;
  protected tokenProvider: TokenProvider;

  constructor(tokenProvider: TokenProvider) {
    this.tokenProvider = tokenProvider;
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 300000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token, session ID, and view mode headers
    this.client.interceptors.request.use(
      (config) => {
        const token = this.tokenProvider.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add session ID if present (for impersonation)
        const sessionId = localStorage.getItem("impersonation_session_id");
        if (sessionId) {
          config.headers["X-Session-Id"] = sessionId;
        }

        // Add view mode headers if present (for agency view)
        const viewMode = localStorage.getItem("agency_view_mode");
        if (viewMode) {
          config.headers["X-View-Mode"] = viewMode;
        }

        const selectedCustomerId = localStorage.getItem(
          "agency_selected_customer_id",
        );
        if (selectedCustomerId) {
          config.headers["X-Selected-Customer-Id"] = selectedCustomerId;
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor - handle errors and auth
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          this.handleUnauthorized(error);
        }
        
        // Retry logic for network errors and 5xx errors
        const config = error.config;
        if (config && !config._retry) {
          const shouldRetry = this.shouldRetry(error);
          if (shouldRetry) {
            config._retry = true;
            config._retryCount = (config._retryCount || 0) + 1;
            const maxRetries = 3;
            const retryDelay = Math.min(
              1000 * Math.pow(2, config._retryCount - 1),
              10000
            );

            if (config._retryCount <= maxRetries) {
              logger.info("Retrying request", {
                context: "BaseApiClient",
                data: {
                  url: config.url,
                  retryCount: config._retryCount,
                  delay: retryDelay,
                },
              });

              await new Promise((resolve) => setTimeout(resolve, retryDelay));
              return this.client(config);
            }
          }
        }

        return Promise.reject(ApiError.fromAxiosError(error));
      },
    );
  }

  private handleUnauthorized(error: unknown): void {
    const errorData =
      error && typeof error === "object" && "response" in error
        ? (error as { response?: { data?: unknown } }).response?.data
        : null;

    const errorMessage =
      typeof errorData === "string"
        ? errorData
        : errorData
          ? JSON.stringify(errorData)
          : "Unauthorized";

    logger.warn("API returned 401 Unauthorized", {
      context: "BaseApiClient",
      data: {
        message: errorMessage,
        hasToken: !!this.tokenProvider.getToken(),
      },
    });

    // Check if this is an API Gateway rejection
    const isApiGatewayRejection =
      !errorData ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("unauthorized") ||
      errorMessage.includes("Invalid UserPoolId");

    if (isApiGatewayRejection) {
      logger.warn(
        "Authentication failed (token expired or invalid), clearing tokens and redirecting to login",
        {
          context: "BaseApiClient",
        },
      );
      this.clearAuthTokens();

      // Only redirect if we're not already on login page
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.includes("/auth/login")
      ) {
        window.location.href = "/auth/login";
      }
    }
  }

  private shouldRetry(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    // Don't retry if request was cancelled
    if (axios.isCancel(error)) {
      return false;
    }

    // Retry on network errors
    if (!("response" in error)) {
      return true;
    }

    const axiosError = error as { response?: { status?: number } };
    const status = axiosError.response?.status;

    // Retry on 5xx errors and 429 (rate limit)
    if (status && (status >= 500 || status === 429)) {
      return true;
    }

    // Don't retry on 4xx errors (except 429)
    return false;
  }

  private clearAuthTokens(): void {
    // Clear custom tokens
    localStorage.removeItem("access_token");
    localStorage.removeItem("id_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("cognito_username");

    // Clear Cognito SDK tokens
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";
    if (clientId) {
      const lastAuthUser = localStorage.getItem(
        `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`,
      );
      if (lastAuthUser) {
        localStorage.removeItem(
          `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`,
        );
        localStorage.removeItem(
          `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`,
        );
        localStorage.removeItem(
          `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`,
        );
        localStorage.removeItem(
          `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.refreshToken`,
        );
      }
    }
  }

  protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  protected async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(
      url,
      data,
      config,
    );
    return response.data;
  }

  protected async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  protected async delete<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}
