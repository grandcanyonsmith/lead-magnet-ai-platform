#!/usr/bin/env python3
"""
Script to directly publish all unpublished templates by updating their is_published field
without creating new versions
"""

import sys
import json
import requests
from typing import List, Dict

API_URL = "http://localhost:3001"

def get_all_templates() -> List[Dict]:
    """Get all templates from the API"""
    try:
        response = requests.get(f"{API_URL}/admin/templates")
        response.raise_for_status()
        data = response.json()
        return data.get('templates', [])
    except Exception as e:
        print(f"Error fetching templates: {e}")
        sys.exit(1)

def update_template_directly(template: Dict) -> bool:
    """Update template's is_published field directly via PUT with all existing fields"""
    try:
        template_id = template['template_id']
        version = template.get('version', 1)
        template_id_with_version = f"{template_id}:{version}"
        
        # Update with all existing fields but set is_published to true
        update_data = {
            'template_name': template.get('template_name'),
            'template_description': template.get('template_description'),
            'html_content': template.get('html_content'),
            'placeholder_tags': template.get('placeholder_tags', []),
            'is_published': True
        }
        
        response = requests.put(
            f"{API_URL}/admin/templates/{template_id_with_version}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"Error updating template {template.get('template_name')} v{version}: {e}")
        return False

def main():
    print("Fetching all templates...")
    templates = get_all_templates()
    
    unpublished_templates = [t for t in templates if not t.get('is_published')]
    
    print(f"\nFound {len(unpublished_templates)} unpublished templates out of {len(templates)} total templates")
    
    if len(unpublished_templates) == 0:
        print("No unpublished templates to publish.")
        return
    
    print(f"\n⚠️  Note: Template updates create new versions.")
    print(f"Publishing {len(unpublished_templates)} templates by updating them...\n")
    
    success_count = 0
    failed_count = 0
    
    for i, template in enumerate(unpublished_templates, 1):
        template_id = template['template_id']
        version = template.get('version', 1)
        template_name = template.get('template_name', template_id)
        print(f"[{i}/{len(unpublished_templates)}] Publishing: {template_name} (v{version})...")
        
        if update_template_directly(template):
            print(f"  ✓ Published successfully (may have created new version)")
            success_count += 1
        else:
            print(f"  ✗ Failed to publish")
            failed_count += 1
    
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Successfully published: {success_count}")
    print(f"  Failed: {failed_count}")
    print(f"  Total: {len(unpublished_templates)}")
    print(f"{'='*60}")
    print(f"\nNote: Template updates create new versions, so the old versions")
    print(f"remain unpublished but new published versions were created.")

if __name__ == "__main__":
    main()

