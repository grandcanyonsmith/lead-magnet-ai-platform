/**
 * API Error class for typed error handling
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static fromAxiosError(error: unknown): ApiError {
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as {
        response?: {
          status?: number;
          data?: unknown;
        };
        message?: string;
      };

      const statusCode = axiosError.response?.status;
      const errorData = axiosError.response?.data;

      let message = "An error occurred";
      let code: string | undefined;
      let details: Record<string, unknown> | undefined;

      if (typeof errorData === "string") {
        message = errorData;
      } else if (errorData && typeof errorData === "object") {
        if ("message" in errorData && typeof errorData.message === "string") {
          message = errorData.message;
        } else if (
          "error" in errorData &&
          typeof (errorData as any).error === "string"
        ) {
          // Backend often returns { error: "...", code: "..." }
          message = (errorData as any).error;
        }
        if ("code" in errorData && typeof errorData.code === "string") {
          code = errorData.code;
        }
        if ("details" in errorData && typeof errorData.details === "object") {
          details = errorData.details as Record<string, unknown>;
        }
      }

      return new ApiError(message, statusCode, code, details);
    }

    if (error instanceof Error) {
      return new ApiError(error.message);
    }

    return new ApiError("An unknown error occurred");
  }
}
