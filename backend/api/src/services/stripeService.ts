/**
 * Stripe Service
 * Singleton service for managing Stripe client and billing operations
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import Stripe from 'stripe';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../utils/env';
import { db } from '../utils/db';

interface ReportUsageParams {
  customerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  usageId: string;
  timestamp?: number;
}

const STRIPE_SECRET_NAME = env.stripeSecretName;
const secretsClient = new SecretsManagerClient({ region: env.awsRegion });

// Cache the Stripe client instance
let cachedClient: Stripe | null = null;
let cachedApiKey: string | null = null;

/**
 * Get Stripe client instance (singleton pattern with caching)
 * Retrieves API key from environment variable (local dev) or AWS Secrets Manager (production)
 */
async function getStripeClient(): Promise<Stripe> {
  // Return cached client if available
  if (cachedClient && cachedApiKey) {
    return cachedClient;
  }

  try {
    let apiKey: string | undefined;
    
    // For local development, check for direct environment variable first
    if (env.isLocal || process.env.STRIPE_SECRET_KEY) {
      apiKey = process.env.STRIPE_SECRET_KEY;
      if (apiKey && apiKey.trim().length > 0) {
        logger.info('[Stripe Service] Using Stripe API key from environment variable (local dev)');
        cachedApiKey = apiKey;
        cachedClient = new Stripe(apiKey, {
          apiVersion: '2023-10-16',
          typescript: true,
        });
        logger.info('[Stripe Service] Client initialized and cached');
        return cachedClient;
      }
    }
    
    // Otherwise, get from AWS Secrets Manager
    const command = new GetSecretValueCommand({ SecretId: STRIPE_SECRET_NAME });
    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      throw new ApiError('Stripe API key not found in secret', 500);
    }
    
    // Try to parse as JSON first (if secret is stored as {"STRIPE_SECRET_KEY": "..."})
    try {
      const parsed = JSON.parse(response.SecretString);
      apiKey = parsed.STRIPE_SECRET_KEY || parsed.secretKey || parsed.secret_key || parsed.apiKey || response.SecretString;
    } catch {
      // If not JSON, use the secret string directly
      apiKey = response.SecretString;
    }
    
    if (!apiKey || apiKey.trim().length === 0) {
      throw new ApiError('Stripe API key is empty', 500);
    }

    // Cache the API key and create client
    cachedApiKey = apiKey;
    cachedClient = new Stripe(apiKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
    
    logger.info('[Stripe Service] Client initialized and cached');
    
    return cachedClient;
  } catch (error: any) {
    logger.error('[Stripe Service] Error getting Stripe client', { 
      error: error.message,
      secretName: STRIPE_SECRET_NAME 
    });
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(`Failed to initialize Stripe client: ${error.message}`, 500);
  }
}

/**
 * Clear cached Stripe client (useful for testing or key rotation)
 */
export function clearStripeClientCache(): void {
  cachedClient = null;
  cachedApiKey = null;
  logger.info('[Stripe Service] Cache cleared');
}

/**
 * Stripe Service
 * Handles all Stripe billing operations
 */
export class StripeService {
  private readonly CUSTOMERS_TABLE = env.customersTable;

  private getMeteredPriceIds(): string[] {
    const ids = new Set<string>();
    Object.values(env.stripeMeteredPriceMap || {}).forEach((id) => {
      if (id) ids.add(id);
    });
    if (env.stripeMeteredPriceId) {
      ids.add(env.stripeMeteredPriceId);
    }
    return Array.from(ids);
  }

  private normalizeModelName(model: string): string {
    // Normalize model names to match price map keys
    // Handle variants like "gpt-5-2025-08-07" -> "gpt-5", "gpt-4o-2024-08-06" -> "gpt-4o"
    const normalized = model.toLowerCase().trim();
    
    // Map known variants to base model names
    if (normalized.startsWith('gpt-5')) return 'gpt-5';
    if (normalized.startsWith('gpt-4.1')) return 'gpt-4.1';
    if (normalized.startsWith('gpt-4o-mini')) return 'gpt-4o-mini';
    if (normalized.startsWith('gpt-4o')) return 'gpt-4o';
    if (normalized.startsWith('gpt-4-turbo')) return 'gpt-4-turbo';
    if (normalized.startsWith('gpt-3.5-turbo')) return 'gpt-3.5-turbo';
    if (normalized.startsWith('computer-use-preview')) return 'computer-use-preview';
    if (normalized.includes('o4-mini-deep-research') || normalized.includes('o4-mini-deep')) return 'o4-mini-deep-research';
    if (normalized.includes('o3-deep-research') || normalized.includes('o3-deep')) return 'o4-mini-deep-research'; // Map o3 to o4-mini price
    
    // Return as-is if no variant detected
    return normalized;
  }

  private getMeteredPriceIdForModel(model: string): string | undefined {
    const normalizedModel = this.normalizeModelName(model);
    
    logger.info('[Stripe Service] Getting price ID for model', {
      originalModel: model,
      normalizedModel,
      priceMapKeys: Object.keys(env.stripeMeteredPriceMap || {}),
    });
    
    if (env.stripeMeteredPriceMap && env.stripeMeteredPriceMap[normalizedModel]) {
      return env.stripeMeteredPriceMap[normalizedModel];
    }
    
    logger.warn('[Stripe Service] Model not found in price map, using fallback', {
      model,
      normalizedModel,
      fallbackPriceId: env.stripeMeteredPriceId,
    });
    
    return env.stripeMeteredPriceId;
  }

  private findMeteredSubscriptionItem(
    items: Array<{ id: string; price_id: string; type?: string; price?: { id: string } }>,
    model: string
  ): { id: string; price_id: string; type?: string; price?: { id: string } } | undefined {
    const targetPriceId = this.getMeteredPriceIdForModel(model);
    
    logger.info('[Stripe Service] Finding metered item', {
      model,
      targetPriceId,
      availableItems: items.map((item) => ({
        id: item.id,
        priceId: item.price_id || item.price?.id,
        type: item.type,
      })),
      priceMap: env.stripeMeteredPriceMap,
    });

    if (targetPriceId) {
      // Try both price_id (from getSubscription) and price.id (direct Stripe object)
      const byPrice = items.find(
        (item) => (item.price_id || item.price?.id) === targetPriceId
      );
      if (byPrice) {
        logger.info('[Stripe Service] Found item by price ID', {
          model,
          targetPriceId,
          itemId: byPrice.id,
        });
        return byPrice;
      }
    }
    
    // Fallback: first metered item
    const meteredItem = items.find((item) => item.type === 'metered');
    if (meteredItem) {
      logger.info('[Stripe Service] Using first metered item as fallback', {
        model,
        itemId: meteredItem.id,
        priceId: meteredItem.price_id || meteredItem.price?.id,
      });
      return meteredItem;
    }
    
    // Last resort: any item
    if (items.length > 0) {
      logger.warn('[Stripe Service] No metered item found, using first item', {
        model,
        itemId: items[0].id,
        priceId: items[0].price_id || items[0].price?.id,
      });
      return items[0];
    }
    
    return undefined;
  }

  /**
   * Create a Stripe customer for a new user
   */
  async createCustomer(email: string, name: string, customerId: string): Promise<string> {
    try {
      const stripe = await getStripeClient();
      
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          customer_id: customerId,
        },
      });

      logger.info('[Stripe Service] Created Stripe customer', {
        stripeCustomerId: customer.id,
        customerId,
        email,
      });

      return customer.id;
    } catch (error: any) {
      logger.error('[Stripe Service] Error creating customer', {
        error: error.message,
        customerId,
        email,
      });
      throw new ApiError(`Failed to create Stripe customer: ${error.message}`, 500);
    }
  }

  /**
   * Create a Stripe Checkout session for subscription signup
   */
  async createCheckoutSession(
    customerId: string,
    stripeCustomerId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    try {
      const stripe = await getStripeClient();

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

      if (env.stripePriceId) {
        lineItems.push({
          price: env.stripePriceId,
          quantity: 1,
        });
      }

      const meteredPriceIds = this.getMeteredPriceIds();
      if (meteredPriceIds.length === 0) {
        throw new ApiError('Stripe metered price IDs not configured', 500);
      }

      meteredPriceIds.forEach((priceId) => {
        lineItems.push({ price: priceId });
      });

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            customer_id: customerId,
          },
        },
        allow_promotion_codes: true,
      });

      logger.info('[Stripe Service] Created checkout session', {
        sessionId: session.id,
        customerId,
        stripeCustomerId,
      });

      return session.url!;
    } catch (error: any) {
      logger.error('[Stripe Service] Error creating checkout session', {
        error: error.message,
        customerId,
        stripeCustomerId,
      });
      throw new ApiError(`Failed to create checkout session: ${error.message}`, 500);
    }
  }

  /**
   * Create a Stripe customer portal session
   */
  async createPortalSession(stripeCustomerId: string, returnUrl: string): Promise<string> {
    try {
      const stripe = await getStripeClient();

      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });

      logger.info('[Stripe Service] Created portal session', {
        sessionId: session.id,
        stripeCustomerId,
      });

      return session.url;
    } catch (error: any) {
      logger.error('[Stripe Service] Error creating portal session', {
        error: error.message,
        stripeCustomerId,
      });
      throw new ApiError(`Failed to create portal session: ${error.message}`, 500);
    }
  }

  /**
   * Get subscription information for a customer
   */
  async getSubscription(stripeCustomerId: string): Promise<any> {
    try {
      const stripe = await getStripeClient();

      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        limit: 1,
        status: 'all',
      });

      if (subscriptions.data.length === 0) {
        return null;
      }

      const subscription = subscriptions.data[0];

      return {
        id: subscription.id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        items: subscription.items.data.map((item) => ({
          id: item.id,
          price_id: item.price.id,
          type: item.price.recurring?.usage_type || 'licensed',
        })),
      };
    } catch (error: any) {
      logger.error('[Stripe Service] Error getting subscription', {
        error: error.message,
        stripeCustomerId,
      });
      throw new ApiError(`Failed to get subscription: ${error.message}`, 500);
    }
  }

  /**
   * Report usage to Stripe for metered billing
   */
  async reportUsage(params: ReportUsageParams): Promise<void> {
    const { customerId, model, inputTokens, outputTokens, costUsd, usageId, timestamp } = params;
    try {
      logger.info('[Stripe Service] reportUsage called', {
        customerId,
        model,
        inputTokens,
        outputTokens,
        costUsd,
        usageId,
      });

      const usageTokens = Math.max(0, (inputTokens || 0) + (outputTokens || 0));
      const usageUnits = Math.ceil(usageTokens / 1000);
      const reportedAt = timestamp || Math.floor(Date.now() / 1000);

      logger.info('[Stripe Service] Calculated usage', {
        customerId,
        usageTokens,
        usageUnits,
        reportedAt,
      });

      // Get customer record with Stripe info
      const customer = await db.get(this.CUSTOMERS_TABLE, { customer_id: customerId });
      
      if (!customer || !customer.stripe_customer_id) {
        logger.warn('[Stripe Service] Customer has no Stripe ID, skipping usage report', {
          customerId,
          hasCustomer: !!customer,
        });
        return;
      }

      logger.info('[Stripe Service] Found customer', {
        customerId,
        stripeCustomerId: customer.stripe_customer_id,
      });

      // Get subscription
      const subscription = await this.getSubscription(customer.stripe_customer_id);
      
      if (!subscription || subscription.status !== 'active') {
        logger.warn('[Stripe Service] No active subscription, skipping usage report', {
          customerId,
          subscriptionStatus: subscription?.status,
          hasSubscription: !!subscription,
        });
        return;
      }

      logger.info('[Stripe Service] Found subscription', {
        customerId,
        subscriptionId: subscription.id,
        status: subscription.status,
        itemCount: subscription.items?.length || 0,
        items: subscription.items?.map((item: any) => ({
          id: item.id,
          priceId: item.price?.id || item.price_id,
          type: item.type || item.price?.recurring?.usage_type,
        })),
      });

      // Find the metered subscription item
      const meteredItem = this.findMeteredSubscriptionItem(subscription.items, model);

      if (!meteredItem) {
        logger.warn('[Stripe Service] No metered item found in subscription', {
          customerId,
          subscriptionId: subscription.id,
          model,
          availableItems: subscription.items?.map((item: any) => ({
            id: item.id,
            priceId: item.price?.id || item.price_id,
            type: item.type || item.price?.recurring?.usage_type,
          })),
          priceMap: env.stripeMeteredPriceMap,
          fallbackPriceId: env.stripeMeteredPriceId,
        });
        return;
      }

      const subscriptionItemId = meteredItem.id;
      const priceId = meteredItem.price_id || meteredItem.price?.id;

      logger.info('[Stripe Service] Found metered item', {
        customerId,
        model,
        subscriptionItemId,
        priceId,
      });

      const stripe = await getStripeClient();

      const currentPeriodTokens = customer.current_period_tokens || 0;
      const currentPeriodCostUsd = customer.current_period_cost_usd || 0;
      const newTotalTokens = currentPeriodTokens + usageTokens;
      const newTotalCostUsd = currentPeriodCostUsd + (costUsd || 0);

      // Incremental usage record (idempotent per usageId)
      if (usageUnits > 0) {
        logger.info('[Stripe Service] Reporting incremental usage to Stripe', {
          customerId,
          model,
          subscriptionItemId,
          usageUnits,
          usageId,
        });

        const incrementResult = await stripe.subscriptionItems.createUsageRecord(
          subscriptionItemId,
          {
            quantity: usageUnits,
            timestamp: reportedAt,
            action: 'increment',
          },
          {
            idempotencyKey: `${usageId}:inc`,
          }
        );

        logger.info('[Stripe Service] Incremental usage reported successfully', {
          customerId,
          model,
          usageRecordId: incrementResult.id,
          quantity: incrementResult.quantity,
        });
      } else {
        logger.info('[Stripe Service] Skipping incremental usage (0 units)', {
          customerId,
          model,
          usageTokens,
        });
      }

      const totalUnits = Math.ceil(newTotalTokens / 1000);
      const today = new Date(reportedAt * 1000).toISOString().split('T')[0];
      const shouldSetTotal = customer.last_usage_set_date !== today;

      // Daily backfill to keep Stripe in sync with our running total
      if (shouldSetTotal) {
        logger.info('[Stripe Service] Setting daily total usage in Stripe', {
          customerId,
          model,
          subscriptionItemId,
          totalUnits,
          today,
          lastSetDate: customer.last_usage_set_date,
        });

        const setResult = await stripe.subscriptionItems.createUsageRecord(
          subscriptionItemId,
          {
            quantity: totalUnits,
            timestamp: reportedAt,
            action: 'set',
          },
          {
            idempotencyKey: `${customerId}:${today}:set`,
          }
        );

        logger.info('[Stripe Service] Daily total usage set successfully', {
          customerId,
          model,
          usageRecordId: setResult.id,
          quantity: setResult.quantity,
        });
      } else {
        logger.info('[Stripe Service] Skipping daily set (already set today)', {
          customerId,
          today,
          lastSetDate: customer.last_usage_set_date,
        });
      }

      await db.update(
        this.CUSTOMERS_TABLE,
        { customer_id: customerId },
        {
          current_period_usage: newTotalCostUsd * 2, // legacy field mapped to billable (2x) amount
          current_period_tokens: newTotalTokens,
          current_period_cost_usd: newTotalCostUsd,
          current_period_upcharge_usd: newTotalCostUsd * 2,
          last_usage_set_date: today,
          updated_at: new Date().toISOString(),
        }
      );

      logger.info('[Stripe Service] Usage reporting completed successfully', {
        customerId,
        model,
        newTotalTokens,
        newTotalCostUsd,
        newTotalUpchargeUsd: newTotalCostUsd * 2,
        today,
      });
    } catch (error: any) {
      logger.error('[Stripe Service] Error reporting usage', {
        error: error.message,
        stack: error.stack,
        customerId,
        model,
        inputTokens,
        outputTokens,
        costUsd,
        usageId,
      });
      // Don't throw - we don't want to fail the request if usage reporting fails
    }
  }

  /**
   * Reset period usage counters (called from webhook on invoice events)
   */
  async resetPeriodUsage(customerId: string, periodStart?: number): Promise<void> {
    try {
      const periodStartIso = periodStart ? new Date(periodStart * 1000).toISOString() : undefined;
      await db.update(
        this.CUSTOMERS_TABLE,
        { customer_id: customerId },
        {
          current_period_usage: 0, // legacy field; maintained for backward compatibility
          current_period_tokens: 0,
          current_period_cost_usd: 0,
          current_period_upcharge_usd: 0,
          last_usage_set_date: null,
          current_period_start_at: periodStartIso,
          updated_at: new Date().toISOString(),
        }
      );

      logger.info('[Stripe Service] Reset period usage', { customerId, periodStart: periodStartIso });
    } catch (error: any) {
      logger.error('[Stripe Service] Error resetting period usage', {
        error: error.message,
        customerId,
      });
    }
  }

  /**
   * Update subscription status in database
   */
  async updateSubscriptionStatus(
    customerId: string,
    subscriptionId: string,
    status: string
  ): Promise<void> {
    try {
      await db.update(
        this.CUSTOMERS_TABLE,
        { customer_id: customerId },
        {
          stripe_subscription_id: subscriptionId,
          subscription_status: status,
          updated_at: new Date().toISOString(),
        }
      );

      logger.info('[Stripe Service] Updated subscription status', {
        customerId,
        subscriptionId,
        status,
      });
    } catch (error: any) {
      logger.error('[Stripe Service] Error updating subscription status', {
        error: error.message,
        customerId,
        subscriptionId,
        status,
      });
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(
    payload: string,
    signature: string
  ): Promise<Stripe.Event> {
    try {
      const stripe = await getStripeClient();

      if (!env.stripeWebhookSecret) {
        throw new ApiError('Stripe webhook secret not configured', 500);
      }

      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        env.stripeWebhookSecret
      );

      return event;
    } catch (error: any) {
      logger.error('[Stripe Service] Webhook signature verification failed', {
        error: error.message,
      });
      throw new ApiError(`Webhook signature verification failed: ${error.message}`, 400);
    }
  }
}

// Export singleton instance
export const stripeService = new StripeService();
