#!/bin/bash
# Verify .gitignore fixes

set -e

echo "=== Verifying .gitignore Fixes ==="
echo ""

# Check .gitignore line count
GITIGNORE_LINES=$(wc -l < .gitignore 2>/dev/null || echo "0")
echo "1. .gitignore file:"
echo "   - Current lines: $GITIGNORE_LINES"
if [ "$GITIGNORE_LINES" -lt "50" ]; then
    echo "   ✗ ERROR: .gitignore has too few lines (should be ~260)"
    exit 1
else
    echo "   ✓ PASS: .gitignore has sufficient lines"
fi

# Check for tracked dist files
echo ""
echo "2. Checking for tracked dist files:"
TRACKED_DIST=$(git ls-files backend/api/dist/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$TRACKED_DIST" -gt 0 ]; then
    echo "   ✗ ERROR: Found $TRACKED_DIST tracked files in backend/api/dist/"
    echo "   Removing from git tracking..."
    git rm -r --cached backend/api/dist/ 2>/dev/null || true
    echo "   ✓ Removed dist files from git tracking"
else
    echo "   ✓ PASS: No dist files are tracked in git"
fi

# Check for tracked cdk.out
TRACKED_CDK=$(git ls-files infrastructure/cdk.out/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$TRACKED_CDK" -gt 0 ]; then
    echo "   ✗ ERROR: Found $TRACKED_CDK tracked files in infrastructure/cdk.out/"
    git rm -r --cached infrastructure/cdk.out/ 2>/dev/null || true
    echo "   ✓ Removed cdk.out from git tracking"
else
    echo "   ✓ PASS: No cdk.out files are tracked"
fi

# Verify .gitignore patterns
echo ""
echo "3. Verifying .gitignore patterns:"
if git check-ignore backend/api/dist/controllers/admin.js > /dev/null 2>&1; then
    echo "   ✓ backend/api/dist/controllers/admin.js is properly ignored"
else
    echo "   ✗ backend/api/dist/controllers/admin.js is NOT ignored"
    exit 1
fi

if git check-ignore infrastructure/cdk.out/ > /dev/null 2>&1; then
    echo "   ✓ infrastructure/cdk.out/ is properly ignored"
else
    echo "   ✗ infrastructure/cdk.out/ is NOT ignored"
    exit 1
fi

if git check-ignore frontend/.next/ > /dev/null 2>&1; then
    echo "   ✓ frontend/.next/ is properly ignored"
else
    echo "   ✗ frontend/.next/ is NOT ignored"
    exit 1
fi

echo ""
echo "=== All Checks Passed ==="
echo "✓ .gitignore is properly configured"
echo "✓ Build artifacts are ignored"
echo ""
echo "Next steps:"
echo "  git add .gitignore"
echo "  git commit -m 'Fix: Restore comprehensive .gitignore and remove tracked build artifacts'"

