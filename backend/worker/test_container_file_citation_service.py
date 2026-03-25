#!/usr/bin/env python3

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

# Add the worker directory to Python path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

from artifact_service import ArtifactService  # noqa: E402
from services.container_file_citation_service import ContainerFileCitationService  # noqa: E402


class DummyBinaryResponse:
    def __init__(self, content: bytes):
        self.content = content


class DummyImageResponse:
    def __init__(self, content: bytes, content_type: str = "image/png"):
        self.content = content
        self.headers = {"Content-Type": content_type}

    def raise_for_status(self):
        return None


class DummyContentClient:
    def __init__(self, file_contents):
        self.file_contents = file_contents

    def retrieve(self, file_id, *, container_id):
        return DummyBinaryResponse(self.file_contents[(container_id, file_id)])


class DummyFilesClient:
    def __init__(self, metadata, file_contents):
        self.metadata = metadata
        self.content = DummyContentClient(file_contents)

    def retrieve(self, file_id, *, container_id):
        return self.metadata[(container_id, file_id)]


class DummyOpenAIClient:
    def __init__(self, metadata, file_contents):
        self.containers = SimpleNamespace(files=DummyFilesClient(metadata, file_contents))


def test_sync_generated_files_rewrites_sandbox_paths_to_public_urls():
    metadata = {
        ("cntr_123", "cfile_html"): SimpleNamespace(path="/mnt/data/lead_magnet_stockton_lehi.html"),
        ("cntr_123", "cfile_svg"): SimpleNamespace(path="/mnt/data/cover_stockton_lehi.svg"),
    }
    file_contents = {
        ("cntr_123", "cfile_html"): b"<html>lead magnet</html>",
        ("cntr_123", "cfile_svg"): b"<svg>cover</svg>",
    }

    artifact_service = Mock()
    artifact_service.store_artifact.side_effect = ["art_html", "art_svg"]
    artifact_service.get_artifact_public_url.side_effect = [
        "https://assets.example.com/tenant/jobs/job_123/lead_magnet_stockton_lehi.html",
        "https://assets.example.com/tenant/jobs/job_123/cover_stockton_lehi.svg",
    ]
    artifact_service.get_content_type.side_effect = lambda filename: {
        "lead_magnet_stockton_lehi.html": "text/html",
        "cover_stockton_lehi.svg": "image/svg+xml",
    }[filename]

    service = ContainerFileCitationService(
        openai_client=DummyOpenAIClient(metadata, file_contents),
        artifact_service=artifact_service,
    )

    raw_response = {
        "output": [
            {
                "type": "message",
                "content": [
                    {
                        "type": "output_text",
                        "text": (
                            "Lead magnet: sandbox:/mnt/data/lead_magnet_stockton_lehi.html\n"
                            "Cover SVG: sandbox:/mnt/data/cover_stockton_lehi.svg"
                        ),
                        "annotations": [
                            {
                                "type": "container_file_citation",
                                "container_id": "cntr_123",
                                "file_id": "cfile_html",
                                "filename": "opaque_generated_name_1.bin",
                            },
                            {
                                "type": "container_file_citation",
                                "container_id": "cntr_123",
                                "file_id": "cfile_svg",
                                "filename": "opaque_generated_name_2.bin",
                            },
                        ],
                    }
                ],
            }
        ]
    }

    updated_content, stored_files = service.sync_generated_files(
        raw_response=raw_response,
        content=raw_response["output"][0]["content"][0]["text"],
        tenant_id="tenant",
        job_id="job_123",
    )

    assert "sandbox:/mnt/data/" not in updated_content
    assert "https://assets.example.com/tenant/jobs/job_123/lead_magnet_stockton_lehi.html" in updated_content
    assert "https://assets.example.com/tenant/jobs/job_123/cover_stockton_lehi.svg" in updated_content
    assert len(stored_files) == 2

    store_calls = artifact_service.store_artifact.call_args_list
    assert store_calls[0].kwargs["filename"] == "lead_magnet_stockton_lehi.html"
    assert store_calls[1].kwargs["filename"] == "cover_stockton_lehi.svg"


def test_artifact_service_get_content_type_supports_svg():
    service = ArtifactService(db_service=Mock(), s3_service=Mock())
    assert service.get_content_type("cover.svg") == "image/svg+xml"


def test_store_image_artifact_persists_once(monkeypatch):
    monkeypatch.delenv("API_URL", raising=False)
    monkeypatch.delenv("API_GATEWAY_URL", raising=False)

    db_service = Mock()
    s3_service = Mock()
    s3_service.bucket_name = "leadmagnet-artifacts-test"
    s3_service.cloudfront_domain = "cdn.example.com"
    s3_service.upload_image.return_value = (
        "s3://leadmagnet-artifacts-test/tenant/jobs/job_123/image.png",
        "https://cdn.example.com/tenant/jobs/job_123/image.png",
    )

    service = ArtifactService(db_service=db_service, s3_service=s3_service)

    with patch("artifact_service.requests.get", return_value=DummyImageResponse(b"image-bytes")):
        artifact_id = service.store_image_artifact(
            tenant_id="tenant",
            job_id="job_123",
            image_url="https://example.com/image.png",
            filename="image.png",
        )

    assert artifact_id.startswith("art_")
    assert db_service.put_artifact.call_count == 1
    assert s3_service.upload_image.call_count == 1
