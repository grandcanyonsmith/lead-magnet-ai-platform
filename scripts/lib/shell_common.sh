#!/bin/bash
# Shared shell utilities for Lead Magnet AI scripts
# Source this file in your scripts: source "$(dirname "$0")/lib/shell_common.sh"

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}" >&2
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_section() {
    local title="$1"
    local width="${2:-80}"
    echo ""
    echo -e "${GREEN}$(printf '=%.0s' $(seq 1 $width))${NC}"
    echo -e "${GREEN}$title${NC}"
    echo -e "${GREEN}$(printf '=%.0s' $(seq 1 $width))${NC}"
    echo ""
}

print_subsection() {
    local title="$1"
    local width="${2:-80}"
    echo ""
    echo -e "${CYAN}$(printf '-%.0s' $(seq 1 $width))${NC}"
    echo -e "${CYAN}$title${NC}"
    echo -e "${CYAN}$(printf '-%.0s' $(seq 1 $width))${NC}"
    echo ""
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    local missing=()
    
    for cmd in "$@"; do
        if ! command_exists "$cmd"; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        print_error "Missing required commands: ${missing[*]}"
        return 1
    fi
    
    return 0
}

# Get AWS region from environment or default
get_aws_region() {
    echo "${AWS_REGION:-us-east-1}"
}

# Get AWS account ID
get_aws_account_id() {
    aws sts get-caller-identity --query Account --output text 2>/dev/null
}

# Get CloudFormation stack output
get_stack_output() {
    local stack_name="$1"
    local output_key="$2"
    local region="${3:-$(get_aws_region)}"
    
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$region" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text 2>/dev/null
}

# Get all stack outputs as associative array (bash 4+)
get_all_stack_outputs() {
    local stack_name="$1"
    local region="${2:-$(get_aws_region)}"
    
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$region" \
        --query "Stacks[0].Outputs" \
        --output json 2>/dev/null | \
        jq -r '.[] | "\(.OutputKey)=\(.OutputValue)"' 2>/dev/null
}

# Check if AWS credentials are configured
check_aws_credentials() {
    if ! aws sts get-caller-identity &>/dev/null; then
        print_warning "AWS credentials not configured"
        return 1
    fi
    return 0
}

# Get API URL from environment or CloudFormation
get_api_url() {
    if [ -n "$API_URL" ]; then
        echo "$API_URL"
        return
    fi
    
    # Try to get from CloudFormation
    local api_url
    api_url=$(get_stack_output "leadmagnet-api" "ApiUrl" 2>/dev/null)
    
    if [ -n "$api_url" ] && [ "$api_url" != "None" ]; then
        echo "$api_url"
        return
    fi
    
    # Default fallback
    echo "https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
}

# Wait for a condition with timeout
wait_for_condition() {
    local condition_cmd="$1"
    local timeout="${2:-300}"
    local interval="${3:-5}"
    local description="${4:-condition}"
    
    local elapsed=0
    
    print_info "Waiting for $description (timeout: ${timeout}s)..."
    
    while [ $elapsed -lt $timeout ]; do
        if eval "$condition_cmd"; then
            print_success "$description met"
            return 0
        fi
        
        sleep "$interval"
        elapsed=$((elapsed + interval))
        echo -n "."
    done
    
    echo ""
    print_error "Timeout waiting for $description"
    return 1
}

# Parse command line arguments (simple version)
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                if [ -n "$SCRIPT_HELP" ]; then
                    echo "$SCRIPT_HELP"
                else
                    echo "Usage: $0 [options]"
                fi
                exit 0
                ;;
            --region)
                export AWS_REGION="$2"
                shift 2
                ;;
            --region=*)
                export AWS_REGION="${1#*=}"
                shift
                ;;
            *)
                # Unknown option, pass through
                shift
                ;;
        esac
    done
}

# Show script header
show_header() {
    local title="$1"
    local description="${2:-}"
    
    print_section "$title"
    if [ -n "$description" ]; then
        echo "$description"
        echo ""
    fi
}

