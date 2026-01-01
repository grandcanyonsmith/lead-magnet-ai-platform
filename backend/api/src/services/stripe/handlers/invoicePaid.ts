import Stripe from 'stripe';
import { logger } from '../../../utils/logger';

export const handleInvoicePaid = async (
  event: Stripe.Event,
  _stripe: Stripe
): Promise<void> => {
  const invoice = event.data.object as Stripe.Invoice;
  logger.info('Handling invoice.paid', { invoiceId: invoice.id });
  // Add specific logic here
};
