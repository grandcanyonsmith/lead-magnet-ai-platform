/**
 * Token provider implementation using localStorage
 * Implements the TokenProvider interface for API client
 */

import { TokenProvider } from "./base.client";

export class LocalStorageTokenProvider implements TokenProvider {
  getToken(): string | null {
    // First try custom storage keys
    // Prioritize id_token as it contains custom attributes (role, customer_id) required by the backend
    let token =
      localStorage.getItem("id_token") || localStorage.getItem("access_token");
    if (token) return token;

    // Then try Cognito SDK storage format
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";
    if (!clientId) return null;

    const lastAuthUser = localStorage.getItem(
      `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`,
    );
    if (!lastAuthUser) return null;

    // Get id token or access token from Cognito storage
    token =
      localStorage.getItem(
        `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`,
      ) ||
      localStorage.getItem(
        `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`,
      );

    return token;
  }
}
