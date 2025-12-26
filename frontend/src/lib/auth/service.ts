/**
 * Authentication service
 * Handles sign in, sign out, and session management
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
} from "amazon-cognito-identity-js";
import { AuthResponse, AuthUser } from "@/types/auth";
import { LocalStorageTokenStorage } from "./storage";
import { logger } from "@/utils/logger";
import { isJwtExpired } from "@/utils/jwt";

// Initialize pool lazily to avoid build-time errors
let userPool: CognitoUserPool | null = null;
let clientId: string | null = null;

const getUserPool = (): CognitoUserPool => {
  if (!userPool) {
    const userPoolId = (
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || ""
    ).trim();
    const clientIdValue = (
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || ""
    ).trim();

    if (!userPoolId || !clientIdValue) {
      const errorMsg = `Cognito configuration missing. UserPoolId: ${userPoolId ? "set" : "missing"}, ClientId: ${clientIdValue ? "set" : "missing"}`;
      logger.error(errorMsg, {
        context: "AuthService",
        data: {
          NEXT_PUBLIC_COGNITO_USER_POOL_ID:
            process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
          NEXT_PUBLIC_COGNITO_CLIENT_ID:
            process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
        },
      });
      throw new Error(errorMsg);
    }

    // Validate UserPoolId format (should be like us-east-1_XXXXXXXXX)
    if (!/^[\w-]+_[a-zA-Z0-9]+$/.test(userPoolId)) {
      const errorMsg = `Invalid UserPoolId format: "${userPoolId}". Expected format: region_poolId (e.g., us-east-1_XXXXXXXXX)`;
      logger.error(errorMsg, { context: "AuthService" });
      throw new Error(errorMsg);
    }

    const poolData = {
      UserPoolId: userPoolId,
      ClientId: clientIdValue,
    };

    clientId = clientIdValue;
    userPool = new CognitoUserPool(poolData);
  }
  return userPool;
};

export class AuthService {
  private tokenStorage: LocalStorageTokenStorage;

  constructor(tokenStorage?: LocalStorageTokenStorage) {
    this.tokenStorage = tokenStorage || new LocalStorageTokenStorage();
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    if (this.isMockAuthEnabled()) {
      return this.mockSignIn(email, password);
    }

    return new Promise((resolve) => {
      try {
        const pool = getUserPool();

        const authenticationData = {
          Username: email,
          Password: password,
        };

        const authenticationDetails = new AuthenticationDetails(
          authenticationData,
        );

        const userData = {
          Username: email,
          Pool: pool,
        };

        const cognitoUser = new CognitoUser(userData);

        cognitoUser.authenticateUser(authenticationDetails, {
          onSuccess: (session) => {
            // Store tokens
            const accessToken = session.getAccessToken().getJwtToken();
            const idToken = session.getIdToken().getJwtToken();
            const refreshToken = session.getRefreshToken().getToken();

            this.tokenStorage.setTokens(accessToken, idToken, refreshToken);
            this.tokenStorage.setUsername(email);

            resolve({ success: true, session });
          },
          onFailure: (err) => {
            resolve({ success: false, error: err.message });
          },
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        resolve({ success: false, error: errorMessage });
      }
    });
  }

  private isMockAuthEnabled(): boolean {
    const mode = (process.env.NEXT_PUBLIC_AUTH_MODE || "").trim().toLowerCase();
    return process.env.NODE_ENV !== "production" && mode === "mock";
  }

  private base64UrlEncodeJson(value: unknown): string {
    const json = JSON.stringify(value);
    const bytes = new TextEncoder().encode(json);

    // Convert to binary string for btoa()
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);

    if (typeof btoa === "function") {
      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    }

    // Node fallback
    const NodeBuffer = (globalThis as unknown as { Buffer?: unknown })
      .Buffer as
      | { from(data: Uint8Array): { toString(enc: "base64"): string } }
      | undefined;
    if (NodeBuffer) {
      return NodeBuffer.from(bytes)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    }

    throw new Error("No base64 encoder available in this environment");
  }

  private createUnsignedJwt(payload: Record<string, unknown>): string {
    const header = { alg: "none", typ: "JWT" };
    return `${this.base64UrlEncodeJson(header)}.${this.base64UrlEncodeJson(payload)}.`;
  }

  private async mockSignIn(
    email: string,
    password: string,
  ): Promise<AuthResponse> {
    const expectedEmail = (
      process.env.NEXT_PUBLIC_MOCK_AUTH_EMAIL || "test@example.com"
    ).trim();
    const expectedPassword =
      process.env.NEXT_PUBLIC_MOCK_AUTH_PASSWORD || "TestPass123!";

    if (email !== expectedEmail || password !== expectedPassword) {
      return { success: false, error: "Invalid credentials" };
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60; // 1 hour

    const basePayload = {
      sub: "mock-user",
      email,
      name: "Test User",
      iat: now,
      exp,
      "cognito:username": email,
      "custom:role": "USER",
      "custom:customer_id": "cust_test",
    };

    const idToken = this.createUnsignedJwt({
      ...basePayload,
      token_use: "id",
    });

    const accessToken = this.createUnsignedJwt({
      ...basePayload,
      token_use: "access",
      scope: "aws.cognito.signin.user.admin",
    });

    const refreshToken = `mock-refresh-${now}`;

    this.tokenStorage.setTokens(accessToken, idToken, refreshToken);
    this.tokenStorage.setUsername(email);

    return { success: true };
  }

  async signUp(
    email: string,
    password: string,
    name: string,
  ): Promise<AuthResponse> {
    return new Promise((resolve) => {
      try {
        const pool = getUserPool();

        const attributeList = [
          new CognitoUserAttribute({
            Name: "email",
            Value: email,
          }),
          new CognitoUserAttribute({
            Name: "name",
            Value: name,
          }),
        ];

        pool.signUp(email, password, attributeList, [], (err, result) => {
          if (err) {
            logger.error("Signup error", {
              error: err,
              context: "AuthService",
            });
            let errorMessage = err.message || "Failed to sign up";
            const errorCode =
              (err as { code?: string; name?: string }).code ||
              (err as { code?: string; name?: string }).name;

            if (errorCode === "InvalidParameterException") {
              errorMessage =
                "Invalid signup parameters. Please check your email and password requirements.";
            } else if (errorCode === "UsernameExistsException") {
              errorMessage =
                "An account with this email already exists. Please sign in instead.";
            } else if (errorCode === "InvalidPasswordException") {
              errorMessage =
                "Password does not meet requirements. Must be at least 8 characters with uppercase, lowercase, and numbers.";
            }

            resolve({ success: false, error: errorMessage });
            return;
          }

          logger.info("Signup successful, user auto-confirmed", {
            context: "AuthService",
          });
          resolve({ success: true });
        });
      } catch (error: unknown) {
        logger.error("Signup exception", { error, context: "AuthService" });
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during signup";
        resolve({ success: false, error: errorMessage });
      }
    });
  }

  async forgotPassword(email: string): Promise<AuthResponse> {
    return new Promise((resolve) => {
      try {
        const pool = getUserPool();
        const cognitoUser = new CognitoUser({ Username: email, Pool: pool });

        cognitoUser.forgotPassword({
          onSuccess: () => resolve({ success: true }),
          onFailure: (err) => resolve({ success: false, error: err.message }),
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        resolve({ success: false, error: errorMessage });
      }
    });
  }

  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<AuthResponse> {
    return new Promise((resolve) => {
      try {
        const pool = getUserPool();
        const cognitoUser = new CognitoUser({ Username: email, Pool: pool });

        cognitoUser.confirmPassword(code, newPassword, {
          onSuccess: () => resolve({ success: true }),
          onFailure: (err) => resolve({ success: false, error: err.message }),
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        resolve({ success: false, error: errorMessage });
      }
    });
  }

  signOut(): void {
    try {
      const pool = getUserPool();
      const cognitoUser = pool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.signOut();
      }
    } catch (error) {
      logger.warn("Error signing out", { error, context: "AuthService" });
    }
    this.tokenStorage.clearTokens();
  }

  getCurrentUser(): CognitoUser | null {
    try {
      const pool = getUserPool();
      return pool.getCurrentUser();
    } catch (error) {
      return null;
    }
  }

  async getSession(): Promise<CognitoUserSession | null> {
    return new Promise((resolve) => {
      try {
        const pool = getUserPool();

        let cognitoUser = pool.getCurrentUser();

        if (!cognitoUser) {
          getUserPool();
          if (!clientId) {
            resolve(null);
            return;
          }
          const lastAuthUser = localStorage.getItem(
            `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`,
          );

          if (lastAuthUser) {
            cognitoUser = new CognitoUser({
              Username: lastAuthUser,
              Pool: pool,
            });
          } else {
            const username = this.tokenStorage.getUsername();
            if (username) {
              cognitoUser = new CognitoUser({
                Username: username,
                Pool: pool,
              });
            } else {
              resolve(null);
              return;
            }
          }
        }

        cognitoUser.getSession(
          (err: Error | null, session: CognitoUserSession | null) => {
            if (err || !session) {
              resolve(null);
              return;
            }

            resolve(session);
          },
        );
      } catch (error) {
        logger.error("Error in getSession", { error, context: "AuthService" });
        resolve(null);
      }
    });
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      // Prefer localStorage tokens (our app stores these on successful login).
      // This makes auth checks more resilient (and enables deterministic e2e mock auth).
      const storedIdToken = this.tokenStorage.getIdToken();
      if (storedIdToken && !isJwtExpired(storedIdToken, 30)) {
        return true;
      }

      getUserPool();
      if (!clientId) {
        return false;
      }

      const lastAuthUser = localStorage.getItem(
        `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`,
      );
      if (!lastAuthUser) {
        return false;
      }

      const idToken = localStorage.getItem(
        `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`,
      );
      const accessToken = localStorage.getItem(
        `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`,
      );

      if (!idToken || !accessToken) {
        return false;
      }

      try {
        const session = await this.getSession();
        if (!session) {
          logger.warn("No session found, clearing authentication", {
            context: "AuthService",
          });
          this.signOut();
          return false;
        }

        if (session.isValid()) {
          const idTokenObj = session.getIdToken();
          const exp = idTokenObj.getExpiration();
          const now = Math.floor(Date.now() / 1000);
          if (exp > now) {
            return true;
          }
          logger.warn("Token expired, clearing authentication", {
            context: "AuthService",
          });
          this.signOut();
          return false;
        }

        logger.warn("Session invalid, clearing authentication", {
          context: "AuthService",
        });
        this.signOut();
        return false;
      } catch (sessionError: unknown) {
        const errorMessage =
          sessionError instanceof Error
            ? sessionError.message
            : "Unknown error";
        logger.warn("Session check failed, token may be expired", {
          error: sessionError,
          context: "AuthService",
        });
        this.signOut();
        return false;
      }
    } catch (error) {
      logger.error("Error checking authentication", {
        error,
        context: "AuthService",
      });
      return false;
    }
  }

  async getIdToken(): Promise<string | null> {
    // Prefer tokens stored by our app (set during sign-in). This is more resilient than
    // relying on Cognito SDK session reconstruction, and supports mock/e2e auth flows.
    const stored = this.tokenStorage.getIdToken();
    if (stored) return stored;

    const session = await this.getSession();
    return session?.getIdToken().getJwtToken() ?? null;
  }

  getTokenStorage(): LocalStorageTokenStorage {
    return this.tokenStorage;
  }
}

// Export singleton instance
export const authService = new AuthService();
