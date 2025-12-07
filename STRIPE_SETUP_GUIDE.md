# Stripe Setup Guide

Your Stripe API key appears to be expired. Here's how to complete the setup:

## Step 1: Get Valid API Key

1. Go to: https://dashboard.stripe.com/login
2. Navigate to: Developers → API keys
3. Copy your **Secret key** (starts with `sk_live_`)
4. If you see "Expired" next to the key, create a new one

## Step 2: Create Products in Stripe Dashboard

### Base Subscription Product
1. Go to: https://dashboard.stripe.com/products
2. Click "Add product"
3. Fill in:
   - **Name**: Lead Magnet AI Pro
   - **Description**: Professional plan with included usage allowance
   - **Pricing model**: Standard pricing
   - **Price**: $29.00 USD
   - **Billing period**: Monthly
   - **Payment type**: Recurring
4. Click "Save product"
5. **Copy the Price ID** (starts with `price_`) - you'll need this for STRIPE_PRICE_ID

### Metered Usage Product
1. Click "Add product" again
2. Fill in:
   - **Name**: Lead Magnet AI Usage
   - **Description**: Metered usage beyond included allowance
   - **Pricing model**: Standard pricing
   - **Price**: $0.01 USD
   - **Billing period**: Monthly
   - **Payment type**: Recurring
   - Click "Advanced options" → Set **Usage type** to "Metered"
3. Click "Save product"
4. **Copy the Price ID** (starts with `price_`) - you'll need this for STRIPE_METERED_PRICE_ID

## Step 3: Create Webhook

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Fill in:
   - **Endpoint URL**: `https://your-api-domain.execute-api.us-east-1.amazonaws.com/v1/stripe/webhook`
   - **Description**: Lead Magnet AI Webhook
4. Click "Select events"
5. Select these events:
   - ✓ checkout.session.completed
   - ✓ customer.subscription.updated
   - ✓ customer.subscription.deleted
   - ✓ invoice.paid
   - ✓ invoice.payment_failed
6. Click "Add endpoint"
7. **Copy the Signing secret** (starts with `whsec_`) - you'll need this for STRIPE_WEBHOOK_SECRET

## Step 4: Store API Key in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name leadmagnet/stripe-api-key \
  --secret-string "sk_live_YOUR_VALID_KEY_HERE" \
  --region us-east-1
```

Or if secret already exists:
```bash
aws secretsmanager update-secret \
  --secret-id leadmagnet/stripe-api-key \
  --secret-string "sk_live_YOUR_VALID_KEY_HERE" \
  --region us-east-1
```

## Step 5: Set Environment Variables

Update `.env.stripe` with your actual values:

```bash
export STRIPE_PRICE_ID="price_YOUR_BASE_SUBSCRIPTION_PRICE_ID"
export STRIPE_METERED_PRICE_ID="price_YOUR_METERED_PRICE_ID"
export STRIPE_WEBHOOK_SECRET="whsec_YOUR_WEBHOOK_SECRET"
export STRIPE_PORTAL_RETURN_URL="https://your-domain.com/dashboard/settings?tab=billing"
```

## Step 6: Deploy

Once you have valid values, run:

```bash
# Load environment variables
source .env.stripe

# Deploy infrastructure
cd infrastructure
cdk deploy leadmagnet-database
cdk deploy leadmagnet-auth
cdk deploy leadmagnet-api

# Deploy backend
cd ../backend/api
npm install
npm run build
# Deploy using your method (SAM, manual upload, etc.)

# Deploy frontend  
cd ../../frontend
npm install
npm run build
# Deploy using your method (Vercel, Amplify, etc.)
```

## Quick Setup Script

I've also created a helper script. Once you have valid credentials:

```bash
./scripts/deploy-with-stripe.sh
```
