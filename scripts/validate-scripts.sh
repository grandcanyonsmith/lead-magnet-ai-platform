#!/bin/bash
# Script validation tool
# Checks for common issues: hardcoded values, missing imports, consistency

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/shell_common.sh"

show_header "Script Validation Tool" "Checking scripts for common issues"

ERRORS=0
WARNINGS=0

# Check Python scripts
check_python_script() {
    local script="$1"
    local issues=0
    
    # Check for hardcoded table names
    if grep -qE "(leadmagnet-(jobs|workflows|forms|submissions|artifacts|templates|users|customers))" "$script" 2>/dev/null; then
        print_error "$script: Contains hardcoded table name"
        issues=$((issues + 1))
    fi
    
    # Check for hardcoded regions
    if grep -qE "region.*=.*['\"]us-east-1['\"]" "$script" 2>/dev/null; then
        print_warning "$script: Contains hardcoded region (may be intentional)"
        issues=$((issues + 1))
    fi
    
    # Check for missing lib.common import
    if grep -qE "^import sys|^from pathlib import Path" "$script" 2>/dev/null; then
        if ! grep -qE "from lib.common import|from lib import common" "$script" 2>/dev/null; then
            print_warning "$script: Uses sys.path but may not import from lib.common"
            issues=$((issues + 1))
        fi
    fi
    
    # Check for missing argparse
    if grep -qE "sys.argv\[|if __name__ == \"__main__\"" "$script" 2>/dev/null; then
        if ! grep -qE "import argparse|ArgumentParser" "$script" 2>/dev/null; then
            print_warning "$script: Uses sys.argv but may not use argparse"
            issues=$((issues + 1))
        fi
    fi
    
    # Check for duplicate convert_decimals
    if grep -qE "def convert_decimals" "$script" 2>/dev/null; then
        print_error "$script: Defines convert_decimals (should use lib.common)"
        issues=$((issues + 1))
    fi
    
    return $issues
}

# Check TypeScript scripts
check_typescript_script() {
    local script="$1"
    local issues=0
    
    # Check for hardcoded table names
    if grep -qE "(leadmagnet-(jobs|workflows|forms|submissions|artifacts|templates|users|customers))" "$script" 2>/dev/null; then
        print_error "$script: Contains hardcoded table name"
        issues=$((issues + 1))
    fi
    
    # Check for hardcoded regions
    if grep -qE "AWS_REGION.*=.*['\"]us-east-1['\"]" "$script" 2>/dev/null; then
        print_warning "$script: Contains hardcoded region (may be intentional)"
        issues=$((issues + 1))
    fi
    
    # Check for missing lib/common import
    if grep -qE "DynamoDBClient|S3Client" "$script" 2>/dev/null; then
        if ! grep -qE "from.*lib/common|from.*lib\.common" "$script" 2>/dev/null; then
            print_warning "$script: Uses AWS clients but may not import from lib/common"
            issues=$((issues + 1))
        fi
    fi
    
    return $issues
}

# Check shell scripts
check_shell_script() {
    local script="$1"
    local issues=0
    
    # Check for sourcing shell_common.sh
    if ! grep -qE "source.*shell_common\.sh" "$script" 2>/dev/null; then
        print_warning "$script: May not source shell_common.sh"
        issues=$((issues + 1))
    fi
    
    # Check for hardcoded regions
    if grep -qE "AWS_REGION.*=.*us-east-1" "$script" 2>/dev/null && ! grep -qE "get_aws_region" "$script" 2>/dev/null; then
        print_warning "$script: Contains hardcoded region"
        issues=$((issues + 1))
    fi
    
    # Check for error handling
    if ! grep -qE "set -e" "$script" 2>/dev/null; then
        print_warning "$script: May not have error handling (set -e)"
        issues=$((issues + 1))
    fi
    
    return $issues
}

# Find all scripts
print_subsection "Checking Python Scripts"
PYTHON_SCRIPTS=$(find "$SCRIPT_DIR" -name "*.py" -type f ! -path "*/lib/*" ! -path "*/__pycache__/*" ! -path "*/node_modules/*")
for script in $PYTHON_SCRIPTS; do
    rel_path="${script#$SCRIPT_DIR/}"
    if check_python_script "$script"; then
        ERRORS=$((ERRORS + $?))
    fi
done

print_subsection "Checking TypeScript Scripts"
TS_SCRIPTS=$(find "$SCRIPT_DIR" -name "*.ts" -type f ! -path "*/lib/*" ! -path "*/node_modules/*")
for script in $TS_SCRIPTS; do
    rel_path="${script#$SCRIPT_DIR/}"
    if check_typescript_script "$script"; then
        ERRORS=$((ERRORS + $?))
    fi
done

print_subsection "Checking Shell Scripts"
SHELL_SCRIPTS=$(find "$SCRIPT_DIR" -name "*.sh" -type f ! -path "*/lib/*")
for script in $SHELL_SCRIPTS; do
    rel_path="${script#$SCRIPT_DIR/}"
    if check_shell_script "$script"; then
        WARNINGS=$((WARNINGS + $?))
    fi
done

# Summary
print_section "Validation Summary"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    print_success "All scripts passed validation!"
    exit 0
else
    print_warning "Found $ERRORS error(s) and $WARNINGS warning(s)"
    if [ $ERRORS -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
fi

