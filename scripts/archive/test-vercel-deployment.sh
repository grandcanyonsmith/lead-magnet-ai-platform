#!/bin/bash
set -e

VERCEL_URL="https://lead-magnet-ai-platform-frontend.vercel.app"
API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"

echo "🧪 Testing Vercel Deployment"
echo "================================"
echo ""

echo "1. Testing Frontend Accessibility..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL")
if [ "$FRONTEND_STATUS" = "200" ]; then
  echo "✅ Frontend is accessible (HTTP $FRONTEND_STATUS)"
else
  echo "❌ Frontend returned HTTP $FRONTEND_STATUS"
fi
echo ""

echo "2. Testing Login Page..."
LOGIN_HTML=$(curl -s "$VERCEL_URL/auth/login")
if echo "$LOGIN_HTML" | grep -q "Lead Magnet AI"; then
  echo "✅ Login page loads correctly"
else
  echo "❌ Login page not loading correctly"
fi
echo ""

echo "3. Testing API Gateway Connectivity..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/admin/workflows")
if [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "200" ]; then
  echo "✅ API Gateway is accessible (HTTP $API_STATUS - expected without auth)"
else
  echo "❌ API Gateway returned HTTP $API_STATUS"
fi
echo ""

echo "4. Testing CORS Configuration..."
CORS_HEADERS=$(curl -s -X OPTIONS "$API_URL/admin/workflows" \
  -H "Origin: $VERCEL_URL" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  -v 2>&1 | grep -i "access-control")
if [ -n "$CORS_HEADERS" ]; then
  echo "✅ CORS headers present"
  echo "$CORS_HEADERS"
else
  echo "⚠️  CORS headers not found (may need configuration)"
fi
echo ""

echo "5. Checking Environment Variables..."
echo "Required Vercel Environment Variables:"
echo "  - NEXT_PUBLIC_API_URL=$API_URL"
echo "  - NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_asu0YOrBD"
echo "  - NEXT_PUBLIC_COGNITO_CLIENT_ID=4lb3j8kqfvfgkvfeb4h4naani5"
echo "  - NEXT_PUBLIC_AWS_REGION=us-east-1"
echo ""

echo "6. Testing Dashboard Route..."
DASHBOARD_HTML=$(curl -s "$VERCEL_URL/dashboard")
if echo "$DASHBOARD_HTML" | grep -q "Lead Magnet"; then
  echo "✅ Dashboard route accessible"
else
  echo "⚠️  Dashboard route may require authentication"
fi
echo ""

echo "================================"
echo "✅ Basic connectivity tests complete!"
echo ""
echo "Next steps:"
echo "1. Verify environment variables are set in Vercel dashboard"
echo "2. Test authentication flow"
echo "3. Test API calls after login"
echo ""

