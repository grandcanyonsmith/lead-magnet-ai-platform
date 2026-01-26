"""
Unit tests for S3ContextService.
"""

import sys
from pathlib import Path
from unittest.mock import Mock
from botocore.exceptions import ClientError

# Add the worker directory to Python path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

import services.s3_context_service as s3_context_service  # noqa: E402
from services.s3_context_service import S3ContextService  # noqa: E402


class FakeS3Client:
    def __init__(self, *, existing_keys=None, fail_first=False):
        self.existing_keys = set(existing_keys or [])
        self.fail_first = fail_first
        self.upload_attempts = []

    def head_object(self, Bucket, Key):
        if Key in self.existing_keys:
            return {"ResponseMetadata": {"HTTPStatusCode": 200}}
        raise ClientError({"Error": {"Code": "404"}}, "HeadObject")

    def upload_fileobj(self, Fileobj, Bucket, Key, ExtraArgs):
        self.upload_attempts.append({"key": Key, "extra_args": ExtraArgs})
        if self.fail_first and len(self.upload_attempts) == 1:
            raise ClientError({"Error": {"Code": "AccessDenied"}}, "PutObject")

    def upload_file(self, Filename, Bucket, Key, ExtraArgs):
        self.upload_attempts.append({"key": Key, "extra_args": ExtraArgs})
        if self.fail_first and len(self.upload_attempts) == 1:
            raise ClientError({"Error": {"Code": "AccessDenied"}}, "PutObject")


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

    # "bucket custom-data-bucket" SHOULD match "custom-data-bucket"
    result = service._parse_s3_upload_target_from_instructions("upload to bucket custom-data-bucket on s3")
    assert result == {"bucket": "custom-data-bucket", "region": "us-east-1"}


def test_process_step_upload_renames_on_existing_key(monkeypatch):
    monkeypatch.setenv("SHELL_S3_UPLOAD_ALLOWED_BUCKETS", "my-test-bucket")
    monkeypatch.setenv("SHELL_S3_UPLOAD_KEY_PREFIX", "test/")
    fake_s3 = FakeS3Client(existing_keys={"test/artifact123.html"})
    monkeypatch.setattr(s3_context_service.boto3, "client", lambda *args, **kwargs: fake_s3)

    service = S3ContextService(Mock(), Mock(), Mock())
    step = {
        "instructions": "Generate HTML",
        "output_config": {"storage_provider": "s3", "source_type": "text_content"},
    }
    step_output_result = {"output": "<html></html>", "artifact_id": "artifact123"}

    result = service.process_step_upload(
        step=step,
        step_index=0,
        tenant_id="tenant_123",
        job_id="job_123",
        step_name="Step 1",
        step_output_result=step_output_result,
    )

    assert result["success"] is True
    uploaded_key = fake_s3.upload_attempts[0]["key"]
    assert uploaded_key != "test/artifact123.html"
    assert uploaded_key.startswith("test/artifact123_")
    assert uploaded_key.endswith(".html")
    assert fake_s3.upload_attempts[0]["extra_args"]["ACL"] == "bucket-owner-full-control"


def test_process_step_upload_retries_with_randomized_key(monkeypatch):
    monkeypatch.setenv("SHELL_S3_UPLOAD_ALLOWED_BUCKETS", "my-test-bucket")
    monkeypatch.setenv("SHELL_S3_UPLOAD_KEY_PREFIX", "test/")
    fake_s3 = FakeS3Client(fail_first=True)
    monkeypatch.setattr(s3_context_service.boto3, "client", lambda *args, **kwargs: fake_s3)

    service = S3ContextService(Mock(), Mock(), Mock())
    step = {
        "instructions": "Generate HTML",
        "output_config": {"storage_provider": "s3", "source_type": "text_content"},
    }
    step_output_result = {"output": "<html></html>", "artifact_id": "artifact123"}

    result = service.process_step_upload(
        step=step,
        step_index=0,
        tenant_id="tenant_123",
        job_id="job_123",
        step_name="Step 1",
        step_output_result=step_output_result,
    )

    assert result["success"] is True
    assert len(fake_s3.upload_attempts) == 2
    first_key = fake_s3.upload_attempts[0]["key"]
    retry_key = fake_s3.upload_attempts[1]["key"]
    assert first_key != retry_key
    assert retry_key.startswith("test/artifact123_")
