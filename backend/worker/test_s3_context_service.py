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


def test_s3_upload_context_skips_without_previous_artifact(monkeypatch):
    monkeypatch.setenv("SHELL_S3_UPLOAD_ALLOWED_BUCKETS", "my-test-bucket")

    service = S3ContextService(
        db_service=Mock(),
        s3_service=Mock(),
        artifact_service=Mock(),
    )

    step = {
        "instructions": "Upload the report to s3://my-test-bucket in us-east-1.",
    }

    current_context = "existing context"

    result = service.maybe_inject_s3_upload_context(
        step=step,
        step_index=0,
        tenant_id="tenant_123",
        job_id="job_123",
        current_step_context=current_context,
        step_outputs=[],
        step_tools=[{"type": "shell"}],
    )

    assert result == current_context
    service.db.get_artifact.assert_not_called()


def test_parse_s3_upload_target_ignores_stop_words():
    service = S3ContextService(Mock(), Mock(), Mock())
    
    # "bucket not allowed" should NOT match "not" as bucket
    result = service.parse_s3_upload_target_from_instructions("do not upload to bucket not allowed")
    assert result is None

    # "bucket my-bucket" SHOULD match "my-bucket"
    result = service.parse_s3_upload_target_from_instructions("upload to bucket my-bucket on s3")
    assert result == {"bucket": "my-bucket", "region": "us-east-1"}
