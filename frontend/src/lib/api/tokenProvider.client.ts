/**
 * Token provider implementation using localStorage
 * Implements the TokenProvider interface for API client
 */

import { TokenProvider } from "./base.client";

export class LocalStorageTokenProvider implements TokenProvider {
  getToken(): string | null {
    // First try custom storage keys
    let token =
      localStorage.getItem("access_token") || localStorage.getItem("id_token");
    if (token) return token;

    // Then try Cognito SDK storage format
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";
    if (!clientId) return null;

    const lastAuthUser = localStorage.getItem(
      `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`,
    );
    if (!lastAuthUser) return null;

    // Get access token or id token from Cognito storage
    token =
      localStorage.getItem(
        `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`,
      ) ||
      localStorage.getItem(
        `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`,
      );

    return token;
  }
}
