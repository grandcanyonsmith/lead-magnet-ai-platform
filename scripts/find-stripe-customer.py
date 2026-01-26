#!/usr/bin/env python3
"""
Search for a Stripe customer by name, email, or description.

Usage:
    python scripts/find-stripe-customer.py "search term"
"""

import sys
import os
from typing import Optional, List, Dict, Any

try:
    import stripe
except ImportError:
    print("ERROR: stripe library not found. Install it with:")
    print("  pip install stripe")
    sys.exit(1)


def search_customers(search_term: str, api_key: str) -> List[Dict[str, Any]]:
    """
    Search for customers matching the search term.
    
    Args:
        search_term: Term to search for
        api_key: Stripe API key
        
    Returns:
        List of matching customers
    """
    stripe.api_key = api_key
    
    matches = []
    search_lower = search_term.lower()
    
    # Search by email
    try:
        customers = stripe.Customer.list(limit=100)
        for customer in customers.auto_paging_iter():
            # Check name
            if customer.name and search_lower in customer.name.lower():
                matches.append({
                    'id': customer.id,
                    'name': customer.name,
                    'email': customer.email,
                    'description': customer.description,
                    'created': customer.created,
                    'match_type': 'name'
                })
            # Check email
            elif customer.email and search_lower in customer.email.lower():
                matches.append({
                    'id': customer.id,
                    'name': customer.name,
                    'email': customer.email,
                    'description': customer.description,
                    'created': customer.created,
                    'match_type': 'email'
                })
            # Check description
            elif customer.description and search_lower in customer.description.lower():
                matches.append({
                    'id': customer.id,
                    'name': customer.name,
                    'email': customer.email,
                    'description': customer.description,
                    'created': customer.created,
                    'match_type': 'description'
                })
            # Check metadata
            if customer.metadata:
                for key, value in customer.metadata.items():
                    if value and search_lower in str(value).lower():
                        matches.append({
                            'id': customer.id,
                            'name': customer.name,
                            'email': customer.email,
                            'description': customer.description,
                            'created': customer.created,
                            'match_type': f'metadata.{key}',
                            'metadata': customer.metadata
                        })
                        break
    except Exception as e:
        print(f"Error searching customers: {e}")
    
    # Remove duplicates (same customer ID)
    seen = set()
    unique_matches = []
    for match in matches:
        if match['id'] not in seen:
            seen.add(match['id'])
            unique_matches.append(match)
    
    return unique_matches


def main():
    """Main entry point for the script."""
    if len(sys.argv) < 2:
        print("ERROR: No search term provided.")
        print("\nUsage:")
        print("  python scripts/find-stripe-customer.py \"search term\"")
        sys.exit(1)
    
    search_term = sys.argv[1]
    
    # Get API key from environment variable or use the one from earlier
    api_key = os.getenv("STRIPE_SECRET_KEY")
    if not api_key:
        print("ERROR: No Stripe API key found.")
        print("Set STRIPE_SECRET_KEY environment variable:")
        print("  export STRIPE_SECRET_KEY=sk_live_...")
        sys.exit(1)
    
    print(f"Searching for: '{search_term}'")
    print("-" * 60)
    
    matches = search_customers(search_term, api_key)
    
    if not matches:
        print(f"❌ No customers found matching '{search_term}'")
        sys.exit(1)
    
    print(f"✅ Found {len(matches)} matching customer(s):\n")
    
    for i, match in enumerate(matches, 1):
        print(f"{i}. Customer ID: {match['id']}")
        if match['name']:
            print(f"   Name: {match['name']}")
        if match['email']:
            print(f"   Email: {match['email']}")
        if match['description']:
            print(f"   Description: {match['description']}")
        print(f"   Matched by: {match['match_type']}")
        print(f"   Created: {match['created']}")
        if 'metadata' in match:
            print(f"   Metadata: {match['metadata']}")
        print(f"   Dashboard: https://dashboard.stripe.com/customers/{match['id']}")
        print()


if __name__ == "__main__":
    main()
