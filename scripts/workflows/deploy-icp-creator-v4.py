#!/usr/bin/env python3
"""
Deploy the ICP Creator V4 workflow to DynamoDB.

Creates the workflow, form, and (optionally) template records directly
from the icp-creator-v4.json definition.

Usage:
  python scripts/workflows/deploy-icp-creator-v4.py --tenant-id <TENANT_ID>
  python scripts/workflows/deploy-icp-creator-v4.py --tenant-id <TENANT_ID> --workflow-id <EXISTING_WF_ID>
"""

import json
import os
import re
import sys
import time
import random
import string
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "us-east-1")
WORKFLOWS_TABLE = os.environ.get("WORKFLOWS_TABLE", "leadmagnet-workflows")
FORMS_TABLE = os.environ.get("FORMS_TABLE", "leadmagnet-forms")

SCRIPT_DIR = Path(__file__).resolve().parent
WORKFLOW_JSON = SCRIPT_DIR / "icp-creator-v4.json"

FORM_FIELDS = [
    {
        "field_id": "name",
        "field_type": "text",
        "label": "Your Name",
        "placeholder": "e.g., Jane Smith",
        "required": True,
    },
    {
        "field_id": "email",
        "field_type": "email",
        "label": "Email",
        "placeholder": "you@company.com",
        "required": True,
    },
    {
        "field_id": "industry",
        "field_type": "text",
        "label": "What industry or market are you targeting?",
        "placeholder": "e.g., B2B SaaS for HR teams, DTC health supplements",
        "required": True,
    },
    {
        "field_id": "target_audience",
        "field_type": "textarea",
        "label": "Describe your ideal customer in a few sentences",
        "placeholder": "e.g., Mid-market CFOs at 50-500 employee companies who are frustrated with manual financial reporting",
        "required": True,
    },
    {
        "field_id": "product_service",
        "field_type": "textarea",
        "label": "What product or service do you offer?",
        "placeholder": "e.g., Automated financial dashboards for SaaS companies",
        "required": True,
    },
    {
        "field_id": "pain_points",
        "field_type": "textarea",
        "label": "What are the biggest pain points you solve?",
        "placeholder": "e.g., Manual data entry, slow month-end close, no real-time visibility",
        "required": False,
    },
]


def generate_ulid() -> str:
    timestamp_ms = int(time.time() * 1000)
    random_part = "".join(random.choices(string.ascii_lowercase + string.digits, k=10))
    return f"{timestamp_ms:013x}{random_part}"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def ensure_unique_slug(dynamodb, table_name: str, gsi_name: str, base_slug: str) -> str:
    table = dynamodb.Table(table_name)
    slug = base_slug
    counter = 1
    while True:
        try:
            response = table.query(
                IndexName=gsi_name,
                KeyConditionExpression="public_slug = :slug",
                ExpressionAttributeValues={":slug": slug},
            )
            active = [i for i in response.get("Items", []) if not i.get("deleted_at")]
            if not active:
                break
            slug = f"{base_slug}-{counter}"
            counter += 1
        except Exception:
            break
    return slug


def deploy(tenant_id: str, workflow_id: Optional[str] = None, dry_run: bool = False):
    with open(WORKFLOW_JSON) as f:
        definition = json.load(f)

    steps = definition["steps"]
    for idx, step in enumerate(steps):
        step.setdefault("step_order", idx)
        step.setdefault("tools", [])
        step.setdefault("tool_choice", "auto")

    wf_id = workflow_id or f"wf_{generate_ulid()}"
    form_id = f"form_{generate_ulid()}"
    now = datetime.utcnow().isoformat()

    workflow_item = {
        "workflow_id": wf_id,
        "tenant_id": tenant_id,
        "workflow_name": definition["workflow_name"],
        "workflow_description": definition["workflow_description"],
        "steps": steps,
        "status": "active",
        "form_id": form_id,
        "created_at": now,
        "updated_at": now,
    }

    base_slug = slugify(definition["workflow_name"])

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  Workflow: {wf_id}")
        print(f"  Form:     {form_id}")
        print(f"  Steps:    {len(steps)}")
        for i, s in enumerate(steps):
            fmt = s.get("output_format", {})
            fmt_label = fmt.get("type", "text") if isinstance(fmt, dict) else "text"
            print(f"    Step {i}: {s['step_name']} ({s['model']}) -> {fmt_label}")
        print(f"\n  Workflow JSON:\n{json.dumps(workflow_item, indent=2)}")
        return

    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    workflows_table = dynamodb.Table(WORKFLOWS_TABLE)
    forms_table = dynamodb.Table(FORMS_TABLE)

    public_slug = ensure_unique_slug(dynamodb, FORMS_TABLE, "gsi_public_slug", base_slug)

    form_item = {
        "form_id": form_id,
        "tenant_id": tenant_id,
        "workflow_id": wf_id,
        "form_name": f"{definition['workflow_name']} Form",
        "public_slug": public_slug,
        "form_fields_schema": {"fields": FORM_FIELDS},
        "created_at": now,
        "updated_at": now,
    }

    if workflow_id:
        print(f"Updating existing workflow {workflow_id}...")
        workflows_table.update_item(
            Key={"workflow_id": workflow_id},
            UpdateExpression=(
                "SET workflow_name = :name, workflow_description = :desc, "
                "steps = :steps, updated_at = :ts"
            ),
            ExpressionAttributeValues={
                ":name": definition["workflow_name"],
                ":desc": definition["workflow_description"],
                ":steps": steps,
                ":ts": now,
            },
        )
    else:
        print("Creating new workflow...")
        workflows_table.put_item(Item=workflow_item)

    if not workflow_id:
        print("Creating form...")
        forms_table.put_item(Item=form_item)

    print("\n" + "=" * 60)
    print("ICP Creator V4 deployed successfully")
    print("=" * 60)
    print(f"  Workflow ID : {wf_id}")
    if not workflow_id:
        print(f"  Form ID     : {form_id}")
        print(f"  Form slug   : {public_slug}")
    print(f"  Steps       : {len(steps)}")
    for i, s in enumerate(steps):
        fmt = s.get("output_format", {})
        fmt_label = fmt.get("type", "text") if isinstance(fmt, dict) else "text"
        tools = s.get("tools", [])
        tool_names = [t if isinstance(t, str) else t.get("type", "?") for t in tools]
        print(f"    Step {i}: {s['step_name']}")
        print(f"            model={s['model']}  output={fmt_label}  tools={tool_names}")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy ICP Creator V4 workflow")
    parser.add_argument("--tenant-id", required=True, help="Target tenant ID")
    parser.add_argument(
        "--workflow-id",
        help="Existing workflow ID to update (creates new if omitted)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be created without writing to DynamoDB",
    )
    args = parser.parse_args()
    deploy(args.tenant_id, args.workflow_id, args.dry_run)
