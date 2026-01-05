#!/bin/bash
# Deploy CloudFront with custom domain configuration
# Run this after ACM certificate is validated

set -e

CERT_ARN="arn:aws:acm:us-east-1:471112574622:certificate/c9730aa9-251d-4e40-951c-8bf5ff76f26d"
DOMAINS="forms.mycoursecreator360.com,assets.mycoursecreator360.com"
ASSETS_DOMAIN="assets.mycoursecreator360.com"
REGION="us-east-1"

echo "🚀 Deploying CloudFront with Custom Domain"
echo "=========================================="
echo ""

# Check certificate status
echo "🔍 Checking certificate status..."
CERT_STATUS=$(aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --region $REGION \
  --query 'Certificate.Status' \
  --output text 2>/dev/null || echo "UNKNOWN")

if [ "$CERT_STATUS" != "ISSUED" ]; then
  echo "❌ Certificate status: $CERT_STATUS"
  echo ""
  echo "⏳ Certificate is not yet validated. Please wait and check again:"
  echo "   aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION --query 'Certificate.Status'"
  echo ""
  echo "Once status is 'ISSUED', run this script again."
  exit 1
fi

echo "✅ Certificate status: $CERT_STATUS"
echo ""

# Set environment variables
export CLOUDFRONT_CUSTOM_DOMAIN_NAMES="$DOMAINS"
export CLOUDFRONT_CUSTOM_CERTIFICATE_ARN="$CERT_ARN"
export CLOUDFRONT_DOMAIN="$ASSETS_DOMAIN"

echo "📋 Configuration:"
echo "   • Domains: $DOMAINS"
echo "   • Certificate: $CERT_ARN"
echo "   • Assets Domain: $ASSETS_DOMAIN"
echo ""

# Deploy infrastructure
echo "🚀 Deploying infrastructure..."
cd "$(dirname "$0")/../infrastructure" || exit 1

npm run deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "⏳ CloudFront distribution update takes 5-15 minutes"
echo "   Check status: aws cloudfront get-distribution --id E1GPKD58HXUDIV --query 'Distribution.Status'"
echo ""
echo "🌐 Once deployed, your domain will be available at:"
echo "   • https://forms.mycoursecreator360.com"
echo "   • https://assets.mycoursecreator360.com"
