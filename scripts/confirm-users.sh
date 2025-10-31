#!/bin/bash

# Script to confirm all unconfirmed users in Cognito User Pool
# Usage: ./scripts/confirm-users.sh [email]

set -e

USER_POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_asu0YOrBD}"
EMAIL="${1:-}"

if [ -z "$EMAIL" ]; then
  echo "Usage: $0 <email>"
  echo "Example: $0 canyon@coursecreator360.com"
  exit 1
fi

echo "Confirming user: $EMAIL"
echo "User Pool: $USER_POOL_ID"

aws cognito-idp admin-confirm-sign-up \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --region us-east-1

echo "✅ User $EMAIL has been confirmed and can now sign in!"

