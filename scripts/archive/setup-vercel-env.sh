#!/bin/bash
set -e

echo "🔧 Setting up Vercel Environment Variables..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm i -g vercel
fi

# Load environment variables from .env
if [ -f .env ]; then
    source .env
else
    echo "❌ .env file not found!"
    exit 1
fi

# Get frontend env vars from .env.local
if [ -f frontend/.env.local ]; then
    source frontend/.env.local
else
    echo "❌ frontend/.env.local file not found!"
    exit 1
fi

echo "📝 Setting production environment variables in Vercel..."

# Set all required environment variables
vercel env add NEXT_PUBLIC_API_URL production --force <<< "$NEXT_PUBLIC_API_URL"
vercel env add NEXT_PUBLIC_COGNITO_USER_POOL_ID production --force <<< "$NEXT_PUBLIC_COGNITO_USER_POOL_ID"
vercel env add NEXT_PUBLIC_COGNITO_CLIENT_ID production --force <<< "$NEXT_PUBLIC_COGNITO_CLIENT_ID"
vercel env add NEXT_PUBLIC_AWS_REGION production --force <<< "$NEXT_PUBLIC_AWS_REGION"

echo ""
echo "✅ Environment variables set successfully!"
echo ""
echo "🔍 Current values:"
echo "   NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
echo "   NEXT_PUBLIC_COGNITO_USER_POOL_ID=$NEXT_PUBLIC_COGNITO_USER_POOL_ID"
echo "   NEXT_PUBLIC_COGNITO_CLIENT_ID=$NEXT_PUBLIC_COGNITO_CLIENT_ID"
echo "   NEXT_PUBLIC_AWS_REGION=$NEXT_PUBLIC_AWS_REGION"
echo ""
echo "🚀 Next steps:"
echo "   1. Run: vercel --prod"
echo "   2. Your app should now have all Cognito credentials!"
echo ""

