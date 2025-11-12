#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}Lead Magnet AI - Webhook Implementation Validation${NC}"
echo "========================================================"
echo ""

# Check if required files exist
echo -e "${BLUE}Checking implementation files...${NC}"
echo ""

FILES_TO_CHECK=(
  "backend/api/src/utils/webhookToken.ts"
  "backend/api/src/controllers/webhooks.ts"
  "backend/api/src/controllers/settings.ts"
  "backend/api/src/routes.ts"
  "backend/api/src/utils/validation.ts"
)

ALL_EXIST=true
for file in "${FILES_TO_CHECK[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
  else
    echo -e "${RED}✗${NC} $file (missing)"
    ALL_EXIST=false
  fi
done

if [ "$ALL_EXIST" = false ]; then
  echo -e "\n${RED}Some required files are missing!${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ All required files exist${NC}"
echo ""

# Check for key functions/classes
echo -e "${BLUE}Checking key implementation components...${NC}"
echo ""

# Check webhookToken.ts
if grep -q "generateWebhookToken" backend/api/src/utils/webhookToken.ts; then
  echo -e "${GREEN}✓${NC} generateWebhookToken function exists"
else
  echo -e "${RED}✗${NC} generateWebhookToken function missing"
fi

# Check webhooks controller
if grep -q "handleWebhook" backend/api/src/controllers/webhooks.ts; then
  echo -e "${GREEN}✓${NC} handleWebhook method exists"
else
  echo -e "${RED}✗${NC} handleWebhook method missing"
fi

if grep -q "findUserByWebhookToken" backend/api/src/controllers/webhooks.ts; then
  echo -e "${GREEN}✓${NC} findUserByWebhookToken method exists"
else
  echo -e "${RED}✗${NC} findUserByWebhookToken method missing"
fi

# Check settings controller
if grep -q "regenerateWebhookToken" backend/api/src/controllers/settings.ts; then
  echo -e "${GREEN}✓${NC} regenerateWebhookToken method exists"
else
  echo -e "${RED}✗${NC} regenerateWebhookToken method missing"
fi

if grep -q "getWebhookUrl" backend/api/src/controllers/settings.ts; then
  echo -e "${GREEN}✓${NC} getWebhookUrl method exists"
else
  echo -e "${RED}✗${NC} getWebhookUrl method missing"
fi

if grep -q "webhook_token" backend/api/src/controllers/settings.ts; then
  echo -e "${GREEN}✓${NC} webhook_token auto-generation exists"
else
  echo -e "${RED}✗${NC} webhook_token auto-generation missing"
fi

# Check routes
if grep -q "/v1/webhooks" backend/api/src/routes.ts; then
  echo -e "${GREEN}✓${NC} Webhook route registered"
else
  echo -e "${RED}✗${NC} Webhook route missing"
fi

if grep -q "/admin/settings/webhook" backend/api/src/routes.ts; then
  echo -e "${GREEN}✓${NC} Admin webhook routes registered"
else
  echo -e "${RED}✗${NC} Admin webhook routes missing"
fi

# Check validation schema
if grep -q "webhookRequestSchema" backend/api/src/utils/validation.ts; then
  echo -e "${GREEN}✓${NC} webhookRequestSchema exists"
else
  echo -e "${RED}✗${NC} webhookRequestSchema missing"
fi

echo ""
echo -e "${BLUE}Checking route order (webhook should be before tenantId check)...${NC}"
WEBHOOK_LINE=$(grep -n "/v1/webhooks" backend/api/src/routes.ts | head -1 | cut -d: -f1)
TENANT_CHECK_LINE=$(grep -n "All admin routes require tenantId" backend/api/src/routes.ts | head -1 | cut -d: -f1)

if [ -n "$WEBHOOK_LINE" ] && [ -n "$TENANT_CHECK_LINE" ] && [ "$WEBHOOK_LINE" -lt "$TENANT_CHECK_LINE" ]; then
  echo -e "${GREEN}✓${NC} Webhook route is correctly placed before tenantId check"
  echo "  Webhook route: line $WEBHOOK_LINE"
  echo "  Tenant check: line $TENANT_CHECK_LINE"
else
  echo -e "${RED}✗${NC} Webhook route may be after tenantId check (route order issue)"
fi

echo ""
echo -e "${BLUE}Checking validation schema fields...${NC}"
if grep -q "workflow_id.*optional" backend/api/src/utils/validation.ts && grep -q "workflow_name.*optional" backend/api/src/utils/validation.ts; then
  echo -e "${GREEN}✓${NC} Validation schema supports both workflow_id and workflow_name"
else
  echo -e "${YELLOW}⚠${NC} Validation schema may not support both workflow identifiers"
fi

if grep -q "form_data.*optional" backend/api/src/utils/validation.ts || grep -q "submission_data.*optional" backend/api/src/utils/validation.ts; then
  echo -e "${GREEN}✓${NC} Validation schema supports form_data/submission_data"
else
  echo -e "${YELLOW}⚠${NC} Validation schema may not support form_data/submission_data"
fi

echo ""
echo -e "${GREEN}========================================"
echo "Implementation Validation Summary"
echo "========================================${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Deploy the API changes to AWS"
echo "2. Get your webhook token from /admin/settings"
echo "3. Test with: ./scripts/test-webhook.sh"
echo ""
echo -e "${BLUE}Deployment Command:${NC}"
echo "  cd infrastructure && npm run deploy"
echo "  # OR"
echo "  cd backend/api && npm run build && deploy-api.sh"
echo ""
echo -e "${GREEN}✓ Implementation validation completed${NC}"
echo ""

