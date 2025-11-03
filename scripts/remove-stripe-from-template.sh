#!/bin/bash

# Payment link URL
PAYMENT_LINK="https://my.coursecreator360.com/payment-link/68ca4efd219709817ce1ef20"

# Input file (the user's HTML)
INPUT_FILE="$1"
OUTPUT_FILE="$2"

if [ -z "$INPUT_FILE" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "Usage: $0 <input_file> <output_file>"
    exit 1
fi

# Read the file
CONTENT=$(cat "$INPUT_FILE")

# Remove Stripe JS loading
CONTENT=$(echo "$CONTENT" | sed 's|await loadScript.*stripe.com.*||g')

# Remove Stripe initialization
CONTENT=$(echo "$CONTENT" | sed '/let stripe = null;/,/stripe = Stripe/d')

# Remove session ID fetching block (between "Extract the ai_website_id" and "catch (error)")
CONTENT=$(echo "$CONTENT" | sed '/\/\/ Extract the ai_website_id/,/console.error.*checkout/d')

# Replace all stripe.redirectToCheckout calls with payment link redirect
CONTENT=$(echo "$CONTENT" | sed "s|if (stripe && sessionId) {.*stripe.redirectToCheckout({ sessionId: sessionId });.*} else {.*window.location.href = .*;.*}|window.location.href = \"$PAYMENT_LINK\";|g")

# Replace standalone redirectToCheckout
CONTENT=$(echo "$CONTENT" | sed "s|stripe\.redirectToCheckout({ sessionId: sessionId });|window.location.href = \"$PAYMENT_LINK\";|g")

# Replace fallback URLs
CONTENT=$(echo "$CONTENT" | sed "s|window\.location\.href = 'https://checkout.coursecreator360.com/[^']*';|window.location.href = \"$PAYMENT_LINK\";|g")
CONTENT=$(echo "$CONTENT" | sed "s|window\.location\.href = \"https://checkout.coursecreator360.com/[^\"]*\";|window.location.href = \"$PAYMENT_LINK\";|g")

# Write output
echo "$CONTENT" > "$OUTPUT_FILE"

echo "Transformation complete. Output written to $OUTPUT_FILE"

