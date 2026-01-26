"""
Unit tests for S3ContextService.
"""

import sys
from pathlib import Path
from unittest.mock import Mock

# Add the worker directory to Python path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

from services.s3_context_service import S3ContextService  # noqa: E402


def test_resolve_output_config_legacy_heuristic(monkeypatch):
    monkeypatch.setenv("SHELL_S3_UPLOAD_ALLOWED_BUCKETS", "my-test-bucket")
    service = S3ContextService(Mock(), Mock(), Mock())

    step = {
        "instructions": "Upload the report to s3://my-test-bucket in us-east-1.",
    }

    config = service.resolve_output_config(step)
    assert config["enabled"] is True
    assert config["bucket"] == "my-test-bucket"
    assert config["region"] == "us-east-1"
    assert config["explicit"] is False


def test_resolve_output_config_explicit(monkeypatch):
    monkeypatch.setenv("SHELL_S3_UPLOAD_ALLOWED_BUCKETS", "my-test-bucket")
    service = S3ContextService(Mock(), Mock(), Mock())

    step = {
        "instructions": "Do something.",
        "output_config": {
            "storage_provider": "s3",
            "source_type": "file",
            "source_path": "/work/output.pdf",
            "content_type": "application/pdf"
        }
    }

    config = service.resolve_output_config(step)
    assert config["enabled"] is True
    assert config["bucket"] == "my-test-bucket" # Defaults to first allowed
    assert config["source_type"] == "file"
    assert config["source_path"] == "/work/output.pdf"
    assert config["explicit"] is True


def test_parse_s3_upload_target_ignores_stop_words():
    service = S3ContextService(Mock(), Mock(), Mock())
    
    # "bucket not allowed" should NOT match "not" as bucket
    result = service._parse_s3_upload_target_from_instructions("do not upload to bucket not allowed")
    assert result is None

    # "bucket my-bucket" SHOULD match "my-bucket"
    result = service._parse_s3_upload_target_from_instructions("upload to bucket my-bucket on s3")
    assert result == {"bucket": "my-bucket", "region": "us-east-1"}
