#!/usr/bin/env python3
"""
Generate presigned URLs for Loom transcript files stored in S3.

Usage:
    python scripts/utils/get-loom-transcript-urls.py \
        --bucket coursecreator360-rich-snippet-booster \
        --share-id e9709b3c4aee415992833034816690b7 \
        --timestamp 20260124T025534Z \
        [--expiry 604800]

Environment Variables:
    AWS_REGION or AWS_DEFAULT_REGION: AWS region (defaults to us-east-1)
    PRESIGN_EXPIRY_SECONDS: Expiration time in seconds (defaults to 604800 = 7 days)
"""

import argparse
import json
import os
import sys
from datetime import datetime

try:
    import boto3
except ImportError:
    print("Error: boto3 is required. Install with: pip install boto3", file=sys.stderr)
    sys.exit(1)


def generate_loom_transcript_urls(
    bucket: str,
    share_id: str,
    timestamp: str,
    expiry: int = 604800,
    region: str = None,
) -> dict:
    """
    Generate presigned URLs for Loom transcript files.

    Args:
        bucket: S3 bucket name
        share_id: Loom share ID
        timestamp: Timestamp in format YYYYMMDDTHHMMSSZ
        expiry: URL expiration time in seconds (default: 604800 = 7 days)
        region: AWS region (defaults to environment variable or us-east-1)

    Returns:
        Dictionary with status, loom_share_id, s3_bucket, and objects array
    """
    if not region:
        region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"

    s3 = boto3.client("s3", region_name=region)

    # Check if bucket allows public read access
    is_public = False
    try:
        policy = s3.get_bucket_policy(Bucket=bucket)
        policy_doc = json.loads(policy.get("Policy", "{}"))
        for statement in policy_doc.get("Statement", []):
            if (
                statement.get("Effect") == "Allow"
                and statement.get("Principal", {}).get("AWS") == "*"
                and "s3:GetObject" in statement.get("Action", [])
            ):
                is_public = True
                break
    except Exception:
        # If we can't check policy, assume not public
        pass

    # Define the transcript file keys
    keys = [
        ("transcript", f"loom_{share_id}_{timestamp}.txt"),
        ("timestamped_transcript", f"loom_{share_id}_{timestamp}_timestamped.txt"),
    ]

    objs = []
    for typ, key in keys:
        try:
            # Get object metadata
            head = s3.head_object(Bucket=bucket, Key=key)

            # Generate URL - use direct URL if bucket is public, otherwise presigned
            if is_public:
                # Direct public URL (doesn't expire)
                url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
                url_type = "public_url"
            else:
                # Presigned URL (expires)
                url = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": bucket, "Key": key},
                    ExpiresIn=expiry,
                )
                url_type = "presigned_url"

            objs.append(
                {
                    "type": typ,
                    "s3_key": key,
                    url_type: url,
                    "is_public": is_public,
                    "bytes": head["ContentLength"],
                    "last_modified": head["LastModified"].isoformat(),
                }
            )
        except s3.exceptions.NoSuchKey:
            print(f"Warning: Object not found: {key}", file=sys.stderr)
        except Exception as e:
            print(f"Error processing {key}: {e}", file=sys.stderr)

    return {
        "status": "ok",
        "loom_share_id": share_id,
        "s3_bucket": bucket,
        "bucket_is_public": is_public,
        "expiry_seconds": expiry if not is_public else None,
        "region": region,
        "objects": objs,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Generate presigned URLs for Loom transcript files"
    )
    parser.add_argument(
        "--bucket",
        required=True,
        help="S3 bucket name",
    )
    parser.add_argument(
        "--share-id",
        required=True,
        help="Loom share ID",
    )
    parser.add_argument(
        "--timestamp",
        required=True,
        help="Timestamp in format YYYYMMDDTHHMMSSZ (e.g., 20260124T025534Z)",
    )
    parser.add_argument(
        "--expiry",
        type=int,
        default=int(os.getenv("PRESIGN_EXPIRY_SECONDS", "604800")),
        help="URL expiration time in seconds (default: 604800 = 7 days)",
    )
    parser.add_argument(
        "--region",
        default=None,
        help="AWS region (defaults to AWS_REGION or AWS_DEFAULT_REGION env var)",
    )
    parser.add_argument(
        "--format",
        choices=["json", "pretty"],
        default="json",
        help="Output format (default: json)",
    )

    args = parser.parse_args()

    try:
        result = generate_loom_transcript_urls(
            bucket=args.bucket,
            share_id=args.share_id,
            timestamp=args.timestamp,
            expiry=args.expiry,
            region=args.region,
        )

        if args.format == "pretty":
            print(f"Loom Share ID: {result['loom_share_id']}")
            print(f"S3 Bucket: {result['s3_bucket']}")
            print(f"Region: {result['region']}")
            print(f"Bucket is Public: {'Yes ✅' if result.get('bucket_is_public') else 'No (using presigned URLs)'}")
            if result.get('expiry_seconds'):
                print(f"Expiry: {result['expiry_seconds']} seconds ({result['expiry_seconds'] / 86400:.1f} days)")
            print(f"\nObjects ({len(result['objects'])}):")
            for obj in result["objects"]:
                print(f"\n  Type: {obj['type']}")
                print(f"  S3 Key: {obj['s3_key']}")
                print(f"  Size: {obj['bytes']:,} bytes ({obj['bytes'] / 1024:.1f} KB)")
                print(f"  Last Modified: {obj['last_modified']}")
                if obj.get('public_url'):
                    print(f"  Public URL: {obj['public_url']}")
                else:
                    print(f"  Presigned URL: {obj['presigned_url']}")
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))

        # Exit with error if no objects found
        if not result["objects"]:
            sys.exit(1)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
