#!/usr/bin/env python3
"""
Script to publish the latest unpublished version of each template
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

def update_template_published(template: Dict) -> bool:
    """Update template to publish it (creates new version)"""
    try:
        template_id = template['template_id']
        version = template.get('version', 1)
        template_id_with_version = f"{template_id}:{version}"
        
        # Include all existing fields and set is_published to true
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
        print(f"Error: {e}")
        return False

def main():
    print("Fetching all templates...")
    templates = get_all_templates()
    
    # Group by template_id
    by_template = {}
    for t in templates:
        tid = t['template_id']
        if tid not in by_template:
            by_template[tid] = []
        by_template[tid].append(t)
    
    # Find templates without any published versions
    templates_to_publish = []
    for tid, versions in by_template.items():
        published_versions = [v for v in versions if v.get('is_published') == True]
        if not published_versions:
            # Get latest version
            latest = max(versions, key=lambda x: x.get('version', 0))
            templates_to_publish.append(latest)
    
    print(f"\nFound {len(templates_to_publish)} templates without any published versions")
    
    if len(templates_to_publish) == 0:
        print("All templates have at least one published version!")
        return
    
    print(f"\nPublishing latest version of {len(templates_to_publish)} templates...\n")
    
    success_count = 0
    failed_count = 0
    
    for i, template in enumerate(templates_to_publish, 1):
        template_name = template.get('template_name', template['template_id'])
        version = template.get('version', 1)
        print(f"[{i}/{len(templates_to_publish)}] Publishing: {template_name} (v{version})...")
        
        if update_template_published(template):
            print(f"  ✓ Published successfully (created new version)")
            success_count += 1
        else:
            print(f"  ✗ Failed to publish")
            failed_count += 1
    
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Successfully published: {success_count}")
    print(f"  Failed: {failed_count}")
    print(f"  Total: {len(templates_to_publish)}")
    print(f"{'='*60}")
    print(f"\nNote: Template updates create new versions.")
    print(f"Now all templates have at least one published version.")

if __name__ == "__main__":
    main()

