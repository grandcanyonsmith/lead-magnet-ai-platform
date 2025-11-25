#!/bin/bash
# Script to import existing WebhookLogsTable into CloudFormation before deployment

set -e

STACK_NAME="leadmagnet-database"
CHANGE_SET_NAME="import-webhook-logs-$(date +%s)"

echo "Importing existing WebhookLogsTable into CloudFormation..."
echo ""

cd infrastructure

echo "Step 1: Synthesizing CDK template..."
# Use cdk synth with output to file, then extract Resources section
TEMPLATE_YAML=$(mktemp).yaml
npx cdk synth LeadMagnetDatabaseStack > "$TEMPLATE_YAML" 2>&1

# Extract Resources section and create minimal template
python3 << 'PYTHON'
import yaml
import json
import sys
import re

with open('$TEMPLATE_YAML', 'r') as f:
    content = f.read()

# Find Resources section
resources_match = re.search(r'^Resources:\s*\n(.*?)(?=\n\S|\Z)', content, re.MULTILINE | re.DOTALL)
if not resources_match:
    print("Error: Could not find Resources section", file=sys.stderr)
    sys.exit(1)

resources_content = "Resources:\n" + resources_match.group(1)

# Create minimal template
template = {
    'AWSTemplateFormatVersion': '2010-09-09',
    'Description': 'Import WebhookLogsTable',
}

# Parse Resources
try:
    resources_data = yaml.safe_load(resources_content)
    template['Resources'] = resources_data.get('Resources', {})
except Exception as e:
    print(f"Error parsing Resources: {e}", file=sys.stderr)
    sys.exit(1)

# Verify WebhookLogsTable exists
if 'WebhookLogsTable36D67CC7' not in template['Resources']:
    print("Error: WebhookLogsTable36D67CC7 not found in Resources", file=sys.stderr)
    sys.exit(1)

template_json = json.dumps(template)
print(template_json)
PYTHON
) > /tmp/database-template.json

if [ ! -s /tmp/database-template.json ]; then
    echo "❌ Error: Template conversion failed"
    exit 1
fi

echo "✅ Template synthesized and converted to JSON: /tmp/database-template.json"

echo ""
echo "Step 2: Creating import change set..."
IMPORT_RESOURCES='[
  {
    "ResourceType": "AWS::DynamoDB::Table",
    "LogicalResourceId": "WebhookLogsTable36D67CC7",
    "ResourceIdentifier": {
      "TableName": "leadmagnet-webhook-logs"
    }
  }
]'

aws cloudformation create-change-set \
  --stack-name "$STACK_NAME" \
  --change-set-name "$CHANGE_SET_NAME" \
  --change-set-type IMPORT \
  --resources-to-import "$IMPORT_RESOURCES" \
  --template-body "file:///tmp/database-template.json" \
  --capabilities CAPABILITY_IAM

echo ""
echo "✅ Change set created: $CHANGE_SET_NAME"
echo ""
echo "Step 3: Waiting for change set to be ready..."
sleep 5

echo ""
echo "Step 4: Executing change set..."
aws cloudformation execute-change-set \
  --stack-name "$STACK_NAME" \
  --change-set-name "$CHANGE_SET_NAME"

echo ""
echo "✅ Change set executed. Waiting for import to complete..."
echo "   Check status with: aws cloudformation describe-stacks --stack-name $STACK_NAME"
echo ""
echo "After import completes, regular CDK deployments will work."
