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

const STRIPE_SECRET_NAME = env.stripeSecretName;
const secretsClient = new SecretsManagerClient({ region: env.awsRegion });

// Cache the Stripe client instance
let cachedClient: Stripe | null = null;
let cachedApiKey: string | null = null;

/**
 * Get Stripe client instance (singleton pattern with caching)
 * Retrieves API key from AWS Secrets Manager and caches both key and client
 */
async function getStripeClient(): Promise<Stripe> {
  // Return cached client if available
  if (cachedClient && cachedApiKey) {
    return cachedClient;
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: STRIPE_SECRET_NAME });
    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      throw new ApiError('Stripe API key not found in secret', 500);
    }

    let apiKey: string;
    
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
      apiVersion: '2024-11-20.acacia',
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
  private readonly USAGE_ALLOWANCE = 10.0; // $10 included usage per month (2x markup = $5 actual cost)

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

      if (!env.stripePriceId || !env.stripeMeteredPriceId) {
        throw new ApiError('Stripe price IDs not configured', 500);
      }

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        line_items: [
          {
            price: env.stripePriceId, // Base subscription price
            quantity: 1,
          },
          {
            price: env.stripeMeteredPriceId, // Metered usage price
          },
        ],
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
   * This is called when a customer exceeds their usage allowance
   */
  async reportUsage(
    customerId: string,
    costUsd: number,
    idempotencyKey: string
  ): Promise<void> {
    try {
      // Get customer record with Stripe info
      const customer = await db.get(this.CUSTOMERS_TABLE, { customer_id: customerId });
      
      if (!customer || !customer.stripe_customer_id) {
        logger.warn('[Stripe Service] Customer has no Stripe ID, skipping usage report', {
          customerId,
        });
        return;
      }

      // Get subscription
      const subscription = await this.getSubscription(customer.stripe_customer_id);
      
      if (!subscription || subscription.status !== 'active') {
        logger.warn('[Stripe Service] No active subscription, skipping usage report', {
          customerId,
          subscriptionStatus: subscription?.status,
        });
        return;
      }

      // Find the metered subscription item
      const meteredItem = subscription.items.find(
        (item: any) => item.type === 'metered'
      );

      if (!meteredItem) {
        logger.warn('[Stripe Service] No metered item found in subscription', {
          customerId,
          subscriptionId: subscription.id,
        });
        return;
      }

      // Get current period usage from database
      const currentPeriodUsage = customer.current_period_usage || 0;
      const newTotalUsage = currentPeriodUsage + costUsd;

      // Only report usage if we've exceeded the allowance
      if (newTotalUsage > this.USAGE_ALLOWANCE) {
        const overage = newTotalUsage - this.USAGE_ALLOWANCE;
        const previousOverage = Math.max(0, currentPeriodUsage - this.USAGE_ALLOWANCE);
        const incrementalOverage = overage - previousOverage;

        if (incrementalOverage > 0) {
          const stripe = await getStripeClient();

          // Report usage in cents (Stripe uses smallest currency unit)
          const quantityInCents = Math.ceil(incrementalOverage * 100);

          await stripe.subscriptionItems.createUsageRecord(
            meteredItem.id,
            {
              quantity: quantityInCents,
              timestamp: Math.floor(Date.now() / 1000),
              action: 'increment',
            },
            {
              idempotencyKey,
            }
          );

          logger.info('[Stripe Service] Reported usage overage', {
            customerId,
            subscriptionItemId: meteredItem.id,
            incrementalOverage,
            quantityInCents,
            newTotalUsage,
            idempotencyKey,
          });
        }
      }

      // Update current period usage in database
      await db.update(
        this.CUSTOMERS_TABLE,
        { customer_id: customerId },
        {
          current_period_usage: newTotalUsage,
          updated_at: new Date().toISOString(),
        }
      );
    } catch (error: any) {
      logger.error('[Stripe Service] Error reporting usage', {
        error: error.message,
        customerId,
        costUsd,
      });
      // Don't throw - we don't want to fail the request if usage reporting fails
    }
  }

  /**
   * Reset monthly usage counter (called from webhook on invoice.paid)
   */
  async resetMonthlyUsage(customerId: string): Promise<void> {
    try {
      await db.update(
        this.CUSTOMERS_TABLE,
        { customer_id: customerId },
        {
          current_period_usage: 0,
          updated_at: new Date().toISOString(),
        }
      );

      logger.info('[Stripe Service] Reset monthly usage', { customerId });
    } catch (error: any) {
      logger.error('[Stripe Service] Error resetting monthly usage', {
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
