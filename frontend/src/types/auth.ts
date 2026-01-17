/**
 * Authentication-related types
 */

import { CognitoUserSession } from "amazon-cognito-identity-js";

export interface AuthResponse {
  success: boolean;
  session?: CognitoUserSession;
  error?: string;
}

export interface AuthUser {
  user_id: string;
  email: string;
  name?: string;
  username?: string;
  role?: string;
  customer_id?: string;
  profile_photo_url?: string;
}

export interface AuthMeResponse {
  realUser: AuthUser;
  actingUser: AuthUser;
  role: string;
  customerId: string;
  isImpersonating: boolean;
  viewMode?: "agency" | "subaccount";
  selectedCustomerId?: string;
}

export interface TokenStorage {
  getAccessToken(): string | null;
  getIdToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(accessToken: string, idToken: string, refreshToken: string): void;
  clearTokens(): void;
  hasTokens(): boolean;
}
