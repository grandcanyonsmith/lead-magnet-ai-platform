#!/usr/bin/env python3
"""
Script to save OpenAI admin API key to AWS Secrets Manager in multiple regions.
"""
import boto3
import json
import os
import sys
from botocore.exceptions import ClientError

def save_secret(secret_name: str, secret_value: str, region: str, description: str) -> bool:
    """Save secret to AWS Secrets Manager."""
    try:
        secrets_client = boto3.client("secretsmanager", region_name=region)
        
        # Check if secret exists
        try:
            secrets_client.describe_secret(SecretId=secret_name)
            print(f"  Secret '{secret_name}' exists in {region}, updating...")
            # Update existing secret
            secrets_client.update_secret(
                SecretId=secret_name,
                SecretString=secret_value,
                Description=description
            )
            print(f"  ✅ Updated secret '{secret_name}' in {region}")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                print(f"  Secret '{secret_name}' does not exist in {region}, creating...")
                # Create new secret
                secrets_client.create_secret(
                    Name=secret_name,
                    SecretString=secret_value,
                    Description=description
                )
                print(f"  ✅ Created secret '{secret_name}' in {region}")
            else:
                raise
        
        return True
    except ClientError as e:
        print(f"  ❌ Error in {region}: {e}")
        return False
    except Exception as e:
        print(f"  ❌ Unexpected error in {region}: {e}")
        return False

def main():
    """Main function."""
    api_key = os.environ.get("OPENAI_ADMIN_API_KEY")
    if not api_key:
        print("❌ Missing OPENAI_ADMIN_API_KEY environment variable.")
        return 1
    secret_name = "leadmagnet/openai-admin-api-key"
    description = "OpenAI Admin API Key with audit logs read permissions"
    
    regions = ["us-west-2", "us-east-1"]
    
    print("=" * 60)
    print("Saving OpenAI Admin API Key to AWS Secrets Manager")
    print("=" * 60)
    print(f"Secret Name: {secret_name}")
    print(f"Regions: {', '.join(regions)}")
    print(f"API Key Length: {len(api_key)}")
    print()
    
    results = {}
    for region in regions:
        print(f"Processing {region}...")
        success = save_secret(secret_name, api_key, region, description)
        results[region] = success
        print()
    
    print("=" * 60)
    print("Summary:")
    print("=" * 60)
    for region, success in results.items():
        status = "✅ Success" if success else "❌ Failed"
        print(f"{region}: {status}")
    
    if all(results.values()):
        print("\n✅ All secrets saved successfully!")
        return 0
    else:
        print("\n⚠️  Some secrets failed to save. Check errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
