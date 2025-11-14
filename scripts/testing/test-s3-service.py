#!/usr/bin/env python3
"""
Test script to verify S3 service is working correctly.
"""

import sys
import os
from pathlib import Path

# Add backend/worker to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

from s3_service import S3Service
from dotenv import load_dotenv
import boto3

# Load environment variables
load_dotenv()

def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)

def test_s3_service():
    """Test S3 service functionality."""
    print_section("S3 Service Test")
    
    # Check environment variables
    bucket_name = os.environ.get('ARTIFACTS_BUCKET')
    region = os.environ.get('AWS_REGION', 'us-east-1')
    
    # If not set, try to find it automatically
    if not bucket_name:
        print("⚠️  ARTIFACTS_BUCKET not set, trying to find bucket...")
        try:
            import boto3
            s3_client = boto3.client('s3', region_name=region)
            buckets = s3_client.list_buckets()
            for bucket in buckets.get('Buckets', []):
                if 'leadmagnet-artifacts' in bucket['Name']:
                    bucket_name = bucket['Name']
                    print(f"✅ Found bucket: {bucket_name}")
                    # Set it for this session
                    os.environ['ARTIFACTS_BUCKET'] = bucket_name
                    break
        except Exception as e:
            print(f"⚠️  Could not auto-detect bucket: {e}")
    
    print(f"ARTIFACTS_BUCKET: {bucket_name}")
    print(f"AWS_REGION: {region}")
    
    if not bucket_name:
        print("❌ ERROR: ARTIFACTS_BUCKET environment variable not set and could not auto-detect")
        print("   Please set ARTIFACTS_BUCKET environment variable")
        return False
    
    # Test AWS credentials
    print_section("Testing AWS Credentials")
    try:
        sts = boto3.client('sts', region_name=region)
        identity = sts.get_caller_identity()
        print(f"✅ AWS credentials valid")
        print(f"   Account ID: {identity.get('Account')}")
        print(f"   User ARN: {identity.get('Arn')}")
    except Exception as e:
        print(f"❌ AWS credentials error: {e}")
        return False
    
    # Test S3 bucket access
    print_section("Testing S3 Bucket Access")
    try:
        s3_client = boto3.client('s3', region_name=region)
        
        # Check if bucket exists
        try:
            s3_client.head_bucket(Bucket=bucket_name)
            print(f"✅ Bucket '{bucket_name}' exists and is accessible")
        except Exception as e:
            print(f"❌ Cannot access bucket '{bucket_name}': {e}")
            return False
        
        # Test listing objects
        try:
            response = s3_client.list_objects_v2(Bucket=bucket_name, MaxKeys=5)
            object_count = response.get('KeyCount', 0)
            print(f"✅ Can list objects in bucket (found {object_count} objects)")
        except Exception as e:
            print(f"⚠️  Warning: Cannot list objects: {e}")
        
        # Test S3Service initialization
        print_section("Testing S3Service Initialization")
        try:
            s3_service = S3Service()
            print("✅ S3Service initialized successfully")
            
            # Test upload
            print_section("Testing S3 Upload")
            test_key = "test/test-file.txt"
            test_content = "This is a test file"
            
            try:
                s3_service.upload_artifact(test_key, test_content)
                print(f"✅ Successfully uploaded test file to: {test_key}")
                
                # Test download
                print_section("Testing S3 Download")
                downloaded_content = s3_service.download_artifact(test_key)
                if downloaded_content == test_content:
                    print(f"✅ Successfully downloaded and verified test file")
                else:
                    print(f"⚠️  Warning: Downloaded content doesn't match")
                
                # Cleanup
                try:
                    s3_client.delete_object(Bucket=bucket_name, Key=test_key)
                    print(f"✅ Cleaned up test file")
                except Exception as e:
                    print(f"⚠️  Warning: Could not delete test file: {e}")
                
            except Exception as e:
                print(f"❌ Upload test failed: {e}")
                import traceback
                traceback.print_exc()
                return False
                
        except Exception as e:
            print(f"❌ S3Service initialization failed: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        print_section("S3 Service Test Complete")
        print("✅ All S3 service tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ S3 test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_s3_service()
    sys.exit(0 if success else 1)

