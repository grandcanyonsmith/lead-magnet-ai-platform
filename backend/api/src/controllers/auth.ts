import { db } from "../utils/db";
import { RouteResponse } from "../routes";
import { RequestContext } from "../routes/router";
import { requireUser } from "../utils/rbac";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import { env } from "../utils/env";

const USERS_TABLE = env.usersTable;

/**
 * Auth Controller
 * Handles authentication-related endpoints
 */
class AuthController {
  /**
   * Get current user information
   * GET /me
   */
  async getMe(
    _params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const auth = requireUser(context);

    try {
      // Get real user
      const realUser = await db.get(USERS_TABLE, { user_id: auth.realUserId });
      if (!realUser) {
        throw new ApiError("User not found", 404);
      }

      // Get acting user (if impersonating)
      let actingUser = realUser;
      if (auth.isImpersonating && auth.actingUserId !== auth.realUserId) {
        const actingUserRecord = await db.get(USERS_TABLE, {
          user_id: auth.actingUserId,
        });
        if (actingUserRecord) {
          actingUser = actingUserRecord;
        }
      }

      return {
        statusCode: 200,
        body: {
          realUser: {
            user_id: realUser.user_id,
            email: realUser.email,
            name: realUser.name,
            customer_id: realUser.customer_id,
            profile_photo_url: realUser.profile_photo_url,
          },
          actingUser: {
            user_id: actingUser.user_id,
            email: actingUser.email,
            name: actingUser.name,
            customer_id: actingUser.customer_id,
            profile_photo_url: actingUser.profile_photo_url,
          },
          /**
           * Effective role for the current request.
           * This is the computed role that includes allowlist elevation.
           * Use this field as the single source of truth for authorization.
           */
          role: auth.role,
          customerId: auth.customerId,
          isImpersonating: auth.isImpersonating,
          viewMode: auth.viewMode,
          selectedCustomerId: auth.selectedCustomerId,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error("[Auth] Error getting user info", {
        error: error instanceof Error ? error.message : String(error),
        realUserId: auth.realUserId,
      });
      throw new ApiError("Failed to get user information", 500);
    }
  }

  /**
   * Update user profile
   * PATCH /me
   */
  async updateProfile(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const auth = requireUser(context);
    const userId = auth.actingUserId;

    if (auth.isImpersonating) {
      throw new ApiError("Cannot update profile while impersonating", 403);
    }

    try {
      const allowedUpdates: Record<string, any> = {};
      if (body.name !== undefined) allowedUpdates.name = body.name;
      if (body.profile_photo_url !== undefined)
        allowedUpdates.profile_photo_url = body.profile_photo_url;

      if (Object.keys(allowedUpdates).length === 0) {
        return {
          statusCode: 200,
          body: { message: "No changes requested" },
        };
      }

      allowedUpdates.updated_at = new Date().toISOString();

      const updatedUser = await db.update(
        USERS_TABLE,
        { user_id: userId },
        allowedUpdates,
      );

      return {
        statusCode: 200,
        body: {
          user: {
            user_id: updatedUser.user_id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            customer_id: updatedUser.customer_id,
            profile_photo_url: updatedUser.profile_photo_url,
          },
        },
      };
    } catch (error) {
      logger.error("[AuthController.updateProfile] Error updating profile", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw new ApiError("Failed to update profile", 500);
    }
  }

  /**
   * Get avatar upload URL
   * POST /me/avatar-upload-url
   */
  async getAvatarUploadUrl(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const auth = requireUser(context);
    const userId = auth.actingUserId;
    const customerId = auth.customerId;

    if (auth.isImpersonating) {
      throw new ApiError("Cannot upload avatar while impersonating", 403);
    }

    try {
      const contentType = body.contentType || "image/jpeg";
      const timestamp = Date.now();
      const ext = contentType.split("/")[1] || "jpg";
      const key = `customers/${customerId}/avatars/${userId}/${timestamp}.${ext}`;

      const bucket = env.artifactsBucket;
      if (!bucket) {
        throw new ApiError("Storage not configured", 500);
      }

      // Import s3Service dynamically to avoid circular dependencies if any,
      // though typically services are fine. Using dynamic import to be safe with existing imports.
      const { s3Service } = await import("../services/s3Service");

      const uploadUrl = await s3Service.getPresignedPutUrl(
        bucket,
        key,
        contentType,
      );

      // Construct public URL
      const cloudfrontDomain = env.cloudfrontDomain;
      // Determine bucket region - cc360-pages is in us-west-2
      const bucketRegion = bucket === "cc360-pages" ? "us-west-2" : env.awsRegion;
      const publicUrl = cloudfrontDomain
        ? `https://${cloudfrontDomain}/${key}`
        : `https://${bucket}.s3.${bucketRegion}.amazonaws.com/${key}`;

      return {
        statusCode: 200,
        body: {
          uploadUrl,
          publicUrl,
          key,
        },
      };
    } catch (error) {
      logger.error(
        "[AuthController.getAvatarUploadUrl] Error generating upload URL",
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
        },
      );
      throw new ApiError("Failed to generate upload URL", 500);
    }
  }
}

export const authController = new AuthController();
