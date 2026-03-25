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
        "field_id": "brand_name",
        "field_type": "text",
        "label": "Brand / Business Name",
        "placeholder": "e.g., Ready for Increase",
        "required": True,
    },
    {
        "field_id": "website_url",
        "field_type": "url",
        "label": "Website URL (for brand style extraction)",
        "placeholder": "e.g., https://www.readyforincrease.com",
        "required": False,
    },
    {
        "field_id": "industry",
        "field_type": "text",
        "label": "What industry or market are you targeting?",
        "placeholder": "e.g., Faith-based coaching, B2B SaaS for HR teams",
        "required": True,
    },
    {
        "field_id": "target_audience",
        "field_type": "textarea",
        "label": "Describe your ideal customer in a few sentences",
        "placeholder": "e.g., Senior Pastors and faith-based leaders aged 40-65 who want to turn their sermons into published books and scalable digital assets",
        "required": True,
    },
    {
        "field_id": "founder_story",
        "field_type": "textarea",
        "label": "Your Founder / Origin Story (the journey that led you here)",
        "placeholder": "Share the pivotal moments, challenges, and breakthroughs that shaped your mission and expertise...",
        "required": True,
    },
    {
        "field_id": "product_service",
        "field_type": "textarea",
        "label": "What product or service do you offer? (name, summary, and how it works)",
        "placeholder": "e.g., The Book of Increase: Legacy & Leverage Accelerator — an elite accelerator that births your book, elevates your brand, and builds an automated pipeline...",
        "required": True,
    },
    {
        "field_id": "product_price",
        "field_type": "text",
        "label": "Product Price / Investment",
        "placeholder": "e.g., $12,000 USD; payment plan available; 30-day money-back guarantee",
        "required": False,
    },
    {
        "field_id": "product_mechanism",
        "field_type": "textarea",
        "label": "How does your method / framework work? (tagline + description)",
        "placeholder": "e.g., Birth → Brand → Build → Increase: A four-phase, done-with-you pathway that transforms a sermon archive into a published book, premium brand, and automated sales engine...",
        "required": False,
    },
    {
        "field_id": "product_features",
        "field_type": "textarea",
        "label": "Key features, modules, or deliverables (one per line)",
        "placeholder": "e.g.,\nBirth Blueprint — outline and complete my book in 90 days\nEthical Guardrails — biblical, dignified marketing\nAutomation Toolkit — funnels, emails, follow-up",
        "required": False,
    },
    {
        "field_id": "product_delivery",
        "field_type": "textarea",
        "label": "How is it delivered? (format, access, community, disclaimers)",
        "placeholder": "e.g., High-touch accelerator with done-with-you sprints, short videos, implementation calls, and templates; lifetime access; optional moderated community...",
        "required": False,
    },
    {
        "field_id": "pain_points",
        "field_type": "textarea",
        "label": "What are the biggest pain points you solve?",
        "placeholder": "e.g., Sitting on decades of sermons with no published book, relying on tithes with financial pressure, tech overwhelm",
        "required": False,
    },
    {
        "field_id": "credentials_background",
        "field_type": "textarea",
        "label": "Your credentials, background, and authority (years of experience, certifications, notable achievements)",
        "placeholder": "e.g., 41+ years in entrepreneurship, author of Rich Thoughts, built a multi-million-dollar promotional company, delivered workshops to 1,200+ leaders...",
        "required": False,
    },
    {
        "field_id": "client_results",
        "field_type": "textarea",
        "label": "Specific client wins, testimonials, or case studies",
        "placeholder": "e.g., Guided a senior pastor from blank page to published book and $186,000 in backend offers in 6 months; student produced 10,000+ book sales...",
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
    generated_form_id = f"form_{generate_ulid()}"
    form_id = generated_form_id
    now = datetime.utcnow().isoformat()

    base_slug = slugify(definition["workflow_name"])

    if dry_run:
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
        workflows_table.put_item(Item=workflow_item)

    if workflow_id:
        if existing_form:
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
        else:
            print(f"Creating missing form {form_id}...")
            forms_table.put_item(Item=form_item)
    else:
        print("Creating form...")
        forms_table.put_item(Item=form_item)

    print("\n" + "=" * 60)
    print("ICP Creator V4 deployed successfully")
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
