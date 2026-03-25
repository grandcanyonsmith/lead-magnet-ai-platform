import logging
import os
import re
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)


class ContainerFileCitationService:
    """
    Download code interpreter container files and store them as regular artifacts.

    OpenAI code interpreter often returns generated files as container file citations
    on assistant message annotations. This service downloads those files while the
    container is still active, stores them in our artifact system, and rewrites any
    leaked sandbox paths in the model text to public URLs.
    """

    def __init__(self, openai_client: Any, artifact_service: Any):
        self.openai_client = openai_client
        self.artifact_service = artifact_service

    def sync_generated_files(
        self,
        *,
        raw_response: Any,
        content: str,
        tenant_id: str,
        job_id: str,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        citations = self._extract_container_file_citations(raw_response)
        if not citations:
            return content, []

        files_client = self._get_files_client()
        if files_client is None:
            logger.warning(
                "[ContainerFileCitationService] OpenAI containers.files client unavailable; "
                "skipping container file sync"
            )
            return content, []

        stored_files: List[Dict[str, Any]] = []
        seen_pairs = set()

        for citation in citations:
            container_id = str(citation.get("container_id") or "").strip()
            file_id = str(citation.get("file_id") or "").strip()
            if not container_id or not file_id:
                continue

            pair = (container_id, file_id)
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)

            try:
                metadata = files_client.retrieve(file_id, container_id=container_id)
                container_path = (
                    self._get_attr(metadata, "path")
                    or citation.get("path")
                    or citation.get("filename")
                    or file_id
                )
                download = files_client.content.retrieve(file_id, container_id=container_id)
                file_bytes = self._read_bytes(download)
                if not file_bytes:
                    logger.warning(
                        "[ContainerFileCitationService] Container file downloaded empty",
                        extra={
                            "container_id": container_id,
                            "file_id": file_id,
                            "container_path": container_path,
                        },
                    )
                    continue

                filename = (
                    os.path.basename(str(container_path).strip())
                    or str(citation.get("filename") or "").strip()
                    or f"{file_id}.bin"
                )

                artifact_id = self.artifact_service.store_artifact(
                    tenant_id=tenant_id,
                    job_id=job_id,
                    artifact_type="code_interpreter_file",
                    content=file_bytes,
                    filename=filename,
                    public=True,
                )
                public_url = self.artifact_service.get_artifact_public_url(artifact_id)
                mime_type = self.artifact_service.get_content_type(filename)

                stored_files.append(
                    {
                        "artifact_id": artifact_id,
                        "public_url": public_url,
                        "filename": filename,
                        "container_id": container_id,
                        "file_id": file_id,
                        "container_path": str(container_path),
                        "mime_type": mime_type,
                    }
                )
            except Exception as exc:
                logger.warning(
                    "[ContainerFileCitationService] Failed to sync container file",
                    extra={
                        "container_id": container_id,
                        "file_id": file_id,
                        "filename": citation.get("filename"),
                        "error": str(exc),
                    },
                    exc_info=True,
                )

        if not stored_files:
            return content, []

        updated_content = self._replace_sandbox_paths(content, stored_files)
        return updated_content, stored_files

    def _get_files_client(self) -> Any:
        containers_client = getattr(self.openai_client, "containers", None)
        files_client = getattr(containers_client, "files", None) if containers_client else None
        if not files_client:
            return None

        content_client = getattr(files_client, "content", None)
        if not content_client:
            return None

        if not callable(getattr(files_client, "retrieve", None)):
            return None
        if not callable(getattr(content_client, "retrieve", None)):
            return None

        return files_client

    @staticmethod
    def _get_attr(obj: Any, key: str) -> Any:
        if isinstance(obj, dict):
            return obj.get(key)
        return getattr(obj, key, None)

    def _extract_container_file_citations(self, raw_response: Any) -> List[Dict[str, Any]]:
        output_items = self._get_attr(raw_response, "output")
        if not isinstance(output_items, list):
            return []

        citations: List[Dict[str, Any]] = []
        for item in output_items:
            if self._get_attr(item, "type") != "message":
                continue

            content_parts = self._get_attr(item, "content")
            if not isinstance(content_parts, list):
                continue

            for part in content_parts:
                part_type = self._get_attr(part, "type")
                if part_type not in ("output_text", "text"):
                    continue

                annotations = self._get_attr(part, "annotations")
                if not isinstance(annotations, list):
                    continue

                for annotation in annotations:
                    if self._get_attr(annotation, "type") != "container_file_citation":
                        continue

                    citations.append(
                        {
                            "container_id": self._get_attr(annotation, "container_id"),
                            "file_id": self._get_attr(annotation, "file_id"),
                            "filename": self._get_attr(annotation, "filename"),
                            "start_index": self._get_attr(annotation, "start_index"),
                            "end_index": self._get_attr(annotation, "end_index"),
                        }
                    )

        return citations

    def _replace_sandbox_paths(self, content: str, stored_files: List[Dict[str, Any]]) -> str:
        if not isinstance(content, str) or not content:
            return content

        updated = content
        for stored_file in stored_files:
            public_url = str(stored_file.get("public_url") or "").strip()
            if not public_url:
                continue

            container_path = str(stored_file.get("container_path") or "").strip()
            filename = str(stored_file.get("filename") or "").strip()

            exact_candidates = []
            if container_path:
                exact_candidates.append(container_path)
                if container_path.startswith("/"):
                    exact_candidates.append(f"sandbox:{container_path}")
            if filename:
                exact_candidates.append(f"/mnt/data/{filename}")
                exact_candidates.append(f"sandbox:/mnt/data/{filename}")

            for candidate in exact_candidates:
                updated = updated.replace(candidate, public_url)

            if filename:
                escaped_filename = re.escape(filename)
                updated = re.sub(
                    rf"sandbox:/mnt/data/[^\s\])>]*{escaped_filename}",
                    public_url,
                    updated,
                )
                updated = re.sub(
                    rf"/mnt/data/[^\s\])>]*{escaped_filename}",
                    public_url,
                    updated,
                )

        return updated

    @staticmethod
    def _read_bytes(download: Any) -> bytes:
        if download is None:
            return b""
        if isinstance(download, bytes):
            return download
        if isinstance(download, bytearray):
            return bytes(download)
        if isinstance(download, str):
            return download.encode("utf-8")

        content = getattr(download, "content", None)
        if isinstance(content, bytes):
            return content
        if isinstance(content, bytearray):
            return bytes(content)
        if isinstance(content, str):
            return content.encode("utf-8")

        read_method = getattr(download, "read", None)
        if callable(read_method):
            data = read_method()
            if isinstance(data, bytes):
                return data
            if isinstance(data, bytearray):
                return bytes(data)
            if isinstance(data, str):
                return data.encode("utf-8")

        return b""
