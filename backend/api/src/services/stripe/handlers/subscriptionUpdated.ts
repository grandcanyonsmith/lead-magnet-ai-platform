import Stripe from 'stripe';
import { logger } from '../../../utils/logger';

export const handleSubscriptionUpdated = async (
  event: Stripe.Event,
  stripe: Stripe
): Promise<void> => {
  const subscription = event.data.object as Stripe.Subscription;
  logger.info('Handling customer.subscription.updated', { subscriptionId: subscription.id });
  // Add specific logic here
};
