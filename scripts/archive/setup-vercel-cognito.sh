#!/bin/bash
set -e

echo "🔧 Setting up Vercel Cognito Environment Variables..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm i -g vercel
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first."
    exit 1
fi

# Get AWS region
AWS_REGION=${AWS_REGION:-us-east-1}
echo "Using AWS Region: $AWS_REGION"
echo ""

# Get Cognito values from CloudFormation stack
echo "📋 Fetching Cognito values from AWS..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name leadmagnet-auth \
    --region $AWS_REGION \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
    --output text 2>/dev/null || echo "")

CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name leadmagnet-auth \
    --region $AWS_REGION \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
    --output text 2>/dev/null || echo "")

# Get API URL from CloudFormation stack
API_URL=$(aws cloudformation describe-stacks \
    --stack-name leadmagnet-api \
    --region $AWS_REGION \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text 2>/dev/null || echo "")

# Check if values were found
if [ -z "$USER_POOL_ID" ] || [ -z "$CLIENT_ID" ]; then
    echo "⚠️  Warning: Could not fetch Cognito values from CloudFormation."
    echo "   Trying to read from frontend/.env.local..."
    
    if [ -f frontend/.env.local ]; then
        source frontend/.env.local
        USER_POOL_ID=${NEXT_PUBLIC_COGNITO_USER_POOL_ID:-$USER_POOL_ID}
        CLIENT_ID=${NEXT_PUBLIC_COGNITO_CLIENT_ID:-$CLIENT_ID}
        API_URL=${NEXT_PUBLIC_API_URL:-$API_URL}
        AWS_REGION=${NEXT_PUBLIC_AWS_REGION:-$AWS_REGION}
    else
        echo "❌ frontend/.env.local not found!"
        echo ""
        echo "Please provide values manually:"
        read -p "Cognito User Pool ID: " USER_POOL_ID
        read -p "Cognito Client ID: " CLIENT_ID
        read -p "API URL: " API_URL
        read -p "AWS Region [us-east-1]: " AWS_REGION_INPUT
        AWS_REGION=${AWS_REGION_INPUT:-us-east-1}
    fi
fi

# Use default API URL if not found
if [ -z "$API_URL" ]; then
    echo "⚠️  API URL not found. Using default..."
    API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
fi

# Verify values
if [ -z "$USER_POOL_ID" ] || [ -z "$CLIENT_ID" ]; then
    echo "❌ Error: Missing required values!"
    echo "   USER_POOL_ID: $USER_POOL_ID"
    echo "   CLIENT_ID: $CLIENT_ID"
    exit 1
fi

echo "✅ Found values:"
echo "   USER_POOL_ID: $USER_POOL_ID"
echo "   CLIENT_ID: $CLIENT_ID"
echo "   API_URL: $API_URL"
echo "   AWS_REGION: $AWS_REGION"
echo ""

# Ask for confirmation
read -p "Set these values in Vercel? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "📝 Setting environment variables in Vercel..."

# Set environment variables
echo "$API_URL" | vercel env add NEXT_PUBLIC_API_URL production --force
echo "$USER_POOL_ID" | vercel env add NEXT_PUBLIC_COGNITO_USER_POOL_ID production --force
echo "$CLIENT_ID" | vercel env add NEXT_PUBLIC_COGNITO_CLIENT_ID production --force
echo "$AWS_REGION" | vercel env add NEXT_PUBLIC_AWS_REGION production --force

echo ""
echo "✅ Environment variables set successfully!"
echo ""
echo "🚀 Next steps:"
echo "   1. Redeploy your Vercel app: vercel --prod"
echo "   2. Or trigger a new deployment from the Vercel dashboard"
echo ""

