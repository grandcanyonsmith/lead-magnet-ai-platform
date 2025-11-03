#!/usr/bin/env python3
"""Save user's HTML from their query and fix it."""

# The user's HTML starts with <!DOCTYPE html> and ends with </html>
# We'll read it from stdin or a file

import sys

if __name__ == '__main__':
    # Read from stdin
    html_content = sys.stdin.read()
    
    # Save to file
    output_file = 'user-html.html'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"Saved HTML to: {output_file}")
    print(f"Now run: python3 ../scripts/fix-template-stripe.py {output_file} sample-template.html")
