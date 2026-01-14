#!/bin/bash
# Script to add custom domains to CloudFront distribution
# This bypasses CDK/CloudFormation to avoid cross-stack dependency issues

set -e

CERT_ARN="arn:aws:acm:us-east-1:471112574622:certificate/c9730aa9-251d-4e40-951c-8bf5ff76f26d"
DOMAIN1="forms.mycoursecreator360.com"
DOMAIN2="assets.mycoursecreator360.com"

echo "🔧 Updating CloudFront Distribution with Custom Domains"
echo "==========================================================="
echo ""

# Get distribution ID
echo "📋 Getting CloudFront distribution ID..."
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-storage \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text)

if [ -z "$DIST_ID" ]; then
  echo "❌ Could not find CloudFront distribution ID"
  exit 1
fi

echo "✅ Distribution ID: $DIST_ID"
echo ""

# Get current distribution config
echo "📥 Downloading current distribution config..."
aws cloudfront get-distribution-config \
  --id "$DIST_ID" \
  --output json > /tmp/cf-config-full.json

ETAG=$(cat /tmp/cf-config-full.json | jq -r '.ETag')
echo "✅ Current ETag: $ETAG"

# Extract just the DistributionConfig
cat /tmp/cf-config-full.json | jq '.DistributionConfig' > /tmp/cf-config.json

# Update the config with custom domains and certificate
echo ""
echo "🔧 Adding custom domains and certificate..."
cat /tmp/cf-config.json | jq \
  --arg cert "$CERT_ARN" \
  --arg domain1 "$DOMAIN1" \
  --arg domain2 "$DOMAIN2" \
  '.Aliases = {
    "Quantity": 2,
    "Items": [$domain1, $domain2]
  } |
  .ViewerCertificate = {
    "ACMCertificateArn": $cert,
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021",
    "Certificate": $cert,
    "CertificateSource": "acm"
  }' > /tmp/cf-config-updated.json

echo "✅ Config updated"
echo ""

# Show the changes
echo "📋 New aliases:"
cat /tmp/cf-config-updated.json | jq -r '.Aliases.Items[]'
echo ""

# Update the distribution
echo "🚀 Updating CloudFront distribution..."
echo "   (This will take 5-15 minutes to deploy)"
aws cloudfront update-distribution \
  --id "$DIST_ID" \
  --distribution-config file:///tmp/cf-config-updated.json \
  --if-match "$ETAG" \
  --output json > /tmp/cf-update-result.json

echo "✅ Update initiated successfully!"
echo ""

# Show new status
STATUS=$(cat /tmp/cf-update-result.json | jq -r '.Distribution.Status')
echo "📊 Distribution Status: $STATUS"
echo ""

echo "⏳ Waiting for deployment to complete..."
echo "   You can check status with:"
echo "   aws cloudfront get-distribution --id $DIST_ID --query 'Distribution.Status'"
echo ""
echo "✨ Once status is 'Deployed', your domains will be live!"
echo ""
echo "📋 Next steps:"
echo "   1. Verify DNS records in Cloudflare point to: dmydkyj79auy7.cloudfront.net"
echo "   2. Test: https://$DOMAIN1"
echo "   3. Test: https://$DOMAIN2"
echo ""
