#!/usr/bin/env python3
"""
Import workflow generation job result from JSON file into database as a workflow, template, and form.
This makes it appear in the Lead Magnets dashboard.
"""

import json
import os
import sys
import boto3
import time
import random
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError

# Configuration
REGION = "us-east-1"

# Table names
WORKFLOWS_TABLE = "leadmagnet-workflows"
FORMS_TABLE = "leadmagnet-forms"
TEMPLATES_TABLE = "leadmagnet-templates"


def convert_decimals(obj):
    """Convert Decimal types to float/int for JSON serialization."""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    return obj


def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from name."""
    import re
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower())
    slug = slug.strip('-')
    return slug


def generate_ulid() -> str:
    """Generate ULID-like ID."""
    import time
    import random
    import string
    
    # ULID format: timestamp (48 bits) + randomness (80 bits)
    # Simplified: timestamp_ms + random string
    timestamp_ms = int(time.time() * 1000)
    random_part = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    return f"{timestamp_ms:013x}{random_part}"


def ensure_unique_slug(dynamodb, table_name, gsi_name, base_slug: str) -> str:
    """Ensure slug is unique by checking GSI."""
    table = dynamodb.Table(table_name)
    public_slug = base_slug
    slug_counter = 1
    
    while True:
        try:
            response = table.query(
                IndexName=gsi_name,
                KeyConditionExpression="public_slug = :slug",
                ExpressionAttributeValues={":slug": public_slug}
            )
            
            if len(response.get("Items", [])) == 0:
                break
            
            # Check if any are not deleted
            active_items = [item for item in response.get("Items", []) if not item.get("deleted_at")]
            if len(active_items) == 0:
                break
            
            public_slug = f"{base_slug}-{slug_counter}"
            slug_counter += 1
        except Exception as e:
            print(f"Warning: Error checking slug uniqueness: {e}")
            break
    
    return public_slug


def ensure_required_fields(fields: list) -> list:
    """Ensure form has required fields (name, email)."""
    field_ids = {f.get("field_id") for f in fields}
    fields_to_add = []
    
    if "name" not in field_ids:
        fields_to_add.append({
            "field_id": "name",
            "field_type": "text",
            "label": "Name",
            "placeholder": "Your name",
            "required": True
        })
    
    if "email" not in field_ids:
        fields_to_add.append({
            "field_id": "email",
            "field_type": "email",
            "label": "Email",
            "placeholder": "your@email.com",
            "required": True
        })
    
    return fields_to_add + fields if fields_to_add else fields


def import_workflow_from_json(json_file_path: str, tenant_id: str = None):
    """Import workflow generation job result from JSON file into database."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    workflows_table = dynamodb.Table(WORKFLOWS_TABLE)
    forms_table = dynamodb.Table(FORMS_TABLE)
    templates_table = dynamodb.Table(TEMPLATES_TABLE)
    
    try:
        # Read JSON file
        print(f"Reading JSON file: {json_file_path}...")
        with open(json_file_path, 'r') as f:
            job_data = json.load(f)
        
        # Extract tenant_id from JSON if not provided
        if not tenant_id:
            tenant_id = job_data.get("tenant_id")
            if not tenant_id:
                print("Error: tenant_id not found in JSON file and not provided as argument")
                return False
        
        # Validate status
        if job_data.get("status") != "completed":
            print(f"Warning: Job status is '{job_data.get('status')}', expected 'completed'")
        
        if "result" not in job_data:
            print("Error: JSON file does not have a result field")
            return False
        
        result = job_data["result"]
        workflow_data = result.get("workflow", {})
        template_data = result.get("template", {})
        form_data = result.get("form", {})
        
        if not workflow_data or not template_data or not form_data:
            print("Error: Job result is missing workflow, template, or form data")
            return False
        
        print("\n" + "=" * 60)
        print("Importing Workflow Generation Result")
        print("=" * 60)
        print(f"Tenant ID: {tenant_id}")
        
        # 1. Create Template
        print("\n1. Creating template...")
        template_id = f"tmpl_{generate_ulid()}"
        template = {
            "template_id": template_id,
            "version": 1,
            "tenant_id": tenant_id,
            "template_name": template_data.get("template_name", "Generated Template"),
            "template_description": template_data.get("template_description", ""),
            "html_content": template_data.get("html_content", ""),
            "placeholder_tags": template_data.get("placeholder_tags", []),
            "is_published": True,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        templates_table.put_item(Item=template)
        print(f"   ✓ Created template: {template_id}")
        print(f"   Name: {template['template_name']}")
        
        # 2. Create Workflow
        print("\n2. Creating workflow...")
        workflow_id = f"wf_{generate_ulid()}"
        
        # Ensure steps have proper structure
        steps = workflow_data.get("steps", [])
        steps = [
            {
                **step,
                "step_order": step.get("step_order", idx),
                "tools": step.get("tools", []),
                "tool_choice": step.get("tool_choice", "auto"),
            }
            for idx, step in enumerate(steps)
        ]
        
        workflow = {
            "workflow_id": workflow_id,
            "tenant_id": tenant_id,
            "workflow_name": workflow_data.get("workflow_name", "Generated Workflow"),
            "workflow_description": workflow_data.get("workflow_description", ""),
            "steps": steps,
            "research_instructions": workflow_data.get("research_instructions", ""),
            "template_id": template_id,
            "status": "draft",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        workflows_table.put_item(Item=workflow)
        print(f"   ✓ Created workflow: {workflow_id}")
        print(f"   Name: {workflow['workflow_name']}")
        print(f"   Steps: {len(steps)}")
        
        # 3. Create Form
        print("\n3. Creating form...")
        form_id = f"form_{generate_ulid()}"
        
        # Generate unique slug
        form_name = form_data.get("form_name", f"{workflow['workflow_name']} Form")
        base_slug = generate_slug(form_data.get("public_slug", form_name))
        public_slug = ensure_unique_slug(dynamodb, FORMS_TABLE, "gsi_public_slug", base_slug)
        
        # Get form fields
        form_fields = form_data.get("form_fields_schema", {}).get("fields", [])
        form_fields = ensure_required_fields(form_fields)
        
        form = {
            "form_id": form_id,
            "tenant_id": tenant_id,
            "workflow_id": workflow_id,
            "form_name": form_name,
            "public_slug": public_slug,
            "form_fields_schema": {
                "fields": form_fields
            },
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        forms_table.put_item(Item=form)
        print(f"   ✓ Created form: {form_id}")
        print(f"   Name: {form['form_name']}")
        print(f"   Slug: {public_slug}")
        print(f"   Fields: {len(form_fields)}")
        
        # 4. Update workflow with form_id
        print("\n4. Linking workflow to form...")
        workflows_table.update_item(
            Key={"workflow_id": workflow_id},
            UpdateExpression="SET form_id = :form_id, updated_at = :updated_at",
            ExpressionAttributeValues={
                ":form_id": form_id,
                ":updated_at": datetime.utcnow().isoformat()
            }
        )
        print(f"   ✓ Linked workflow to form")
        
        print("\n" + "=" * 60)
        print("✓ Successfully imported workflow generation result!")
        print("=" * 60)
        print(f"\nWorkflow ID: {workflow_id}")
        print(f"Template ID: {template_id}")
        print(f"Form ID: {form_id}")
        print(f"\nThe workflow should now appear in your Lead Magnets dashboard.")
        print(f"Form URL slug: {public_slug}")
        print("=" * 60)
        
        return True
        
    except FileNotFoundError:
        print(f"\n✗ Error: File not found: {json_file_path}")
        return False
    except json.JSONDecodeError as e:
        print(f"\n✗ Error: Invalid JSON file: {e}")
        return False
    except ClientError as e:
        print(f"\n✗ Error accessing DynamoDB: {e}")
        return False
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Import workflow generation job results from JSON file into database")
    parser.add_argument("json_file", help="Path to JSON file containing workflow generation job result")
    parser.add_argument("--tenant-id", help="Tenant ID (will use tenant_id from JSON if not provided)")
    args = parser.parse_args()
    
    print("=" * 80)
    print("Workflow Import Tool (JSON)")
    print("=" * 80)
    print(f"JSON file: {args.json_file}")
    if args.tenant_id:
        print(f"Tenant ID: {args.tenant_id}")
    print("=" * 80)
    
    success = import_workflow_from_json(args.json_file, args.tenant_id)
    
    if success:
        print("\n✓ Import completed successfully!")
        sys.exit(0)
    else:
        print("\n✗ Import failed!")
        sys.exit(1)

