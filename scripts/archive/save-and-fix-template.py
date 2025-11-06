#!/usr/bin/env python3
"""
Master script to save user's HTML and fix Stripe checkout issues.
This script will:
1. Read HTML content (from stdin or file)
2. Remove all Stripe checkout logic
3. Replace all redirects with payment link
4. Save the corrected template
"""

import re
import sys

PAYMENT_LINK = "https://my.coursecreator360.com/payment-link/68ca4efd219709817ce1ef20"

def fix_template(html_content):
    """Remove Stripe checkout and replace with payment link redirects."""
    
    # Remove Stripe JS loading
    html_content = re.sub(
        r'await loadScript\([\'"]https://js\.stripe\.com/v3/[\'"]\);',
        '',
        html_content
    )
    
    # Remove Tailwind CSS loading via script (already loaded via CDN)
    html_content = re.sub(
        r'loadStylesheet\([\'"]https://cdn\.jsdelivr\.net/npm/tailwindcss@2\.2\.19/dist/tailwind\.min\.css[\'"]\);',
        '',
        html_content
    )
    
    # Remove Stripe initialization
    html_content = re.sub(
        r'let stripe = null;.*?if \(typeof Stripe === [\'"]function[\'"]\) \{.*?stripe = Stripe\([^)]+\);.*?\}',
        '',
        html_content,
        flags=re.DOTALL
    )
    
    # Remove session ID fetching (from "Extract the ai_website_id" comment to end of catch block)
    html_content = re.sub(
        r'// Extract the ai_website_id.*?// Attempt to fetch the session ID.*?try \{.*?const requestBody.*?const response = await fetch\([^}]+\}.*?console\.log\([^}]+\} catch \(error\) \{.*?console\.error\([^}]+\}',
        '',
        html_content,
        flags=re.DOTALL
    )
    
    # Remove fallback URL variable
    html_content = re.sub(
        r'const fallbackUrl = [^;]+;',
        '',
        html_content
    )
    
    # Remove sessionId variable declaration
    html_content = re.sub(
        r'let sessionId = null;',
        '',
        html_content
    )
    
    # Replace all conditional redirects with simple payment link redirect
    # Pattern: if (stripe && sessionId) { stripe.redirectToCheckout(...) } else { window.location.href = ... }
    html_content = re.sub(
        r'if\s*\(stripe\s*&&\s*sessionId\)\s*\{[^}]*stripe\.redirectToCheckout\([^}]+\)[^}]*\}\s*else\s*\{[^}]*window\.location\.href\s*=\s*[^;]+;[^}]*\}',
        f'window.location.href = "{PAYMENT_LINK}";',
        html_content,
        flags=re.DOTALL
    )
    
    # Replace standalone stripe.redirectToCheckout calls
    html_content = re.sub(
        r'stripe\.redirectToCheckout\(\{\s*sessionId:\s*sessionId\s*\}\);',
        f'window.location.href = "{PAYMENT_LINK}";',
        html_content
    )
    
    # Replace any remaining fallback URLs
    html_content = re.sub(
        r'window\.location\.href\s*=\s*[\'"]https://checkout\.coursecreator360\.com/[^\'"]+[\'"];',
        f'window.location.href = "{PAYMENT_LINK}";',
        html_content
    )
    
    # Fix redirectLink variable - it was incorrectly assigned as a string
    html_content = re.sub(
        r"const redirectLink = ['\"]https://my\.coursecreator360\.com/payment-link/[^'\"]+['\"]\s*redirectLink\.id",
        f'const redirectLink = document.createElement("a");\n    redirectLink.href = "{PAYMENT_LINK}";\n    redirectLink.id',
        html_content
    )
    
    # Replace redirectLink.onclick functions that use stripe/sessionId
    html_content = re.sub(
        r'redirectLink\.onclick\s*=\s*function\(\)\s*\{[^}]*if\s*\(stripe\s*&&\s*sessionId\)[^}]+\}',
        f'redirectLink.onclick = function() {{\n      window.location.href = "{PAYMENT_LINK}";\n    }}',
        html_content,
        flags=re.DOTALL
    )
    
    # Replace signupButton.onclick functions that use stripe/sessionId
    html_content = re.sub(
        r'signupButton\.onclick\s*=\s*function\(\)\s*\{[^}]*if\s*\(stripe\s*&&\s*sessionId\)[^}]+\}',
        f'signupButton.onclick = function() {{\n      window.location.href = "{PAYMENT_LINK}";\n    }}',
        html_content,
        flags=re.DOTALL
    )
    
    # Fix the expiration redirect logic in the countdown timer
    html_content = re.sub(
        r'// When expired, redirect to checkout if we have sessionId else fallback\s*if\s*\(stripe\s*&&\s*sessionId\)\s*\{[^}]+\}\s*else\s*\{[^}]+\}',
        f'// When expired, redirect to payment link\n        window.location.href = "{PAYMENT_LINK}";',
        html_content,
        flags=re.DOTALL
    )
    
    return html_content

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 save-and-fix-template.py <input_file_or_stdin> [output_file]")
        print("  If input_file is '-', reads from stdin")
        sys.exit(1)
    
    input_source = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'templates/sample-template.html'
    
    if input_source == '-':
        html_content = sys.stdin.read()
    else:
        with open(input_source, 'r', encoding='utf-8') as f:
            html_content = f.read()
    
    fixed_html = fix_template(html_content)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(fixed_html)
    
    print(f"Fixed template written to: {output_file}")
