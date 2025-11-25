##test testing 01 08
#!/usr/bin/env python3
"""
Market-research generator
──────────────────────────────────────────────────────────
1. Receives JSON body: { name, phone, course_description }
2. Creates a market-research narrative (OpenAI)
3. Generates courseData JSON + TTS audio (parallel)
4. Builds an HTML report → uploads to S3
5. Inserts a “temp_market_research_id” row in DynamoDB
6. Injects a 24-hour countdown banner (JS snippet now lives in config.py)
7. Returns public URL  …?temp_market_research_id=<id>  + fires webhook
"""

from __future__ import annotations

import io
import json
import logging
import os
import re
import sys
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Final

import boto3
import botocore.exceptions
import concurrent.futures as cf
import requests
from openai import OpenAI

# ────────────────────────────────────────────────────────────
# External templates / config
#   (HTML_TEMPLATE, COUNTDOWN_SCRIPT, prompt templates, …)
# ────────────────────────────────────────────────────────────
from config import (
    HTML_TEMPLATE,
    COUNTDOWN_SCRIPT,                             # <── banner script now lives here
    course_description_to_market_research_report_prompt,
    market_report_prompt,
)

# ────────────────────────────────────────────────────────────
#  UTF-8 stdout / stderr (for CloudWatch)
# ────────────────────────────────────────────────────────────
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except AttributeError:  # Python < 3.7
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

# ────────────────────────────────────────────────────────────
#  Environment / constants
# ────────────────────────────────────────────────────────────
REGION:           Final[str] = os.getenv("AWS_REGION",          "us-west-2")
BUCKET:           Final[str] = os.getenv("PAGES_BUCKET",        "cc360-pages")
FOLDER_VALUES:    Final[str] = os.getenv("FOLDER_VALUES",       "MarketResearchReportValues")
FOLDER_HTML:      Final[str] = os.getenv("FOLDER_HTML",         "MarketResearchReport")
MODEL_RESEARCH:   Final[str] = os.getenv("MODEL_RESEARCH",      "o4-mini-deep-research")
MODEL_COURSEDATA: Final[str] = os.getenv("MODEL_COURSEDATA",    "o3")
AUDIO_LAMBDA_URL: Final[str] = os.getenv("AUDIO_LAMBDA_URL",
                                         "https://rqs4p4vd3boceuneltib5kjc3e0pccoo.lambda-url.us-west-2.on.aws/")
FINAL_WEBHOOK_URL: Final[str] = (
    "https://services.leadconnectorhq.com/hooks/kgREXsjAvhag6Qn8Yjqn/"
    "webhook-trigger/a4952910-facd-4c91-aebe-6a374a24d6db"
)
DYNAMO_TABLE:     Final[str] = os.getenv("MARKET_RESEARCH_TABLE", "CourseMarketResearchReports")
EXPIRY_HOURS:     Final[int]  = 24

# ────────────────────────────────────────────────────────────
#  Logging (correlated by request_id)
# ────────────────────────────────────────────────────────────
class _Fmt(logging.Formatter):
    def format(self, rec):
        if not hasattr(rec, "req_id"):
            rec.req_id = "-"
        return super().format(rec)

_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(_Fmt("%(asctime)s  %(levelname)s [%(req_id)s] %(name)s: %(message)s"))
logging.basicConfig(level=logging.INFO, handlers=[_handler])
_base_log = logging.getLogger("market_research")

def _log(req_id: str) -> logging.LoggerAdapter:
    return logging.LoggerAdapter(_base_log, {"req_id": req_id})

# ────────────────────────────────────────────────────────────
#  Global OpenAI client
# ────────────────────────────────────────────────────────────
_openai: Final[OpenAI] = OpenAI()

def _assistant_text(rsp: Any) -> str:
    return "".join(
        p.text
        for msg in rsp.output
        if getattr(msg, "type", None) == "message"
        for p in getattr(msg, "content", [])
        if hasattr(p, "text")
    )

def _openai_call(model: str, dev: str, user: str, log: logging.Logger) -> str:
    for attempt in range(3):
        try:
            resp = _openai.responses.create(
                model=model,
                input=[
                    {"role": "developer", "content": [{"type": "input_text", "text": dev}]},
                    {"role": "user",      "content": [{"type": "input_text", "text": user}]},
                ],
                text={"format": {"type": "text"}},
                reasoning={"effort": "medium"},
                # do web search
                tools=[{"type": "web_search"}],
                store=True,
            )
            return _assistant_text(resp)
        except Exception as exc:
            if attempt == 2:
                raise
            delay = 2 ** attempt
            log.warning("OpenAI call failed (retry in %ss): %s", delay, exc)
            time.sleep(delay)

# ────────────────────────────────────────────────────────────
#  DynamoDB helpers
# ────────────────────────────────────────────────────────────
_dynamodb = boto3.resource("dynamodb", region_name=REGION)

def _ensure_table(table_name: str, log: logging.Logger) -> None:
    client = boto3.client("dynamodb", region_name=REGION)
    try:
        client.describe_table(TableName=table_name)
    except client.exceptions.ResourceNotFoundException:
        log.info("Creating DynamoDB table %s…", table_name)
        client.create_table(
            TableName=table_name,
            AttributeDefinitions=[
                {"AttributeName": "temp_market_research_id", "AttributeType": "S"},
                {"AttributeName": "timestamp",               "AttributeType": "S"},
            ],
            KeySchema=[
                {"AttributeName": "temp_market_research_id", "KeyType": "HASH"},
                {"AttributeName": "timestamp",               "KeyType": "RANGE"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        client.get_waiter("table_exists").wait(TableName=table_name)
        log.info("Table ready.")

def _put_market_row(temp_id: str, url: str, phone: str, course_desc: str, log: logging.Logger):
    expires_at = datetime.utcnow() + timedelta(hours=EXPIRY_HOURS)
    _dynamodb.Table(DYNAMO_TABLE).put_item(Item={
        "temp_market_research_id": temp_id,
        "timestamp": "CREATED_RECORD",
        "url": url,
        "phone_number": phone,
        "course_description": course_desc,
        "expires_at": expires_at.isoformat()
    })
    log.info("DynamoDB row stored (expires %s)", expires_at.isoformat())

# ────────────────────────────────────────────────────────────
#  Misc helpers
# ────────────────────────────────────────────────────────────
def _extract_course_block(text: str, anchor: str = "courseData") -> str:
    start = text.find(anchor)
    if start == -1:
        raise ValueError("anchor not found")
    open_brace = text.find("{", start)
    if open_brace == -1:
        raise ValueError("opening '{' missing")
    depth = 0
    for idx, ch in enumerate(text[open_brace:], start=open_brace):
        depth += ch == "{"
        depth -= ch == "}"
        if depth == 0:
            return text[start: idx + 1]
    raise ValueError("unbalanced braces")

def _upload_public(key: str, ctype: str, *, body: str | bytes, log: logging.Logger) -> str:
    if isinstance(body, str):
        body = body.encode("utf-8")
    boto3.client("s3", region_name=REGION).put_object(
        Bucket=BUCKET, Key=key, Body=body,
        ACL="public-read", ContentType=ctype
    )
    url = f"https://{BUCKET}.s3.{REGION}.amazonaws.com/{key}"
    log.info("Uploaded %s", url)
    return url

def _generate_audio(name: str, report: str, log: logging.Logger) -> str:
    r = requests.post(AUDIO_LAMBDA_URL, json={"name": name, "market_research_report": report}, timeout=900)
    if r.status_code != 200:
        raise RuntimeError(f"TTS Lambda failed ({r.status_code})")
    audio_url = r.json().get("s3_audio_url")
    if not audio_url:
        raise RuntimeError("TTS Lambda missing s3_audio_url")
    log.info("Audio URL %s", audio_url)
    return audio_url

def _inject_globals(html: str, audio_url: str, js_url: str) -> str:
    m = re.search(r"<script>(\s*)(\(async\b|\(function\b|/[*])", html, re.I)
    if not m:
        raise RuntimeError("main <script> tag not found")
    pos = m.end() - len(m.group(2))
    consts = (
        f'\n  // injected by Lambda\n'
        f'  const AUDIO_EXPLAINATION = {json.dumps(audio_url)};\n'
        f'  const CUSTOM_VALUES_MARKET_RESEARCH_REPORT = {json.dumps(js_url)};\n'
    )
    return html[:pos] + consts + html[pos:]

def _inject_banner(html: str) -> str:
    return html.replace("</body>", f"{COUNTDOWN_SCRIPT}\n</body>") if "</body>" in html else html + COUNTDOWN_SCRIPT

# ────────────────────────────────────────────────────────────
#  Pipeline
# ────────────────────────────────────────────────────────────
def pipeline(course_desc: str, narrator: str, phone: str, log: logging.Logger) -> str:
    # 1. Market research narrative
    log.info("1/5  Generating narrative")
    report = _openai_call(
        MODEL_RESEARCH,
        course_description_to_market_research_report_prompt,
        f"Course Idea: {course_desc}",
        log,
    )

    # 2. courseData + TTS in parallel
    log.info("2/5  Spawning courseData + TTS tasks")
    with cf.ThreadPoolExecutor(max_workers=2) as exe:
        fut_data  = exe.submit(
            _openai_call,
            MODEL_COURSEDATA,
            market_report_prompt,
            f"market research found: {report}",
            log,
        )
        fut_audio = exe.submit(_generate_audio, narrator, report, log)
        raw_course, audio_url = fut_data.result(), fut_audio.result()

    # 3. Upload values.js
    log.info("3/5  Uploading values.js")
    course_js = _extract_course_block(raw_course)
    if not course_js.lstrip().startswith("window."):
        course_js = "window." + course_js
    js_key = f"{FOLDER_VALUES}/{uuid.uuid4().hex}-values.js"
    js_url = _upload_public(js_key, "application/javascript; charset=utf-8", body=course_js, log=log)

    # 4. Build HTML, inject globals + banner
    log.info("4/5  Building HTML")
    html = HTML_TEMPLATE

    # Fix script reference or inject loadExternalDataScript
    tag_pat = re.compile(r'(<script[^>]+src=)(["\'])https?://[^"\']+-values\.js\2', re.I)
    html, n_tag = tag_pat.subn(rf'\1\2{js_url}\2', html, count=1)
    call_pat = re.compile(r'loadExternalDataScript\(\s*["\']https?://[^"\']+-values\.js["\']\s*\)', re.I)
    html, n_call = call_pat.subn(f'loadExternalDataScript("{js_url}")', html, count=1)
    if (n_tag + n_call) == 0:
        html = html.replace("</head>", f'<script>loadExternalDataScript("{js_url}")</script>\n</head>')

    html = _inject_globals(html, audio_url, js_url)

    temp_id = uuid.uuid4().hex
    html = _inject_banner(html)

    # 5. Upload HTML page
    log.info("5/5  Uploading HTML page")
    page_key = f"{FOLDER_HTML}/{uuid.uuid4().hex}.html"
    page_url = _upload_public(page_key, "text/html; charset=utf-8", body=html, log=log)

    # DynamoDB row
    _ensure_table(DYNAMO_TABLE, log)
    _put_market_row(temp_id, page_url, phone, course_desc, log)

    return f"{page_url}?temp_market_research_id={temp_id}"

# ────────────────────────────────────────────────────────────
#  Lambda handler
# ────────────────────────────────────────────────────────────
def lambda_handler(event: dict, context):
    req_id = getattr(context, "aws_request_id", uuid.uuid4().hex)
    log = _log(req_id)

    try:
        body = json.loads(event.get("body", "{}"))
        narrator       = body["name"]
        phone          = body["phone"]
        course_desc    = body["course_description"]
    except (KeyError, json.JSONDecodeError) as exc:
        log.warning("Bad request: %s", exc)
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Body must include name, phone, course_description"})
        }

    try:
        final_url = pipeline(course_desc, narrator, phone, log)

        # webhook
        requests.post(FINAL_WEBHOOK_URL, json={
            "name": narrator,
            "phone": phone,
            "object_url": final_url,
            "course_description": course_desc,
        }, timeout=600)

        return {"statusCode": 200, "body": json.dumps({"url": final_url}, ensure_ascii=False)}
    except Exception as exc:
        log.exception("Unhandled error")
        return {"statusCode": 500, "body": json.dumps({"error": str(exc)})}




if __name__ == "__main__":
    course_desc = "A course about the history of the internet"
    narrator = "Canyon Smith"
    phone = "+18016237631"
    log = _log("test")
    print(pipeline(course_desc, narrator, phone, log))
    print(lambda_handler({"body": json.dumps({"name": narrator, "phone": phone, "course_description": course_desc})}, None))