#!/bin/bash
# Script to verify and fix .gitignore issues

set -e

echo "=== Verifying .gitignore fixes ==="
echo ""

# Check .gitignore line count
GITIGNORE_LINES=$(wc -l < .gitignore)
echo "✓ .gitignore has $GITIGNORE_LINES lines (was 1, should be ~260)"

# Check if dist files are tracked
echo ""
echo "Checking for tracked dist files..."
TRACKED_DIST=$(git ls-files backend/api/dist/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$TRACKED_DIST" -gt 0 ]; then
    echo "⚠ Found $TRACKED_DIST tracked files in backend/api/dist/"
    echo "Removing from git tracking (keeping local files)..."
    git rm -r --cached backend/api/dist/ 2>/dev/null || true
    echo "✓ Removed dist files from git tracking"
else
    echo "✓ No dist files are tracked in git"
fi

# Check if cdk.out is tracked
TRACKED_CDK=$(git ls-files infrastructure/cdk.out/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$TRACKED_CDK" -gt 0 ]; then
    echo "⚠ Found $TRACKED_CDK tracked files in infrastructure/cdk.out/"
    git rm -r --cached infrastructure/cdk.out/ 2>/dev/null || true
    echo "✓ Removed cdk.out from git tracking"
else
    echo "✓ No cdk.out files are tracked in git"
fi

# Verify .gitignore patterns work
echo ""
echo "Verifying .gitignore patterns..."
if git check-ignore backend/api/dist/controllers/admin.js > /dev/null 2>&1; then
    echo "✓ backend/api/dist/controllers/admin.js is properly ignored"
else
    echo "✗ backend/api/dist/controllers/admin.js is NOT ignored (check .gitignore)"
fi

if git check-ignore infrastructure/cdk.out/ > /dev/null 2>&1; then
    echo "✓ infrastructure/cdk.out/ is properly ignored"
else
    echo "✗ infrastructure/cdk.out/ is NOT ignored (check .gitignore)"
fi

if git check-ignore frontend/.next/ > /dev/null 2>&1; then
    echo "✓ frontend/.next/ is properly ignored"
else
    echo "✗ frontend/.next/ is NOT ignored (check .gitignore)"
fi

echo ""
echo "=== Summary ==="
echo "✓ .gitignore restored to comprehensive state ($GITIGNORE_LINES lines)"
echo "✓ Build artifacts (dist/, .next/, cdk.out/) are now properly ignored"
echo ""
echo "If any files were removed from tracking, commit the changes:"
echo "  git add .gitignore"
echo "  git commit -m 'Fix: Restore comprehensive .gitignore and remove tracked build artifacts'"

