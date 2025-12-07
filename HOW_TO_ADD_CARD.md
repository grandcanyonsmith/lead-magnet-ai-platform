# How to Add a Card - Step by Step Guide

## Where to Add a Card

Users can add a card in **two places**:

### Option 1: During Signup (Initial Setup)
1. User signs up for account
2. After signup, they're redirected to `/setup-billing`
3. Click **"Start Subscription"** button
4. Stripe Checkout opens where they can:
   - Enter credit card information
   - Complete subscription signup
   - Card is automatically saved to their Stripe customer

### Option 2: In Billing Settings (Existing Users)
1. Navigate to: **Settings → Billing & Usage** tab
2. Click the **"Manage Subscription"** button (top right)
3. Stripe Customer Portal opens
4. In the portal, users can:
   - Click **"Add payment method"** to add a new card
   - Click **"Update payment method"** to change existing card
   - Set default payment method
   - View payment history

## Visual Guide

### Step 1: Go to Settings
```
Dashboard → Settings (in sidebar) → Click "Billing & Usage" tab
```

### Step 2: Click "Manage Subscription"
You'll see a button in the top right that says:
```
[💳 Manage Subscription →]
```

### Step 3: Stripe Portal Opens
After clicking, you'll be redirected to Stripe's hosted Customer Portal where you can:
- See your current payment method
- Click **"Add payment method"** button
- Enter card details:
  - Card number: `4242 4242 4242 4242` (test card)
  - Expiry: Any future date (e.g., `12/25`)
  - CVC: Any 3 digits (e.g., `123`)
  - ZIP: Any 5 digits (e.g., `12345`)
- Click **"Add"**
- Card is saved and ready to use

### Step 4: Return to App
After adding the card, click **"Done"** in the Stripe Portal
- You'll be redirected back to your billing settings page
- The card is now saved and will be used for future charges

## Code Locations

### Frontend Component
- **File**: `frontend/src/components/settings/BillingUsage.tsx`
- **Button**: "Manage Subscription" (line ~142)
- **Action**: Opens Stripe Customer Portal

### Backend Endpoint
- **Route**: `POST /admin/billing/portal-session`
- **File**: `backend/api/src/controllers/billing.ts`
- **Function**: `createPortalSession()`

### Stripe Service
- **File**: `backend/api/src/services/stripeService.ts`
- **Function**: `createPortalSession()`
- **Portal Features**: Payment method management is enabled by default

## Testing

To test adding a card:

1. **Start your frontend**:
   ```bash
   cd frontend
   npm run dev
   # Runs on http://localhost:3000
   ```

2. **Login** to your account

3. **Navigate** to: `http://localhost:3000/dashboard/settings?tab=billing`

4. **Click** "Manage Subscription" button

5. **In Stripe Portal**, click "Add payment method"

6. **Enter test card**:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - ZIP: `12345`

7. **Click** "Add"

8. **Done!** Card is saved

## Important Notes

- ✅ **Card management is enabled by default** - No additional Stripe configuration needed
- ✅ **Portal is secure** - Handled entirely by Stripe
- ✅ **Cards are saved** - Available for future charges automatically
- ✅ **Multiple cards** - Users can add multiple cards and set a default
- ✅ **Card updates** - Users can update expired cards anytime

## Troubleshooting

**"Manage Subscription" button not showing?**
- User needs an active subscription first
- If no subscription, they'll see "Start Subscription" instead

**Portal not opening?**
- Check browser console for errors
- Verify Stripe API key is in AWS Secrets Manager
- Check backend logs for portal session creation errors

**Can't add card in portal?**
- Verify Customer Portal is enabled in Stripe Dashboard
- Go to: https://dashboard.stripe.com/settings/billing/portal
- Ensure "Payment method updates" is enabled
