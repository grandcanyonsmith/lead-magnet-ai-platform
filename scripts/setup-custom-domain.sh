#!/bin/bash
# Setup script for custom domain configuration
# This helps configure CloudFront with custom domains

set -e

DOMAIN="forms.mycoursecreator360.com"
ASSETS_DOMAIN="assets.mycoursecreator360.com"
REGION="us-east-1"
STACK_NAME="leadmagnet-storage"

echo "🔧 Custom Domain Setup Script"
echo "=============================="
echo ""

# Get CloudFront distribution domain
echo "📋 Getting CloudFront distribution domain..."
CF_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
  --output text \
  --region $REGION 2>/dev/null || echo "")

if [ -z "$CF_DOMAIN" ]; then
  echo "❌ Could not find CloudFront distribution. Is infrastructure deployed?"
  exit 1
fi

echo "✅ CloudFront Domain: $CF_DOMAIN"
echo ""

# Check for existing ACM certificate
echo "🔍 Checking for existing ACM certificate..."
CERT_ARN=$(aws acm list-certificates \
  --region $REGION \
  --query "CertificateSummaryList[?DomainName=='$DOMAIN' || DomainName=='$ASSETS_DOMAIN' || contains(SubjectAlternativeNameSummaries[0], '$DOMAIN')].CertificateArn" \
  --output text \
  --region $REGION 2>/dev/null | head -1 || echo "")

if [ -n "$CERT_ARN" ]; then
  echo "✅ Found existing certificate: $CERT_ARN"
  CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region $REGION \
    --query 'Certificate.Status' \
    --output text 2>/dev/null || echo "UNKNOWN")
  echo "   Status: $CERT_STATUS"
  
  if [ "$CERT_STATUS" != "ISSUED" ]; then
    echo "⚠️  Certificate is not issued yet. Please validate it first."
    echo "   Go to: https://console.aws.amazon.com/acm/home?region=$REGION"
  fi
else
  echo "❌ No certificate found. Creating one..."
  echo ""
  echo "📝 To create a certificate:"
  echo "   1. Go to: https://console.aws.amazon.com/acm/home?region=$REGION"
  echo "   2. Click 'Request a certificate'"
  echo "   3. Choose 'Request a public certificate'"
  echo "   4. Add domains: $DOMAIN, $ASSETS_DOMAIN"
  echo "   5. Choose 'DNS validation'"
  echo "   6. Add the CNAME records shown to Cloudflare DNS"
  echo "   7. Wait for validation (usually 5-10 minutes)"
  echo ""
  echo "   Or run: aws acm request-certificate \\"
  echo "     --domain-name $DOMAIN \\"
  echo "     --subject-alternative-names $ASSETS_DOMAIN \\"
  echo "     --validation-method DNS \\"
  echo "     --region $REGION"
fi

echo ""
echo "📋 Current Configuration:"
echo "   • DNS Record: forms.mycoursecreator360.com → $CF_DOMAIN ✓"
echo "   • CloudFront: Custom domain NOT configured ❌"
echo ""
echo "🚀 To complete setup:"
echo ""
echo "   1. Set environment variables:"
echo "      export CLOUDFRONT_CUSTOM_DOMAIN_NAMES=\"$DOMAIN,$ASSETS_DOMAIN\""
if [ -n "$CERT_ARN" ]; then
  echo "      export CLOUDFRONT_CUSTOM_CERTIFICATE_ARN=\"$CERT_ARN\""
else
  echo "      export CLOUDFRONT_CUSTOM_CERTIFICATE_ARN=\"<your-cert-arn>\""
fi
echo "      export CLOUDFRONT_DOMAIN=\"$ASSETS_DOMAIN\""
echo ""
echo "   2. Deploy infrastructure:"
echo "      cd infrastructure"
echo "      npm run deploy"
echo ""
echo "   3. Wait for CloudFront distribution to update (5-10 minutes)"
echo ""
echo "   4. DNS should propagate automatically (Cloudflare DNS-only records)"
echo ""
