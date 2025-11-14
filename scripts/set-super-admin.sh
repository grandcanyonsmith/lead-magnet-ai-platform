#!/bin/bash

# Script to set SUPER_ADMIN role for canyon@coursecreator360.com
# This script updates both DynamoDB and Cognito

set -e

EMAIL="canyon@coursecreator360.com"
USERS_TABLE="${USERS_TABLE:-leadmagnet-users}"
USER_POOL_ID="${COGNITO_USER_POOL_ID:-${USER_POOL_ID}}"

if [ -z "$USER_POOL_ID" ]; then
  echo "Error: COGNITO_USER_POOL_ID or USER_POOL_ID environment variable is required"
  exit 1
fi

echo "Setting SUPER_ADMIN role for $EMAIL..."

# Step 1: Find user in DynamoDB
echo "Step 1: Searching for user in DynamoDB..."
USER_ID=$(aws dynamodb scan \
  --table-name "$USERS_TABLE" \
  --filter-expression "email = :email" \
  --expression-attribute-values "{\":email\":{\"S\":\"$EMAIL\"}}" \
  --query "Items[0].user_id.S" \
  --output text 2>/dev/null || echo "")

if [ -z "$USER_ID" ] || [ "$USER_ID" == "None" ]; then
  echo "Error: User not found in DynamoDB with email: $EMAIL"
  echo "Note: User must exist in DynamoDB first."
  exit 1
fi

echo "Found user_id: $USER_ID"

# Step 2: Update DynamoDB user record
echo "Step 2: Updating user role in DynamoDB..."
aws dynamodb update-item \
  --table-name "$USERS_TABLE" \
  --key "{\"user_id\":{\"S\":\"$USER_ID\"}}" \
  --update-expression "SET #role = :role, updated_at = :updated_at" \
  --expression-attribute-names "{\"#role\":\"role\"}" \
  --expression-attribute-values "{\":role\":{\"S\":\"SUPER_ADMIN\"},\":updated_at\":{\"S\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}}" \
  > /dev/null

echo "✓ Updated DynamoDB user record"

# Step 3: Update Cognito custom attribute
echo "Step 3: Updating Cognito custom:role attribute..."

# Get Cognito username (try email first, then search)
COGNITO_USERNAME="$EMAIL"

# Try to update using email as username
aws cognito-idp admin-update-user-attributes \
  --user-pool-id "$USER_POOL_ID" \
  --username "$COGNITO_USERNAME" \
  --user-attributes Name=custom:role,Value=SUPER_ADMIN \
  2>/dev/null || {
  echo "Warning: Could not update Cognito user with email as username, trying to find username..."
  
  # List users and find by email
  COGNITO_USERNAME=$(aws cognito-idp list-users \
    --user-pool-id "$USER_POOL_ID" \
    --filter "email = \"$EMAIL\"" \
    --query "Users[0].Username" \
    --output text 2>/dev/null || echo "")
  
  if [ -z "$COGNITO_USERNAME" ] || [ "$COGNITO_USERNAME" == "None" ]; then
    echo "Error: User not found in Cognito with email: $EMAIL"
    echo "Note: User must exist in Cognito first."
    exit 1
  fi
  
  # Update with found username
  aws cognito-idp admin-update-user-attributes \
    --user-pool-id "$USER_POOL_ID" \
    --username "$COGNITO_USERNAME" \
    --user-attributes Name=custom:role,Value=SUPER_ADMIN \
    > /dev/null
}

echo "✓ Updated Cognito custom:role attribute"

echo ""
echo "✅ Successfully set SUPER_ADMIN role for $EMAIL"
echo "   - DynamoDB user_id: $USER_ID"
echo "   - Cognito username: $COGNITO_USERNAME"
echo ""
echo "Note: User may need to log out and log back in for changes to take effect."

