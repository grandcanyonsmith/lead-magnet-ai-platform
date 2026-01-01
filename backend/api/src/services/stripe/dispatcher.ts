import Stripe from 'stripe';
import { handleCheckoutSessionCompleted } from './handlers/checkoutSessionCompleted';
import { handleSubscriptionUpdated } from './handlers/subscriptionUpdated';
import { handleInvoicePaid } from './handlers/invoicePaid';
import { logger } from '../../utils/logger';

type EventHandler = (event: Stripe.Event, stripe: Stripe) => Promise<void>;

export class StripeDispatcher {
  private handlers: Record<string, EventHandler> = {
    'checkout.session.completed': handleCheckoutSessionCompleted,
    'customer.subscription.updated': handleSubscriptionUpdated,
    'invoice.paid': handleInvoicePaid,
  };

  constructor(private stripe: Stripe) {}

  async dispatch(event: Stripe.Event): Promise<void> {
    const handler = this.handlers[event.type];
    if (handler) {
      await handler(event, this.stripe);
    } else {
      logger.debug(`No handler for Stripe event type: ${event.type}`);
    }
  }
}
