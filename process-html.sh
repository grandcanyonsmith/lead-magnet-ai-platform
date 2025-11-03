#!/bin/bash
# Script to process the user's HTML and fix Stripe checkout

echo "Processing HTML template..."
echo "Removing Stripe checkout and replacing with payment link redirects..."

# The user's HTML should be saved to templates/user-html.html
# Then we'll transform it

if [ -f "templates/user-html.html" ]; then
    python3 scripts/fix-template-stripe.py templates/user-html.html templates/sample-template.html
    echo "Done! Fixed template saved to templates/sample-template.html"
else
    echo "Error: templates/user-html.html not found"
    echo "Please save your HTML to that file first"
    exit 1
fi
