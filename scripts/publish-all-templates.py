#!/usr/bin/env python3
"""
Script to publish all unpublished templates
"""

import sys
import json
import requests
from typing import List, Dict

API_URL = "http://localhost:3001"
TENANT_ID = "84c8e438-0061-70f2-2ce0-7cb44989a329"

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

def update_template_published(template_id: str, version: int, is_published: bool) -> bool:
    """Update a template's published status"""
    try:
        # Templates are updated by template_id:version
        template_id_with_version = f"{template_id}:{version}"
        response = requests.put(
            f"{API_URL}/admin/templates/{template_id_with_version}",
            json={"is_published": is_published},
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"Error updating template {template_id} v{version}: {e}")
        return False

def main():
    print("Fetching all templates...")
    templates = get_all_templates()
    
    unpublished_templates = [t for t in templates if not t.get('is_published')]
    
    print(f"\nFound {len(unpublished_templates)} unpublished templates out of {len(templates)} total templates")
    
    if len(unpublished_templates) == 0:
        print("No unpublished templates to publish.")
        return
    
    print(f"\nPublishing {len(unpublished_templates)} templates...\n")
    
    success_count = 0
    failed_count = 0
    
    for i, template in enumerate(unpublished_templates, 1):
        template_id = template['template_id']
        version = template.get('version', 1)
        template_name = template.get('template_name', template_id)
        print(f"[{i}/{len(unpublished_templates)}] Publishing: {template_name} (v{version})...")
        
        if update_template_published(template_id, version, True):
            print(f"  ✓ Published successfully")
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

if __name__ == "__main__":
    main()

