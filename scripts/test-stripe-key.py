#!/usr/bin/env python3
"""
Test script to verify a Stripe API key is working.

Usage:
    python scripts/test-stripe-key.py [API_KEY]
    
    Or set STRIPE_SECRET_KEY environment variable:
    export STRIPE_SECRET_KEY=sk_live_...
    python scripts/test-stripe-key.py
"""

import sys
import os
from typing import Optional

try:
    import stripe
except ImportError:
    print("ERROR: stripe library not found. Install it with:")
    print("  pip install stripe")
    sys.exit(1)


def test_stripe_key(api_key: str) -> bool:
    """
    Test if a Stripe API key is valid by making a simple API call.
    
    Args:
        api_key: The Stripe API key to test
        
    Returns:
        True if the key is valid, False otherwise
    """
    try:
        # Initialize Stripe client with the provided key
        stripe.api_key = api_key
        
        # Make a simple API call to retrieve account information
        # This is a lightweight call that validates the key
        account = stripe.Account.retrieve()
        
        print("✅ Stripe API key is VALID!")
        print(f"\nAccount Information:")
        print(f"  Account ID: {account.id}")
        print(f"  Country: {account.country}")
        print(f"  Default Currency: {account.default_currency}")
        print(f"  Email: {account.email or 'N/A'}")
        print(f"  Type: {account.type}")
        
        if hasattr(account, 'charges_enabled'):
            print(f"  Charges Enabled: {account.charges_enabled}")
        if hasattr(account, 'payouts_enabled'):
            print(f"  Payouts Enabled: {account.payouts_enabled}")
        
        return True
        
    except stripe.error.AuthenticationError as e:
        print(f"❌ Authentication Error: {e}")
        print("The API key is invalid or has been revoked.")
        return False
    except stripe.error.PermissionError as e:
        print(f"❌ Permission Error: {e}")
        print("The API key doesn't have permission to perform this operation.")
        return False
    except stripe.error.StripeError as e:
        print(f"❌ Stripe Error: {e}")
        print(f"Error Type: {type(e).__name__}")
        return False
    except Exception as e:
        print(f"❌ Unexpected Error: {type(e).__name__}: {e}")
        return False


def main():
    """Main entry point for the script."""
    # Get API key from command line argument or environment variable
    api_key: Optional[str] = None
    
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    elif os.getenv("STRIPE_SECRET_KEY"):
        api_key = os.getenv("STRIPE_SECRET_KEY")
    else:
        print("ERROR: No Stripe API key provided.")
        print("\nUsage:")
        print("  python scripts/test-stripe-key.py [API_KEY]")
        print("\nOr set STRIPE_SECRET_KEY environment variable:")
        print("  export STRIPE_SECRET_KEY=sk_live_...")
        print("  python scripts/test-stripe-key.py")
        sys.exit(1)
    
    # Validate key format
    if not api_key.startswith(("sk_live_", "sk_test_")):
        print("⚠️  Warning: API key doesn't start with 'sk_live_' or 'sk_test_'")
        print("This might not be a valid Stripe secret key format.")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    print(f"Testing Stripe API key: {api_key[:20]}...")
    print("-" * 60)
    
    success = test_stripe_key(api_key)
    
    if success:
        print("\n✅ Key test completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Key test failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
