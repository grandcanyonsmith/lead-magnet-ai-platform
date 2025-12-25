/**
 * Billing API client
 * Handles Stripe billing and subscription management
 */

import { BaseApiClient, TokenProvider } from "./base.client";

export interface SubscriptionInfo {
  has_subscription: boolean;
  status: string;
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  usage?: {
    total_tokens: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_actual_cost: number;
    total_upcharge_cost: number;
    units_1k: number;
    unit: string;
    unit_scale: string;
  };
}

export interface CheckoutSessionResponse {
  checkout_url: string;
}

export interface PortalSessionResponse {
  portal_url: string;
}

export class BillingClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider);
  }

  /**
   * Get current subscription information
   */
  async getSubscription(): Promise<SubscriptionInfo> {
    const response = await this.get<SubscriptionInfo>(
      "/admin/billing/subscription",
    );
    return response;
  }

  /**
   * Create a Stripe Checkout session for subscription signup
   */
  async createCheckoutSession(
    successUrl?: string,
    cancelUrl?: string,
  ): Promise<CheckoutSessionResponse> {
    const response = await this.post<CheckoutSessionResponse>(
      "/admin/billing/checkout-session",
      {
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
    );
    return response;
  }

  /**
   * Create a Stripe customer portal session
   */
  async createPortalSession(
    returnUrl?: string,
  ): Promise<PortalSessionResponse> {
    const response = await this.post<PortalSessionResponse>(
      "/admin/billing/portal-session",
      {
        return_url: returnUrl,
      },
    );
    return response;
  }
}
