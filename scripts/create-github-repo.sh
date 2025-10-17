#!/bin/bash
set -e

echo "🚀 Creating GitHub Repository..."
echo ""

REPO_NAME="lead-magnet-ai-platform"
DESCRIPTION="Multi-tenant AI-powered lead magnet generation platform with OpenAI, AWS, and Next.js"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo ""
    echo "Please install it:"
    echo "  brew install gh"
    echo ""
    echo "Or create repository manually:"
    echo "  1. Go to https://github.com/new"
    echo "  2. Repository name: $REPO_NAME"
    echo "  3. Description: $DESCRIPTION"
    echo "  4. Create repository"
    echo "  5. Run: git remote add origin https://github.com/YOUR_USERNAME/$REPO_NAME.git"
    echo "  6. Run: git push -u origin main"
    exit 1
fi

# Authenticate if needed
if ! gh auth status &> /dev/null; then
    echo "Please authenticate with GitHub..."
    gh auth login
fi

# Create repository
echo "Creating repository: $REPO_NAME"
gh repo create "$REPO_NAME" \
    --public \
    --description "$DESCRIPTION" \
    --source=. \
    --remote=origin \
    --push

echo ""
echo "✅ Repository created and code pushed!"
echo ""
echo "🔗 View your repository:"
gh repo view --web

echo ""
echo "Next steps:"
echo "1. Configure GitHub secrets for CI/CD"
echo "2. Enable GitHub Actions"
echo "3. Deploy via GitHub Actions or continue with AWS Amplify"

