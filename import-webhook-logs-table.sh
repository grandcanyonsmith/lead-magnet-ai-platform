#!/bin/bash
# Script to import existing WebhookLogsTable into CloudFormation

set -e

STACK_NAME="leadmagnet-database"
CHANGE_SET_NAME="import-webhook-logs-$(date +%s)"
TEMPLATE_FILE="/tmp/database-template.yaml"
IMPORT_RESOURCES="/tmp/import-resources.json"

echo "Step 1: Synthesizing CDK template..."
cd infrastructure
npx cdk synth LeadMagnetDatabaseStack --quiet > "$TEMPLATE_FILE" 2>&1
echo "✅ Template synthesized"

echo ""
echo "Step 2: Creating import change set..."
aws cloudformation create-change-set \
  --stack-name "$STACK_NAME" \
  --change-set-name "$CHANGE_SET_NAME" \
  --change-set-type IMPORT \
  --resources-to-import "file://$IMPORT_RESOURCES" \
  --template-body "file://$TEMPLATE_FILE" \
  --capabilities CAPABILITY_IAM

echo ""
echo "✅ Change set created: $CHANGE_SET_NAME"
echo ""
echo "Step 3: Review the change set, then execute it with:"
echo "  aws cloudformation execute-change-set \\"
echo "    --stack-name $STACK_NAME \\"
echo "    --change-set-name $CHANGE_SET_NAME"
echo ""
echo "After import succeeds, you can switch webhook logs back to createTableWithGSI"
