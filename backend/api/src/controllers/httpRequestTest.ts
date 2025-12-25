import { z } from "zod";
import { RouteResponse } from "../routes";
import {
  ApiError,
  InternalServerError,
  ValidationError,
} from "../utils/errors";
import { logger } from "../utils/logger";
import { RequestContext } from "../routes/router";
import { getCustomerId } from "../utils/rbac";

const httpRequestTestSchema = z.object({
  url: z.string().url(),
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
    .optional()
    .default("POST"),
  headers: z.record(z.string()).optional().default({}),
  query_params: z.record(z.string()).optional().default({}),
  content_type: z.string().optional().default("application/json"),
  body: z.string().optional().default(""),
  test_values: z.record(z.any()).optional().default({}),
  timeout_ms: z.number().int().min(1000).max(60000).optional().default(15000),
});

function truncate(text: string, maxLen: number): string {
  if (!text) return text;
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "... (truncated)";
}

function getPath(obj: any, path: string): any {
  if (!path) return undefined;
  const parts = path
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  let cur: any = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(part);
      if (!Number.isFinite(idx)) return undefined;
      cur = cur[idx];
      continue;
    }
    if (typeof cur === "object") {
      cur = (cur as any)[part];
      continue;
    }
    return undefined;
  }
  return cur;
}

function renderTemplate(template: string, vars: Record<string, any>): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawKey) => {
    const key = String(rawKey || "").trim();
    if (!key) return "";
    const value = key.includes(".") ? getPath(vars, key) : (vars as any)[key];
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  });
}

class HttpRequestTestController {
  async test(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    try {
      const tenantId = getCustomerId(context);

      const parsed = httpRequestTestSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.message);
      }

      const {
        url,
        method,
        headers: inputHeaders,
        query_params,
        content_type,
        body: rawBody,
        test_values,
        timeout_ms,
      } = parsed.data;

      const urlObj = new URL(url);
      Object.entries(query_params || {}).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        urlObj.searchParams.set(k, String(v));
      });

      const resolvedUrl = urlObj.toString();

      // Build headers (preserve provided keys, but ensure content-type when a body is present)
      const headers: Record<string, string> = { ...(inputHeaders || {}) };
      const hasContentTypeHeader = Object.keys(headers).some(
        (k) => k.toLowerCase() === "content-type",
      );
      if (!hasContentTypeHeader && content_type) {
        headers["Content-Type"] = content_type;
      }

      const renderedBody = renderTemplate(rawBody || "", test_values || {});

      // Prepare fetch options
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout_ms);

      const start = Date.now();
      let response: Response;
      try {
        const fetchInit: RequestInit = {
          method,
          headers,
          signal: controller.signal,
        };

        const methodUpper = method.toUpperCase();
        const canHaveBody = !["GET", "HEAD"].includes(methodUpper);
        if (canHaveBody && renderedBody) {
          fetchInit.body = renderedBody;
        }

        response = await fetch(resolvedUrl, fetchInit);
      } finally {
        clearTimeout(timeoutId);
      }

      const durationMs = Date.now() - start;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseText = truncate(await response.text(), 20000);

      // If JSON, try to parse (for nicer UI)
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = null;
      }

      // Request body JSON (if applicable)
      let requestBodyJson: any = null;
      const requestContentType = (
        headers["Content-Type"] ||
        headers["content-type"] ||
        ""
      ).toLowerCase();
      if (renderedBody && requestContentType.includes("application/json")) {
        try {
          requestBodyJson = JSON.parse(renderedBody);
        } catch {
          requestBodyJson = null;
        }
      }

      logger.info("[HttpRequestTest] Completed", {
        tenantId,
        method,
        url: resolvedUrl,
        status: response.status,
        durationMs,
      });

      return {
        statusCode: 200,
        body: {
          ok: response.ok,
          duration_ms: durationMs,
          request: {
            method,
            url: resolvedUrl,
            headers,
            body: renderedBody,
            body_json: requestBodyJson,
          },
          response: {
            status: response.status,
            headers: responseHeaders,
            body: responseText,
            body_json: responseJson,
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error("[HttpRequestTest] Error", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new InternalServerError("Failed to test HTTP request", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const httpRequestTestController = new HttpRequestTestController();
