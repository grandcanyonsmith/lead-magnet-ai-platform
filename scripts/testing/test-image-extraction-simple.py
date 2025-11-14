#!/usr/bin/env python3
"""
Simple test script to verify image extraction and base64 conversion from OpenAI Responses API.
This script directly tests the API call and image extraction without the full workflow.
"""

import sys
import os
import json
import base64
import boto3
from pathlib import Path

# Add backend/worker to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

from openai import OpenAI
from services.image_handler import ImageHandler
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_openai_api_key_from_secrets():
    """Get OpenAI API key from AWS Secrets Manager."""
    try:
        # Try using the existing APIKeyManager first
        try:
            from services.api_key_manager import APIKeyManager
            # Use OPENAI_API_KEY_SECRET_NAME directly (found in us-west-2)
            secret_name = 'OPENAI_API_KEY_SECRET_NAME'
            api_key = APIKeyManager.get_openai_key(secret_name=secret_name, region='us-west-2')
            if api_key:
                print("✅ Retrieved API key using APIKeyManager")
                return api_key
        except Exception as e:
            print(f"⚠️  APIKeyManager failed: {e}, trying direct Secrets Manager call...")
        
        # Fallback to direct Secrets Manager call
        secrets_client = boto3.client('secretsmanager', region_name='us-west-2')
        # Use OPENAI_API_KEY_SECRET_NAME directly (found in us-west-2)
        secret_name = 'OPENAI_API_KEY_SECRET_NAME'
        
        print(f"   Fetching secret: {secret_name} from us-west-2")
        response = secrets_client.get_secret_value(SecretId=secret_name)
        secret_string = response['SecretString']
        
        # Try parsing as JSON first, then fall back to plain string
        try:
            secret = json.loads(secret_string)
            # Try different possible key names
            api_key = secret.get('OPENAI_API_KEY') or secret.get('openai_api_key') or secret.get('api_key')
            if api_key:
                print(f"✅ Retrieved API key from Secrets Manager JSON (length: {len(api_key)})")
                return api_key
            else:
                print(f"⚠️  Warning: Secret JSON found but no API key found. Keys in secret: {list(secret.keys())}")
        except json.JSONDecodeError:
            # Secret is plain string, use directly
            print(f"✅ Retrieved API key from Secrets Manager (plain string, length: {len(secret_string)})")
            return secret_string
        
        return None
    except Exception as e:
        print(f"⚠️  Warning: Could not get API key from Secrets Manager: {e}")
        import traceback
        traceback.print_exc()
        return None

def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)

def print_json(data, title="Data"):
    """Print JSON data in a readable format."""
    print(f"\n{title}:")
    print(json.dumps(data, indent=2, default=str))

def main():
    print_section("Simple Image Extraction Test")
    
    # Initialize OpenAI client
    # Try environment variable first, then AWS Secrets Manager
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        print("⚠️  OPENAI_API_KEY not in environment, trying AWS Secrets Manager...")
        api_key = get_openai_api_key_from_secrets()
    
    if not api_key:
        print("❌ ERROR: Could not get OPENAI_API_KEY from environment or AWS Secrets Manager")
        return 1
    
    client = OpenAI(api_key=api_key)
    print("✅ OpenAI client initialized")
    
    # Initialize image handler
    try:
        image_handler = ImageHandler()
        print("✅ Image handler initialized")
    except Exception as e:
        print(f"⚠️  Warning: Could not initialize image handler: {e}")
        print("   Will test extraction but not conversion")
        image_handler = None
    
    # Make API call
    print_section("Making API Call")
    
    params = {
        "model": "gpt-5",
        "input": "Generate an image of a gray tabby cat hugging an otter with an orange scarf",
        "tools": [{"type": "image_generation"}],
        "tool_choice": "required"
    }
    
    print_json(params, "Request Parameters")
    
    try:
        response = client.responses.create(**params)
        print("✅ API call successful")
    except Exception as e:
        print(f"❌ API call failed: {e}")
        return 1
    
    # Inspect response structure
    print_section("Response Structure")
    
    print(f"Response type: {type(response).__name__}")
    print(f"Response attributes: {[attr for attr in dir(response) if not attr.startswith('_')]}")
    
    # Check response.output
    if hasattr(response, 'output'):
        print(f"\n✅ Response has 'output' attribute")
        print(f"   Output type: {type(response.output).__name__}")
        print(f"   Output length: {len(response.output) if isinstance(response.output, list) else 'N/A'}")
        
        if response.output:
            print(f"\n   Output items:")
            for idx, item in enumerate(response.output):
                print(f"\n   Item {idx}:")
                print(f"     Type: {type(item).__name__}")
                print(f"     Attributes: {[attr for attr in dir(item) if not attr.startswith('_')]}")
                
                # Check item.type
                if hasattr(item, 'type'):
                    item_type = item.type
                    print(f"     item.type: {item_type}")
                    
                    if item_type == 'image_generation_call':
                        print(f"     ✅ Found image_generation_call!")
                        
                        # Check for result attribute
                        if hasattr(item, 'result'):
                            result = item.result
                            print(f"     ✅ Found 'result' attribute")
                            print(f"     Result type: {type(result).__name__}")
                            
                            if isinstance(result, str):
                                print(f"     Result length: {len(result)}")
                                print(f"     Result preview (first 100 chars): {result[:100]}...")
                                
                                # Try to decode base64 to verify it's valid
                                try:
                                    decoded = base64.b64decode(result)
                                    print(f"     ✅ Base64 is valid! Decoded size: {len(decoded)} bytes")
                                    
                                    # Save to file for verification
                                    output_file = "test_image.png"
                                    with open(output_file, "wb") as f:
                                        f.write(decoded)
                                    print(f"     ✅ Saved decoded image to {output_file}")
                                    
                                    # Try to convert using image_handler
                                    if image_handler:
                                        print_section("Converting Base64 to URL")
                                        try:
                                            # Create data URL format
                                            base64_data_url = f"data:image/png;base64,{result}"
                                            print(f"   Data URL length: {len(base64_data_url)}")
                                            
                                            tenant_id = os.environ.get('TENANT_ID', '84c8e438-0061-70f2-2ce0-7cb44989a329')
                                            job_id = "test_job_123"
                                            
                                            print(f"   Converting with tenant_id: {tenant_id}, job_id: {job_id}")
                                            converted_url = image_handler.convert_base64_to_url(
                                                base64_data_url,
                                                tenant_id=tenant_id,
                                                job_id=job_id
                                            )
                                            
                                            if converted_url:
                                                print(f"   ✅ Successfully converted to URL: {converted_url}")
                                            else:
                                                print(f"   ❌ Conversion returned None")
                                        except Exception as e:
                                            print(f"   ❌ Conversion failed: {e}")
                                            import traceback
                                            traceback.print_exc()
                                    else:
                                        print("   ⚠️  No image_handler available, skipping conversion")
                                        
                                except Exception as e:
                                    print(f"     ❌ Base64 decode failed: {e}")
                            else:
                                print(f"     ⚠️  Result is not a string (type: {type(result).__name__})")
                                print_json(result, f"     Result value")
                        else:
                            print(f"     ❌ No 'result' attribute found")
                            print(f"     Available attributes: {[attr for attr in dir(item) if not attr.startswith('_')]}")
                    else:
                        print(f"     ⚠️  Item type is '{item_type}', not 'image_generation_call'")
                else:
                    print(f"     ⚠️  Item has no 'type' attribute")
    else:
        print("❌ Response has no 'output' attribute")
    
    # Check response.output_text
    if hasattr(response, 'output_text'):
        print(f"\n✅ Response has 'output_text' attribute")
        print(f"   Output text length: {len(response.output_text)}")
        if response.output_text:
            print(f"   Output text preview: {response.output_text[:200]}...")
    
    # Check response.usage
    if hasattr(response, 'usage'):
        print(f"\n✅ Response has 'usage' attribute")
        usage = response.usage
        if usage:
            print(f"   Input tokens: {getattr(usage, 'input_tokens', 'N/A')}")
            print(f"   Output tokens: {getattr(usage, 'output_tokens', 'N/A')}")
            print(f"   Total tokens: {getattr(usage, 'total_tokens', 'N/A')}")
    
    print_section("Test Complete")
    print("Check the output above to see:")
    print("  1. If image_generation_call items are found")
    print("  2. If result contains base64 data")
    print("  3. If base64 can be decoded")
    print("  4. If conversion to URL works")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

