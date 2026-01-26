#!/usr/bin/env python3
"""
Create a Stripe customer and invoice for Iconic Detailing (Cody Bennett)
using Austin's Stripe account.

Usage:
    python scripts/create-iconic-detailing-invoice.py [API_KEY]
    
    Or set STRIPE_SECRET_KEY environment variable:
    export STRIPE_SECRET_KEY=sk_live_...
    python scripts/create-iconic-detailing-invoice.py
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


def create_iconic_detailing_customer_and_invoice(api_key: str, amount_cents: int = 4700):
    """
    Create customer and invoice for Iconic Detailing.
    
    Args:
        api_key: Stripe API key
        amount_cents: Invoice amount in cents (default $47.00)
    """
    stripe.api_key = api_key
    
    print("Creating customer for Iconic Detailing...")
    print("-" * 60)
    
    # Create customer
    customer = stripe.Customer.create(
        name="Cody Bennett - Iconic Detailing",
        email="cody@iconicdetailidaho.com",
        description="Iconic Detailing - Premier Auto Detailing in Boise, ID",
        metadata={
            "business_name": "Iconic Detailing",
            "owner": "Cody Bennett",
            "location": "Boise, ID",
            "address": "209 W 38th St, Boise, ID 83714",
            "phone": "(208) 602-2517",
            "website": "iconicdetailidaho.com",
            "founded": "2019"
        }
    )
    
    print(f"✅ Customer created:")
    print(f"   Customer ID: {customer.id}")
    print(f"   Name: {customer.name}")
    print(f"   Email: {customer.email}")
    print(f"   Dashboard: https://dashboard.stripe.com/customers/{customer.id}")
    print()
    
    # Create a product for the invoice item (or use existing)
    print("Creating product for invoice...")
    try:
        # Try to find existing product first
        products = stripe.Product.list(limit=10)
        product = None
        for p in products:
            if "Additional Sub-Account" in p.name or "Service" in p.name:
                product = p
                break
        
        # If not found, create a new one
        if not product:
            product = stripe.Product.create(
                name="Additional Sub-Account",
                description="Service subscription"
            )
            print(f"✅ Created product: {product.name} (ID: {product.id})")
        else:
            print(f"✅ Using existing product: {product.name} (ID: {product.id})")
    except Exception as e:
        print(f"⚠️  Error with product: {e}")
        # Create a simple product
        product = stripe.Product.create(
            name="Service",
            description="Service charge"
        )
    
    # Create a one-time price
    print("Creating price...")
    price = stripe.Price.create(
        unit_amount=amount_cents,
        currency="usd",
        product=product.id,
    )
    print(f"✅ Created price: ${amount_cents/100:.2f} USD (ID: {price.id})")
    print()
    
    # Create invoice
    print("Creating invoice...")
    invoice = stripe.Invoice.create(
        customer=customer.id,
        auto_advance=True,  # Automatically finalize
        days_until_due=30,
        collection_method="send_invoice",
    )
    print(f"✅ Invoice created: {invoice.id}")
    
    # Add invoice item
    print("Adding invoice item...")
    invoice_item = stripe.InvoiceItem.create(
        customer=customer.id,
        invoice=invoice.id,
        price=price.id,
        description=f"Service charge for {customer.name}"
    )
    print(f"✅ Invoice item added: {invoice_item.id}")
    
    # Finalize invoice
    print("Finalizing invoice...")
    finalized_invoice = stripe.Invoice.finalize_invoice(invoice.id)
    print(f"✅ Invoice finalized!")
    print()
    
    print("=" * 60)
    print("INVOICE SUMMARY")
    print("=" * 60)
    print(f"Customer: {customer.name}")
    print(f"Customer ID: {customer.id}")
    print(f"Email: {customer.email}")
    print(f"Invoice ID: {finalized_invoice.id}")
    print(f"Invoice Number: {finalized_invoice.number}")
    print(f"Status: {finalized_invoice.status}")
    print(f"Amount: ${finalized_invoice.total/100:.2f} {finalized_invoice.currency.upper()}")
    print(f"Due Date: {finalized_invoice.due_date}")
    print()
    print("Links:")
    print(f"  Customer Dashboard: https://dashboard.stripe.com/customers/{customer.id}")
    print(f"  Invoice Dashboard: https://dashboard.stripe.com/invoices/{finalized_invoice.id}")
    if finalized_invoice.hosted_invoice_url:
        print(f"  Hosted Invoice URL: {finalized_invoice.hosted_invoice_url}")
    print()
    
    return {
        "customer": customer,
        "invoice": finalized_invoice,
        "price": price
    }


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
        print("  python scripts/create-iconic-detailing-invoice.py [API_KEY]")
        print("\nOr set STRIPE_SECRET_KEY environment variable:")
        print("  export STRIPE_SECRET_KEY=sk_live_...")
        print("  python scripts/create-iconic-detailing-invoice.py")
        sys.exit(1)
    
    # Validate key format
    if not api_key.startswith(("sk_live_", "sk_test_")):
        print("⚠️  Warning: API key doesn't start with 'sk_live_' or 'sk_test_'")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    print("Creating customer and invoice for Iconic Detailing")
    print(f"Using API key: {api_key[:20]}...")
    print("=" * 60)
    print()
    
    try:
        result = create_iconic_detailing_customer_and_invoice(api_key)
        print("✅ Success! Customer and invoice created.")
        sys.exit(0)
    except stripe.error.AuthenticationError as e:
        print(f"❌ Authentication Error: {e}")
        print("The API key is invalid or has been revoked.")
        sys.exit(1)
    except stripe.error.StripeError as e:
        print(f"❌ Stripe Error: {e}")
        print(f"Error Type: {type(e).__name__}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
