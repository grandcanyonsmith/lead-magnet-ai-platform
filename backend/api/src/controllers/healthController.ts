/**
 * Health check controller
 * Provides detailed system health and diagnostics
 */

import { RouteResponse } from "../routes";
import { RequestContext } from "../routes/router";
import { db } from "../utils/db";
import { env } from "../utils/env";
import { logger } from "../utils/logger";
import { getCustomerId } from "../utils/rbac";

class HealthController {
  /**
   * Basic health check endpoint
   */
  async basic(
    _params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    _context?: RequestContext,
  ): Promise<RouteResponse> {
    return {
      statusCode: 200,
      body: {
        status: "healthy",
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Detailed health check with diagnostics
   */
  async detailed(
    _params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const diagnostics: {
      status: string;
      services: Record<string, string>;
      configuration: Record<string, any>;
      warnings: string[];
      errors: string[];
    } = {
      status: "healthy",
      services: {},
      configuration: {},
      warnings: [],
      errors: [],
    };

    try {
      // Check DynamoDB connectivity
      try {
        // Try a simple read operation
        if (context?.auth) {
          const customerId = getCustomerId(context);
          await db.get(env.userSettingsTable, { tenant_id: customerId });
          diagnostics.services.dynamodb = "connected";
        } else {
          diagnostics.services.dynamodb = "not_authenticated";
        }
      } catch (error) {
        diagnostics.services.dynamodb = "error";
        diagnostics.errors.push(
          `DynamoDB error: ${error instanceof Error ? error.message : String(error)}`,
        );
        diagnostics.status = "degraded";
      }

      // Check S3 configuration
      if (env.artifactsBucket) {
        diagnostics.services.s3 = "configured";
        diagnostics.configuration.artifacts_bucket = env.artifactsBucket;
      } else {
        diagnostics.services.s3 = "not_configured";
        diagnostics.warnings.push("S3 artifacts bucket not configured");
      }

      // Check CloudFront configuration
      if (env.cloudfrontDomain) {
        diagnostics.services.cloudfront = "configured";
        diagnostics.configuration.cloudfront_domain = env.cloudfrontDomain;
      } else {
        diagnostics.services.cloudfront = "not_configured";
        diagnostics.warnings.push("CloudFront domain not configured");
      }

      // Check Cloudflare connection (if authenticated)
      if (context?.auth) {
        try {
          const customerId = getCustomerId(context);
          const settings = await db.get(env.userSettingsTable, { tenant_id: customerId });
          if (settings?.cloudflare_api_token) {
            diagnostics.services.cloudflare = "connected";
            diagnostics.configuration.cloudflare_connected_at =
              settings.cloudflare_connected_at || null;
          } else {
            diagnostics.services.cloudflare = "not_connected";
          }
          diagnostics.configuration.custom_domain = settings?.custom_domain || null;
        } catch (error) {
          diagnostics.services.cloudflare = "error";
          diagnostics.warnings.push(
            `Cloudflare check error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        diagnostics.services.cloudflare = "not_authenticated";
      }

      // Check Step Functions configuration
      if (env.stepFunctionsArn) {
        diagnostics.services.step_functions = "configured";
        diagnostics.configuration.step_functions_arn = env.stepFunctionsArn;
      } else {
        diagnostics.services.step_functions = "not_configured";
        diagnostics.warnings.push("Step Functions ARN not configured");
      }

      // Environment info
      diagnostics.configuration.aws_region = env.awsRegion;
      diagnostics.configuration.node_env = process.env.NODE_ENV || "development";
      diagnostics.configuration.is_local = process.env.IS_LOCAL === "true";

      // Determine overall status
      if (diagnostics.errors.length > 0) {
        diagnostics.status = "unhealthy";
      } else if (diagnostics.warnings.length > 0) {
        diagnostics.status = "degraded";
      }

      return {
        statusCode: diagnostics.status === "unhealthy" ? 503 : 200,
        body: diagnostics,
      };
    } catch (error) {
      logger.error("[HealthController] Error in health check", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        statusCode: 500,
        body: {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export const healthController = new HealthController();
