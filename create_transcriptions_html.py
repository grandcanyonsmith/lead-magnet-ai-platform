#!/usr/bin/env python3
"""
Script to check DynamoDB transcriptions table count, generate HTML, and upload to S3.
"""
import boto3
from datetime import datetime, timezone
import json
import sys

def get_item_count(table_name: str, region: str) -> int:
    """Get approximate item count from DynamoDB table."""
    ddb = boto3.client("dynamodb", region_name=region)
    try:
        resp = ddb.describe_table(TableName=table_name)
        return int(resp["Table"]["ItemCount"])
    except Exception as e:
        print(f"Error getting count: {e}")
        # Try scan with COUNT if describe-table fails
        try:
            resp = ddb.scan(TableName=table_name, Select="COUNT")
            return int(resp.get("Count", 0))
        except Exception as e2:
            print(f"Error scanning: {e2}")
            raise

def build_html(count: int, region: str) -> str:
    """Build HTML page showing the count."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Transcriptions Item Count</title>
  <style>
    body {{ 
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; 
      margin: 0;
      padding: 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .card {{ 
      max-width: 720px; 
      padding: 48px; 
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }}
    h1 {{
      margin: 0 0 24px 0;
      color: #1f2937;
      font-size: 32px;
    }}
    .count {{ 
      font-size: 72px; 
      font-weight: 700; 
      margin: 24px 0;
      color: #667eea;
      text-align: center;
    }}
    .meta {{ 
      color: #6b7280;
      text-align: center;
      margin-top: 24px;
    }}
    .label {{
      color: #9ca3af;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="label">DynamoDB Table: transcriptions ({region})</div>
    <h1>Item Count</h1>
    <div class="count">{count:,}</div>
    <div class="meta">Updated (UTC): {ts}</div>
  </div>
</body>
</html>
"""

def upload_html(bucket: str, key: str, region: str, html: str) -> str:
    """Upload HTML to S3 and return object URL."""
    s3 = boto3.client("s3", region_name=region)
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=html.encode("utf-8"),
        ContentType="text/html; charset=utf-8",
        CacheControl="no-cache",
    )
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"

def main():
    # Try both regions
    regions = ["us-west-2", "us-east-1"]
    table_name = "Transcriptions"  # Capital T
    bucket = "cc360-pages"
    s3_region = "us-west-2"
    
    count = None
    found_region = None
    
    for region in regions:
        try:
            print(f"Checking DynamoDB table '{table_name}' in {region}...")
            count = get_item_count(table_name, region)
            found_region = region
            print(f"✅ Found {count:,} items in {region}")
            break
        except Exception as e:
            print(f"❌ Not found in {region}: {e}")
            continue
    
    if count is None:
        print(f"\n❌ Table '{table_name}' not found in any region")
        sys.exit(1)
    
    print(f"\nGenerating HTML...")
    html = build_html(count, found_region)
    
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    key = f"transcriptions-count-{stamp}.html"
    
    print(f"Uploading to s3://{bucket}/{key} in {s3_region}...")
    url = upload_html(bucket, key, s3_region, html)
    
    print(f"\n✅ Success! Object URL:")
    print(url)
    
    result = {
        "count": count,
        "url": url,
        "bucket": bucket,
        "key": key,
        "dynamodb_region": found_region,
        "s3_region": s3_region
    }
    print(f"\nJSON result:")
    print(json.dumps(result, indent=2))
    
    return url

if __name__ == "__main__":
    main()
