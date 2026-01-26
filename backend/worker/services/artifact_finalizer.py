import logging
from typing import Optional, Tuple

from artifact_service import ArtifactService
from services.html_sanitizer import strip_template_placeholders, strip_form_elements
from services.pdf_generator import PDFGenerator
from services.tracking_script_generator import TrackingScriptGenerator
from services.recording_script_generator import RecordingScriptGenerator
from services.editor_overlay_generator import EditorOverlayGenerator

logger = logging.getLogger(__name__)

class ArtifactFinalizer:
    """
    Helper service for finalizing artifacts (HTML injection, PDF generation, storage).
    """

    def __init__(self, artifact_service: ArtifactService):
        self.artifact_service = artifact_service

    def prepare_html_content(
        self,
        html_content: str,
        job_id: str,
        tenant_id: str,
        api_url: Optional[str] = None
    ) -> str:
        """
        Prepare HTML content by stripping placeholders/forms and injecting scripts.
        """
        if not isinstance(html_content, str) or not html_content.strip():
            return html_content

        # Strip placeholders and form elements
        final_content = strip_template_placeholders(html_content)
        final_content = strip_form_elements(final_content)

        # Inject tracking script
        if 'Lead Magnet Tracking Script' not in final_content:
            tracking_generator = TrackingScriptGenerator()
            final_content = tracking_generator.inject_tracking_script(
                html_content=final_content,
                job_id=job_id,
                tenant_id=tenant_id,
                api_url=api_url
            )

        # Inject recording script
        if 'Session Recording Script' not in final_content:
            recording_generator = RecordingScriptGenerator()
            final_content = recording_generator.inject_recording_script(
                html_content=final_content,
                job_id=job_id,
                tenant_id=tenant_id,
                api_url=api_url
            )

        # Inject editor overlay
        if 'Lead Magnet Editor Overlay' not in final_content:
            editor_generator = EditorOverlayGenerator()
            final_content = editor_generator.inject_editor_overlay(
                html_content=final_content,
                job_id=job_id,
                tenant_id=tenant_id,
                api_url=api_url
            )

        return final_content

    def store_pdf_deliverable(
        self,
        job_id: str,
        tenant_id: str,
        html_content: str
    ) -> Optional[str]:
        """
        Best-effort PDF generation from HTML content.
        Returns the PDF artifact ID when successful, otherwise None.
        """
        if not isinstance(html_content, str) or not html_content.strip():
            return None

        try:
            pdf_generator = PDFGenerator()
            pdf_bytes = pdf_generator.generate_pdf(html_content)
            pdf_artifact_id = self.artifact_service.store_artifact(
                tenant_id=tenant_id,
                job_id=job_id,
                artifact_type='pdf_final',
                content=pdf_bytes,
                filename='final.pdf',
                public=True
            )
            pdf_public_url = self.artifact_service.get_artifact_public_url(pdf_artifact_id)
            logger.info(
                "[ArtifactFinalizer] PDF deliverable stored",
                extra={'job_id': job_id, 'pdf_url_preview': pdf_public_url[:80]}
            )
            return pdf_artifact_id
        except Exception as pdf_error:
            logger.warning(
                "[ArtifactFinalizer] Failed to generate PDF deliverable",
                extra={'job_id': job_id, 'error': str(pdf_error)}
            )
            return None
