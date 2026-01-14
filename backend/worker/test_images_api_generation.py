"""
Tests for Images API-backed image generation (gpt-image-* models).

These tests must be hermetic: no AWS and no OpenAI network calls.
"""

import os
import sys
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock


# Add the worker directory to Python path so imports work
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

# Unit tests should be hermetic. Avoid AWS Secrets Manager dependency in OpenAI client init.
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("ARTIFACTS_BUCKET", "leadmagnet-artifacts-test")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")


from ai_service import AIService  # noqa: E402


def test_generate_report_with_image_generation_uses_images_api_and_returns_urls():
    svc = AIService()

    # Planner call (Responses API) is mocked to return a strict JSON plan
    planner_text = json.dumps(
        {
            "images": [
                {"label": "Primary Logo", "prompt": "Generate a clean primary logo for Breakthrough Studios"},
                {"label": "Inverse Logo", "prompt": "Generate an inverse logo for Breakthrough Studios on dark background"},
            ]
        }
    )

    svc.openai_client.build_api_params = Mock(return_value={"model": "gpt-5.2"})
    svc.openai_client.make_api_call = Mock(return_value=Mock())
    svc.openai_client.process_api_response = Mock(
        return_value=(
            planner_text,
            {"model": "gpt-5.2", "input_tokens": 1, "output_tokens": 1, "total_tokens": 2, "cost_usd": 0},
            {"model": "gpt-5.2"},
            {"output_text": planner_text},
        )
    )

    # Images API call is mocked to return base64 images; S3 upload is mocked to return stable URLs
    svc.openai_client.generate_images = Mock(
        return_value=SimpleNamespace(data=[SimpleNamespace(b64_json="dGVzdA==")])
    )
    svc.image_handler.upload_base64_image_to_s3 = Mock(
        side_effect=["https://cdn.example.com/img1.png", "https://cdn.example.com/img2.png"]
    )

    output_text, usage_info, request_details, response_details = svc.generate_report(
        model="gpt-5.2",
        instructions="Generate brand images",
        context="Brand context here",
        previous_context="",
        tools=[
            {
                "type": "image_generation",
                "model": "gpt-image-1.5",
                "size": "auto",
                "quality": "high",
                "background": "auto",
                "format": "png",
                "compression": 80,
            }
        ],
        tool_choice="required",
        tenant_id="tenant_test",
        job_id="job_test",
        reasoning_effort="high",
    )

    assert isinstance(output_text, str) and output_text.strip().startswith("{")
    assert response_details["image_urls"] == [
        "https://cdn.example.com/img1.png",
        "https://cdn.example.com/img2.png",
    ]
    assert usage_info.get("images_generated") == 2
    assert usage_info.get("image_model") == "gpt-image-1.5"

    # Ensure we actually used the Images API wrapper, not Responses tool image_generation
    assert svc.openai_client.generate_images.call_count == 2
    assert svc.image_handler.upload_base64_image_to_s3.call_count == 2


def test_generate_report_with_empty_planner_images_falls_back_and_returns_urls():
    svc = AIService()

    # Planner returns an empty images list -> should fall back to step instructions
    planner_text = json.dumps({"images": []})

    svc.openai_client.build_api_params = Mock(return_value={"model": "gpt-5.2"})
    svc.openai_client.make_api_call = Mock(return_value=Mock())
    svc.openai_client.process_api_response = Mock(
        return_value=(
            planner_text,
            {"model": "gpt-5.2", "input_tokens": 1, "output_tokens": 1, "total_tokens": 2, "cost_usd": 0},
            {"model": "gpt-5.2"},
            {"output_text": planner_text},
        )
    )

    captured_prompt = {}

    def _fake_generate_images(**kwargs):
        captured_prompt["prompt"] = kwargs.get("prompt")
        return SimpleNamespace(data=[SimpleNamespace(b64_json="dGVzdA==")])

    svc.openai_client.generate_images = Mock(side_effect=_fake_generate_images)
    svc.image_handler.upload_base64_image_to_s3 = Mock(
        return_value="https://cdn.example.com/fallback.png"
    )

    output_text, usage_info, request_details, response_details = svc.generate_report(
        model="gpt-5.2",
        instructions="make an image of a cow",
        context="Name: canyon\nPhone: 8\nEmail: f@g.com",
        previous_context="",
        tools=[
            {
                "type": "image_generation",
                "model": "gpt-image-1.5",
                "size": "auto",
                "quality": "auto",
                "background": "auto",
            }
        ],
        tool_choice="required",
        tenant_id="tenant_test",
        job_id="job_test",
        reasoning_effort="high",
    )

    assert response_details["image_urls"] == ["https://cdn.example.com/fallback.png"]
    assert usage_info.get("images_generated") == 1
    assert isinstance(output_text, str) and output_text.strip().startswith("{")
    assert "make an image of a cow" in (captured_prompt.get("prompt") or "")
