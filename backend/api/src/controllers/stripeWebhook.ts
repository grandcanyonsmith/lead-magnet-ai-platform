/**
 * Stripe Webhook Controller
 * Handles incoming webhook events from Stripe
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import Stripe from 'stripe';
import { RouteResponse } from '../routes';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { stripeService } from '../services/stripeService';
import { db } from '../utils/db';
import { env } from '../utils/env';

const CUSTOMERS_TABLE = env.customersTable;

class StripeWebhookController {
  /**
   * Handle incoming Stripe webhook events
   */
  async handleWebhook(event: APIGatewayProxyEventV2): Promise<RouteResponse> {
    try {
      const signature = event.headers['stripe-signature'];
      
      if (!signature) {
        throw new ApiError('Missing Stripe signature', 400);
      }

      // Verify webhook signature
      const stripeEvent = await stripeService.verifyWebhookSignature(
        event.body || '',
        signature
      );

      logger.info('[Stripe Webhook] Received event', {
        type: stripeEvent.type,
        id: stripeEvent.id,
      });

      // Route to appropriate handler based on event type
      switch (stripeEvent.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(stripeEvent);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(stripeEvent);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(stripeEvent);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(stripeEvent);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(stripeEvent);
          break;

        default:
          logger.info('[Stripe Webhook] Unhandled event type', {
            type: stripeEvent.type,
          });
      }

      return {
        statusCode: 200,
        body: { received: true },
      };
    } catch (error: any) {
      logger.error('[Stripe Webhook] Error processing webhook', {
        error: error.message,
        stack: error.stack,
      });

      // Return 400 for signature verification errors, 500 for others
      const statusCode = error instanceof ApiError ? error.statusCode : 500;
      
      return {
        statusCode,
        body: { error: error.message },
      };
    }
  }

  /**
   * Handle checkout.session.completed event
   * Activates subscription and updates customer record
   */
  private async handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;

    logger.info('[Stripe Webhook] Checkout completed', {
      sessionId: session.id,
      customerId: session.customer,
      subscriptionId: session.subscription,
    });

    if (!session.subscription || !session.customer) {
      logger.warn('[Stripe Webhook] Missing subscription or customer in checkout session');
      return;
    }

    // Get customer_id from subscription metadata
    const subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription.id;

    const stripeCustomerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer.id;

    // Find customer by stripe_customer_id
    const customers = await db.query(
      CUSTOMERS_TABLE,
      'gsi_stripe_customer_id',
      'stripe_customer_id = :stripe_customer_id',
      { ':stripe_customer_id': stripeCustomerId }
    );

    if (!customers.items || customers.items.length === 0) {
      logger.error('[Stripe Webhook] Customer not found for Stripe customer ID', {
        stripeCustomerId,
      });
      return;
    }

    const customer = customers.items[0];

    // Update subscription status
    await stripeService.updateSubscriptionStatus(
      customer.customer_id,
      subscriptionId,
      'active'
    );

    logger.info('[Stripe Webhook] Activated subscription', {
      customerId: customer.customer_id,
      subscriptionId,
    });
  }

  /**
   * Handle customer.subscription.updated event
   * Updates subscription status in database
   */
  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    logger.info('[Stripe Webhook] Subscription updated', {
      subscriptionId: subscription.id,
      status: subscription.status,
      customerId: subscription.customer,
    });

    const stripeCustomerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    // Find customer by stripe_customer_id
    const customers = await db.query(
      CUSTOMERS_TABLE,
      'gsi_stripe_customer_id',
      'stripe_customer_id = :stripe_customer_id',
      { ':stripe_customer_id': stripeCustomerId }
    );

    if (!customers.items || customers.items.length === 0) {
      logger.error('[Stripe Webhook] Customer not found for Stripe customer ID', {
        stripeCustomerId,
      });
      return;
    }

    const customer = customers.items[0];

    await stripeService.updateSubscriptionStatus(
      customer.customer_id,
      subscription.id,
      subscription.status
    );
  }

  /**
   * Handle customer.subscription.deleted event
   * Deactivates access when subscription is cancelled
   */
  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    logger.info('[Stripe Webhook] Subscription deleted', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
    });

    const stripeCustomerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    // Find customer by stripe_customer_id
    const customers = await db.query(
      CUSTOMERS_TABLE,
      'gsi_stripe_customer_id',
      'stripe_customer_id = :stripe_customer_id',
      { ':stripe_customer_id': stripeCustomerId }
    );

    if (!customers.items || customers.items.length === 0) {
      logger.error('[Stripe Webhook] Customer not found for Stripe customer ID', {
        stripeCustomerId,
      });
      return;
    }

    const customer = customers.items[0];

    await stripeService.updateSubscriptionStatus(
      customer.customer_id,
      subscription.id,
      'canceled'
    );
  }

  /**
   * Handle invoice.paid event
   * Resets monthly usage counter when invoice is paid
   */
  private async handleInvoicePaid(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    logger.info('[Stripe Webhook] Invoice paid', {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount: invoice.amount_paid,
    });

    const stripeCustomerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

    if (!stripeCustomerId) {
      logger.warn('[Stripe Webhook] No customer ID in invoice');
      return;
    }

    // Find customer by stripe_customer_id
    const customers = await db.query(
      CUSTOMERS_TABLE,
      'gsi_stripe_customer_id',
      'stripe_customer_id = :stripe_customer_id',
      { ':stripe_customer_id': stripeCustomerId }
    );

    if (!customers.items || customers.items.length === 0) {
      logger.error('[Stripe Webhook] Customer not found for Stripe customer ID', {
        stripeCustomerId,
      });
      return;
    }

    const customer = customers.items[0];

    // Reset monthly usage counter at the start of new billing period
    await stripeService.resetMonthlyUsage(customer.customer_id);
  }

  /**
   * Handle invoice.payment_failed event
   * Marks subscription as past_due
   */
  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    logger.warn('[Stripe Webhook] Invoice payment failed', {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount: invoice.amount_due,
    });

    const stripeCustomerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

    if (!stripeCustomerId) {
      logger.warn('[Stripe Webhook] No customer ID in invoice');
      return;
    }

    // Find customer by stripe_customer_id
    const customers = await db.query(
      CUSTOMERS_TABLE,
      'gsi_stripe_customer_id',
      'stripe_customer_id = :stripe_customer_id',
      { ':stripe_customer_id': stripeCustomerId }
    );

    if (!customers.items || customers.items.length === 0) {
      logger.error('[Stripe Webhook] Customer not found for Stripe customer ID', {
        stripeCustomerId,
      });
      return;
    }

    const customer = customers.items[0];

    // Get subscription ID from invoice
    const subscriptionId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

    if (subscriptionId) {
      await stripeService.updateSubscriptionStatus(
        customer.customer_id,
        subscriptionId,
        'past_due'
      );
    }
  }
}

export const stripeWebhookController = new StripeWebhookController();
