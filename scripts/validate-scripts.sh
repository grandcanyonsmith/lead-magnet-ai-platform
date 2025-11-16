#!/bin/bash
# Simplified script validation tool
# Checks for critical issues: hardcoded table names and duplicate functions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/shell_common.sh"

show_header "Script Validation Tool" "Checking scripts for critical issues"

ERRORS=0

# Check Python scripts for critical issues
check_python_script() {
    local script="$1"
    local issues=0
    
    # Check for hardcoded table names (critical)
    if grep -qE "(leadmagnet-(jobs|workflows|forms|submissions|artifacts|templates|users|customers))" "$script" 2>/dev/null; then
        print_error "$script: Contains hardcoded table name"
        issues=$((issues + 1))
    fi
    
    # Check for duplicate convert_decimals (critical)
    if grep -qE "def convert_decimals" "$script" 2>/dev/null; then
        print_error "$script: Defines convert_decimals (should use lib.common)"
        issues=$((issues + 1))
    fi
    
    return $issues
}

# Find all Python scripts
PYTHON_SCRIPTS=$(find "$SCRIPT_DIR" -name "*.py" -type f ! -path "*/lib/*" ! -path "*/__pycache__/*" ! -path "*/node_modules/*")
for script in $PYTHON_SCRIPTS; do
    if check_python_script "$script"; then
        ERRORS=$((ERRORS + $?))
    fi
done

# Summary
print_section "Validation Summary"
if [ $ERRORS -eq 0 ]; then
    print_success "All scripts passed validation!"
    exit 0
else
    print_error "Found $ERRORS error(s)"
    exit 1
fi

