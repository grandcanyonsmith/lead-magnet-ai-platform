# Stripe Metered Billing Implementation Summary

## Overview

Successfully implemented Stripe metered billing with:
- Base subscription ($29/mo) with included usage allowance ($10)
- Metered overage charges at 2x OpenAI API cost
- Credit card collection via Stripe Checkout at signup
- Customer portal for subscription management

## What Was Implemented

### 1. Backend Services

#### Stripe Service (`backend/api/src/services/stripeService.ts`)
- `createCustomer()` - Create Stripe customer
- `createCheckoutSession()` - Generate Stripe Checkout URL
- `createPortalSession()` - Generate customer portal URL
- `getSubscription()` - Retrieve subscription info
- `reportUsage()` - Report metered usage with overage calculation
- `resetMonthlyUsage()` - Reset usage counter on new billing period
- `verifyWebhookSignature()` - Validate Stripe webhook events

#### Webhook Controller (`backend/api/src/controllers/stripeWebhook.ts`)
Handles Stripe webhook events:
- `checkout.session.completed` - Activate subscription
- `customer.subscription.updated` - Update subscription status
- `customer.subscription.deleted` - Mark as canceled
- `invoice.paid` - Reset monthly usage counter
- `invoice.payment_failed` - Mark as past_due

#### Billing Controller (`backend/api/src/controllers/billing.ts`)
New endpoints:
- `GET /admin/billing/subscription` - Get subscription status
- `POST /admin/billing/checkout-session` - Create checkout session
- `POST /admin/billing/portal-session` - Create portal session

#### Usage Tracking (`backend/api/src/services/usageTrackingService.ts`)
- Modified to automatically report usage to Stripe
- Applies 2x markup on OpenAI costs
- Uses usage_id as idempotency key to prevent duplicate charges

### 2. Frontend Components

#### Setup Billing Page (`frontend/src/app/setup-billing/page.tsx`)
- Displays plan details and pricing
- "Start Subscription" button redirects to Stripe Checkout
- Shows included usage and billing details

#### Billing Usage Component (`frontend/src/components/settings/BillingUsage.tsx`)
Enhanced with:
- Subscription status display (Active, Past Due, etc.)
- Usage vs. allowance progress bar
- "Manage Subscription" button to open Stripe Customer Portal
- Overage alerts
- Next billing date display

#### Billing API Client (`frontend/src/lib/api/billing.client.ts`)
- `getSubscription()` - Fetch subscription info
- `createCheckoutSession()` - Create checkout session
- `createPortalSession()` - Create portal session

### 3. Infrastructure Updates

#### Database Schema (`infrastructure/lib/database-stack.ts`)
- Added `gsi_stripe_customer_id` index to customers table
- Customers table now stores:
  - `stripe_customer_id`
  - `stripe_subscription_id`
  - `subscription_status`
  - `current_period_usage`

#### PostConfirmation Lambda (`infrastructure/lib/lambdas/postConfirmation.js`)
- Creates Stripe customer on user signup
- Stores Stripe customer ID in DynamoDB
- Uses native HTTPS to avoid bundling Stripe SDK

#### Auth Stack (`infrastructure/lib/auth-stack.ts`)
- Granted Lambda permission to access Stripe API key from Secrets Manager

#### API Stack (`infrastructure/lib/api-stack.ts`)
- Added Stripe secret access to Lambda role
- Added Stripe environment variables to Lambda function

#### Constants (`infrastructure/lib/config/constants.ts`)
- Added `SECRET_NAMES.STRIPE_API_KEY`
- Added Stripe-related `ENV_VAR_NAMES`

### 4. Routes

#### Public Routes (`backend/api/src/routes/publicRoutes.ts`)
- `POST /v1/stripe/webhook` - Stripe webhook endpoint (no auth)

#### Admin Routes (`backend/api/src/routes/adminRoutes.ts`)
- Added billing endpoints for checkout and portal

### 5. Package Dependencies

#### Backend (`backend/api/package.json`)
- Added `stripe: ^14.0.0`

#### Frontend (`frontend/package.json`)
- Added `@stripe/stripe-js: ^2.4.0`

## What You Need to Do Next

### 1. Stripe Dashboard Setup

1. **Create a Stripe Account** (if you haven't already)
   - Go to https://stripe.com and sign up

2. **Create Products and Prices**

   **Base Subscription:**
   - Product Name: "Lead Magnet AI Pro"
   - Price: $29/month (recurring)
   - Copy the Price ID (starts with `price_`)

   **Metered Usage:**
   - Product Name: "Lead Magnet AI Usage"
   - Price: $0.01 per unit (usage-based, metered)
   - Billing Scheme: "Per unit"
   - Usage Type: "Metered"
   - Copy the Price ID (starts with `price_`)

3. **Configure Customer Portal**
   - Go to Settings → Billing → Customer Portal
   - Enable customer portal
   - Configure what customers can do (cancel, update payment method, etc.)

4. **Set Up Webhook**
   - Go to Developers → Webhooks
   - Add endpoint: `https://your-api-domain.com/v1/stripe/webhook`
   - Select events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
   - Copy the webhook signing secret (starts with `whsec_`)

### 2. AWS Secrets Manager Setup

1. **Create Stripe API Key Secret**
   ```bash
   aws secretsmanager create-secret \
     --name leadmagnet/stripe-api-key \
     --secret-string "sk_test_YOUR_STRIPE_SECRET_KEY" \
     --region us-east-1
   ```

   Or store as JSON:
   ```bash
   aws secretsmanager create-secret \
     --name leadmagnet/stripe-api-key \
     --secret-string '{"STRIPE_SECRET_KEY":"sk_test_YOUR_KEY"}' \
     --region us-east-1
   ```

### 3. Environment Variables

Set these environment variables before deploying:

```bash
export STRIPE_PRICE_ID="price_YOUR_BASE_SUBSCRIPTION_PRICE_ID"
export STRIPE_METERED_PRICE_ID="price_YOUR_METERED_PRICE_ID"
export STRIPE_WEBHOOK_SECRET="whsec_YOUR_WEBHOOK_SECRET"
export STRIPE_PORTAL_RETURN_URL="https://your-domain.com/dashboard/settings?tab=billing"
```

Or add them to your CDK context:
```json
{
  "stripeConfig": {
    "priceId": "price_YOUR_BASE_SUBSCRIPTION_PRICE_ID",
    "meteredPriceId": "price_YOUR_METERED_PRICE_ID",
    "webhookSecret": "whsec_YOUR_WEBHOOK_SECRET",
    "portalReturnUrl": "https://your-domain.com/dashboard/settings?tab=billing"
  }
}
```

### 4. Deploy Infrastructure

```bash
cd infrastructure
npm install
cdk deploy leadmagnet-database  # Deploy database changes (GSI)
cdk deploy leadmagnet-auth      # Deploy postConfirmation Lambda changes
cdk deploy leadmagnet-api       # Deploy API changes
```

### 5. Deploy Backend

```bash
cd backend/api
npm install  # Install Stripe SDK
npm run build
# Deploy your Lambda function with updated code
```

### 6. Deploy Frontend

```bash
cd frontend
npm install  # Install @stripe/stripe-js
npm run build
# Deploy your frontend
```

### 7. Test the Integration

1. **Sign Up Flow:**
   - Create a new account
   - Verify Stripe customer is created (check DynamoDB customers table)
   - Should be redirected to `/setup-billing`

2. **Subscription Flow:**
   - Click "Start Subscription" on setup-billing page
   - Complete Stripe Checkout with test card: `4242 4242 4242 4242`
   - Verify subscription is activated (check Stripe Dashboard)
   - Check DynamoDB customers table for subscription_status = 'active'

3. **Usage Tracking:**
   - Generate a workflow or form
   - Check DynamoDB usage_records table
   - Verify usage is reported to Stripe (check Stripe Dashboard → Customers → Usage)

4. **Customer Portal:**
   - Go to Settings → Billing & Usage
   - Click "Manage Subscription"
   - Verify you can update payment method, cancel, etc.

5. **Webhook Testing:**
   - Use Stripe CLI to forward webhooks:
     ```bash
     stripe listen --forward-to https://your-api-domain.com/v1/stripe/webhook
     ```
   - Trigger test events:
     ```bash
     stripe trigger checkout.session.completed
     stripe trigger invoice.paid
     ```

## Important Notes

### Usage Allowance
- Currently set to $10 included usage per month (defined in `stripeService.ts`)
- This is equivalent to ~20,000 AI-generated words
- To change: Update `USAGE_ALLOWANCE` constant in `StripeService`

### Pricing Markup
- 2x markup applied on OpenAI costs
- If OpenAI charges $1, user is charged $2
- Configured in `usageTrackingService.ts`

### Test vs Production
- Use Stripe test mode for development
- Switch to live mode for production
- Update API keys in Secrets Manager accordingly

### Security
- Webhook signature verification is implemented
- All Stripe calls are authenticated with API key from Secrets Manager
- Customer portal uses secure redirects

## Troubleshooting

### Stripe Customer Not Created
- Check CloudWatch logs for postConfirmation Lambda
- Verify Stripe API key is in Secrets Manager
- Check Lambda has permission to access Secrets Manager

### Webhook Not Working
- Verify webhook endpoint is accessible (not behind authentication)
- Check webhook signing secret is correct
- Check CloudWatch logs for stripeWebhook controller
- Use Stripe Dashboard → Webhooks → Events to see delivery attempts

### Usage Not Reported
- Check CloudWatch logs for usageTrackingService
- Verify customer has active subscription
- Check Stripe Dashboard → Customers → [Customer] → Usage
- Verify metered price ID is correct

### Portal Session Not Created
- Verify customer has stripe_customer_id in DynamoDB
- Check Customer Portal is enabled in Stripe Dashboard
- Verify return URL is whitelisted in Stripe settings

## Architecture Diagram

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ 1. Sign Up
       ▼
┌─────────────────────┐
│ PostConfirmation    │──────► Stripe API
│ Lambda              │        (Create Customer)
└─────────┬───────────┘
          │
          │ 2. Store stripe_customer_id
          ▼
┌─────────────────────┐
│ DynamoDB            │
│ (customers table)   │
└─────────────────────┘
          │
          │ 3. Redirect to /setup-billing
          ▼
┌─────────────────────┐
│ Frontend            │──────► Stripe Checkout
│ (setup-billing)     │        (Collect Payment)
└─────────────────────┘
          │
          │ 4. Payment Complete
          ▼
┌─────────────────────┐
│ Stripe Webhook      │
│ (checkout.session.  │
│  completed)         │
└─────────┬───────────┘
          │
          │ 5. Activate Subscription
          ▼
┌─────────────────────┐
│ DynamoDB            │
│ (Update status)     │
└─────────────────────┘
          │
          │ 6. User generates workflow
          ▼
┌─────────────────────┐
│ Usage Tracking      │──────► Stripe API
│ Service             │        (Report Usage)
└─────────────────────┘
```

## Files Modified/Created

### Backend
- ✅ `backend/api/package.json` - Added Stripe dependency
- ✅ `backend/api/src/services/stripeService.ts` - Created
- ✅ `backend/api/src/controllers/stripeWebhook.ts` - Created
- ✅ `backend/api/src/controllers/billing.ts` - Expanded
- ✅ `backend/api/src/services/usageTrackingService.ts` - Modified
- ✅ `backend/api/src/routes/adminRoutes.ts` - Added routes
- ✅ `backend/api/src/routes/publicRoutes.ts` - Added webhook route
- ✅ `backend/api/src/utils/env.ts` - Added Stripe config

### Frontend
- ✅ `frontend/package.json` - Added Stripe dependency
- ✅ `frontend/src/lib/api/billing.client.ts` - Created
- ✅ `frontend/src/app/setup-billing/page.tsx` - Created
- ✅ `frontend/src/components/settings/BillingUsage.tsx` - Enhanced

### Infrastructure
- ✅ `infrastructure/lib/database-stack.ts` - Added GSI
- ✅ `infrastructure/lib/lambdas/postConfirmation.js` - Modified
- ✅ `infrastructure/lib/auth-stack.ts` - Added permissions
- ✅ `infrastructure/lib/api-stack.ts` - Added env vars & permissions
- ✅ `infrastructure/lib/config/constants.ts` - Added Stripe constants

## Support

For issues or questions:
1. Check CloudWatch logs for errors
2. Review Stripe Dashboard for webhook delivery and customer details
3. Verify environment variables are set correctly
4. Check Secrets Manager has correct API keys

---

**Implementation completed successfully!** 🎉
