#!/bin/bash
# Check deployment status and view logs

FUNCTION_NAME="leadmagnet-compute-JobProcessorLambda4949D7F4-QfZWMq9MkyHG"
LOG_GROUP="/aws/lambda/leadmagnet-job-processor"

echo "📊 Checking deployment status..."
STATUS=$(aws lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region us-east-1 \
    --query 'Configuration.LastUpdateStatus' \
    --output text)

echo "Status: $STATUS"
echo ""

if [ "$STATUS" == "Successful" ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "To view logs:"
    echo "  aws logs tail $LOG_GROUP --follow --region us-east-1"
    echo ""
    echo "To search for webhook artifact logs:"
    echo "  aws logs filter-log-events --log-group-name $LOG_GROUP --filter-pattern 'Artifact URLs in payload' --region us-east-1"
else
    echo "⏳ Deployment still in progress..."
    echo "Run this script again in a few seconds to check status."
fi















