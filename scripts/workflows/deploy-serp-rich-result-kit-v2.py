#!/usr/bin/env python3
"""
Deploy the SERP Rich Result Kit V2 workflow to DynamoDB.

Updates the existing workflow or creates a new one with the form.

Usage:
  python scripts/workflows/deploy-serp-rich-result-kit-v2.py --tenant-id cust_84c8e438 --workflow-id wf_01KFE4W40JS09PXMXD28TQ1FFT
  python scripts/workflows/deploy-serp-rich-result-kit-v2.py --tenant-id <TENANT_ID>
  python scripts/workflows/deploy-serp-rich-result-kit-v2.py --tenant-id <TENANT_ID> --dry-run
"""

import json
import os
import re
import time
import random
import string
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional

import boto3

REGION = os.environ.get("AWS_REGION", "us-east-1")
WORKFLOWS_TABLE = os.environ.get("WORKFLOWS_TABLE", "leadmagnet-workflows")
FORMS_TABLE = os.environ.get("FORMS_TABLE", "leadmagnet-forms")

SCRIPT_DIR = Path(__file__).resolve().parent
WORKFLOW_JSON = SCRIPT_DIR / "serp-rich-result-kit-v2.json"

FORM_FIELDS = [
    {
        "field_id": "name",
        "field_type": "text",
        "label": "Name",
        "placeholder": "Your name",
        "required": False,
    },
    {
        "field_id": "phone",
        "field_type": "tel",
        "label": "Phone",
        "placeholder": "Your phone number",
        "required": False,
    },
    {
        "field_id": "domain",
        "field_type": "text",
        "label": "What's your website domain?",
        "placeholder": "example.com",
        "required": True,
    },
    {
        "field_id": "email",
        "field_type": "email",
        "label": "Where should we send the report + copy/paste JSON-LD?",
        "placeholder": "you@company.com",
        "required": False,
    },
    {
        "field_id": "business_type",
        "field_type": "select",
        "label": "Which best describes your business?",
        "placeholder": "Select one",
        "required": False,
        "options": [
            "Course creator / Education",
            "SaaS / Software",
            "Ecommerce",
            "Local business",
            "Publisher / Blog",
            "Other",
        ],
    },
    {
        "field_id": "cms",
        "field_type": "select",
        "label": "What platform is your site built on?",
        "placeholder": "Select one",
        "required": False,
        "options": [
            "WordPress",
            "Webflow",
            "Shopify",
            "Kajabi",
            "Teachable",
            "Thinkific",
            "Wix/Squarespace",
            "Custom/Other",
        ],
    },
    {
        "field_id": "top_country",
        "field_type": "select",
        "label": "Where is most of your traffic/customers?",
        "placeholder": "Select one",
        "required": False,
        "options": [
            "United States",
            "United Kingdom",
            "Canada",
            "Australia / New Zealand",
            "Europe",
            "India",
            "Global / multiple countries",
            "Other",
        ],
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
    generated_form_id = f"form_{generate_ulid()}"
    form_id = generated_form_id
    now = datetime.utcnow().isoformat()

    base_slug = slugify(definition["workflow_name"])

    if dry_run:
        print("\n[DRY RUN] Would deploy:")
        print(f"  Workflow: {wf_id}")
        print(f"  Steps:    {len(steps)}")
        for i, s in enumerate(steps):
            fmt = s.get("output_format", {})
            fmt_label = fmt.get("type", "text") if isinstance(fmt, dict) else "text"
            tools = s.get("tools", [])
            tool_names = [t if isinstance(t, str) else t.get("type", "?") for t in tools]
            print(f"    Step {i}: {s['step_name']} ({s['model']}) -> {fmt_label}  tools={tool_names}")
        return

    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    workflows_table = dynamodb.Table(WORKFLOWS_TABLE)
    forms_table = dynamodb.Table(FORMS_TABLE)

    existing_workflow = None
    existing_form = None
    if workflow_id:
        existing_workflow = workflows_table.get_item(
            Key={"workflow_id": workflow_id}
        ).get("Item")
        if not existing_workflow:
            raise SystemExit(f"Workflow {workflow_id} not found")

        existing_tenant_id = existing_workflow.get("tenant_id")
        if existing_tenant_id and existing_tenant_id != tenant_id:
            raise SystemExit(
                f"Workflow {workflow_id} belongs to tenant {existing_tenant_id}, not {tenant_id}"
            )

        form_id = existing_workflow.get("form_id") or generated_form_id
        if form_id:
            existing_form = forms_table.get_item(Key={"form_id": form_id}).get("Item")

    public_slug = (
        existing_form.get("public_slug")
        if existing_form and existing_form.get("public_slug")
        else ensure_unique_slug(dynamodb, FORMS_TABLE, "gsi_public_slug", base_slug)
    )

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
                "steps = :steps, form_id = :form_id, updated_at = :ts"
            ),
            ExpressionAttributeValues={
                ":name": definition["workflow_name"],
                ":desc": definition["workflow_description"],
                ":steps": steps,
                ":form_id": form_id,
                ":ts": now,
            },
        )
    else:
        print("Creating new workflow...")
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
        workflows_table.put_item(Item=workflow_item)

    if workflow_id and existing_form:
        print(f"Updating existing form {form_id}...")
        forms_table.update_item(
            Key={"form_id": form_id},
            UpdateExpression=(
                "SET tenant_id = :tenant_id, workflow_id = :workflow_id, "
                "form_name = :form_name, public_slug = :public_slug, "
                "form_fields_schema = :schema, updated_at = :ts"
            ),
            ExpressionAttributeValues={
                ":tenant_id": tenant_id,
                ":workflow_id": wf_id,
                ":form_name": form_item["form_name"],
                ":public_slug": public_slug,
                ":schema": form_item["form_fields_schema"],
                ":ts": now,
            },
        )
    elif workflow_id and not existing_form:
        print(f"Creating missing form {form_id}...")
        forms_table.put_item(Item=form_item)
    else:
        print("Creating form...")
        forms_table.put_item(Item=form_item)

    print("\n" + "=" * 60)
    print("SERP Rich Result Kit V2 deployed successfully")
    print("=" * 60)
    print(f"  Workflow ID : {wf_id}")
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
    parser = argparse.ArgumentParser(description="Deploy SERP Rich Result Kit V2 workflow")
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
