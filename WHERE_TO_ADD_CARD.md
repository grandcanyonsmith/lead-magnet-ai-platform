# Where to Add a Card - Visual Guide

## Location: Settings → Billing & Usage Tab

The subscription status section should appear **at the very top** of the Billing & Usage page, right below the "Billing & Usage" heading.

## What You Should See:

### If You Have NO Subscription:
```
┌─────────────────────────────────────────────────────────┐
│ Billing & Usage                                         │
│ Track your subscription and API usage                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⚠️  No active subscription                              │
│     Start a subscription to use Lead Magnet AI's      │
│     features                                            │
│                                                         │
│     [Start Subscription] ← CLICK HERE TO ADD CARD    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### If You HAVE a Subscription:
```
┌─────────────────────────────────────────────────────────┐
│ Billing & Usage                    [💳 Manage Subscription →] │
│ Track your subscription and API usage                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 💳 Subscription Status              [Active]            │
│                                                         │
│ Current Period Usage: $5.00 / $10.00                   │
│ [████████░░░░░░░░░░░░] 50%                              │
│                                                         │
│ Current period ends: 1/7/2026                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Steps to Add a Card:

### Option 1: Start Subscription (No Subscription Yet)
1. Go to: **Settings → Billing & Usage** tab
2. Look for yellow warning box at the top
3. Click **"Start Subscription"** button
4. You'll be redirected to `/setup-billing` page
5. Click **"Start Subscription"** button on that page
6. Stripe Checkout opens → **Enter your card here**
7. Card is saved automatically

### Option 2: Manage Subscription (Has Subscription)
1. Go to: **Settings → Billing & Usage** tab  
2. Look for **"Manage Subscription"** button (top right, blue button)
3. Click **"Manage Subscription"**
4. Stripe Customer Portal opens
5. Click **"Add payment method"** or **"Update payment method"**
6. Enter card details
7. Click **"Add"**
8. Card is saved

## Current Issue:

The subscription status section isn't showing up on your page. This is likely because:
- The subscription API endpoint isn't being called
- The component might have an error
- The API might not be deployed yet

## Quick Fix:

The subscription status should load automatically when you visit the Billing & Usage tab. If it's not showing:

1. **Check browser console** for errors (F12 → Console tab)
2. **Check Network tab** - look for `/admin/billing/subscription` API call
3. **Verify backend is deployed** with the new billing endpoints

## Direct Links:

- **Setup Billing**: `https://your-domain.com/setup-billing`
- **Billing Settings**: `https://your-domain.com/dashboard/settings?tab=billing`

## Test Card to Use:

When adding a card in Stripe (test mode):
- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: `12/25` (any future date)
- **CVC**: `123` (any 3 digits)
- **ZIP**: `12345` (any 5 digits)
