"""
Tests for template-based final deliverable + tracking injection.

These are unit-level tests and must be hermetic (no AWS / no OpenAI network calls).
"""

import os
import sys
from pathlib import Path
from unittest.mock import Mock


# Add the worker directory to Python path so imports work
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

# Unit tests should be hermetic. Avoid AWS Secrets Manager dependency in OpenAI client init.
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("ARTIFACTS_BUCKET", "leadmagnet-artifacts-test")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")


from services.workflow_orchestrator import WorkflowOrchestrator  # noqa: E402
from services.job_completion_service import JobCompletionService  # noqa: E402


def test_orchestrator_always_generates_template_final_even_if_last_step_is_html():
    """
    If a workflow has a template configured, the final deliverable should be generated
    from the template path, even if the last step output is HTML (e.g., an intermediate packaging step).
    """

    step_processor = Mock()
    ai_service = Mock()
    db_service = Mock()
    s3_service = Mock()
    job_completion_service = Mock()

    db_service.get_template.return_value = {"template_id": "tmpl_test", "html_content": "<html>tmpl</html>"}
    job_completion_service.generate_html_from_accumulated_context.return_value = (
        "<html>FINAL</html>",
        "html_final",
        "final.html",
    )

    orchestrator = WorkflowOrchestrator(
        step_processor=step_processor,
        ai_service=ai_service,
        db_service=db_service,
        s3_service=s3_service,
        job_completion_service=job_completion_service,
    )

    workflow = {"template_id": "tmpl_test", "template_version": 0, "steps": [{"model": "gpt-5"}]}
    step_outputs = [{"output": "<html><body>LANDING</body></html>"}]
    accumulated_context = "<div>Hello <b>world</b></div>"

    final_content, final_type, final_filename = orchestrator._generate_final_content(
        workflow=workflow,
        step_outputs=step_outputs,
        accumulated_context=accumulated_context,
        submission_data={},
        execution_steps=[],
        job_id="job_test",
        tenant_id="tenant_test",
    )

    assert final_content == "<html>FINAL</html>"
    assert final_type == "html_final"
    assert final_filename == "final.html"

    assert job_completion_service.generate_html_from_accumulated_context.called
    called_ctx = job_completion_service.generate_html_from_accumulated_context.call_args.kwargs.get("accumulated_context", "")
    assert called_ctx == "LANDING"


def test_orchestrator_uses_terminal_step_outputs_for_deliverable_context():
    """
    Deliverable context should be built from terminal step outputs only,
    not from all accumulated step content.
    """
    step_processor = Mock()
    ai_service = Mock()
    db_service = Mock()
    s3_service = Mock()
    job_completion_service = Mock()

    db_service.get_template.return_value = {"template_id": "tmpl_test", "html_content": "<html>tmpl</html>"}
    job_completion_service.generate_html_from_accumulated_context.return_value = (
        "<html>FINAL</html>",
        "html_final",
        "final.html",
    )

    orchestrator = WorkflowOrchestrator(
        step_processor=step_processor,
        ai_service=ai_service,
        db_service=db_service,
        s3_service=s3_service,
        job_completion_service=job_completion_service,
    )

    workflow = {
        "template_id": "tmpl_test",
        "template_version": 0,
        "steps": [
            {"step_name": "Research", "step_order": 0},
            {"step_name": "Deliverable Draft", "step_order": 1},
        ],
    }
    step_outputs = [
        {"output": "Research notes that should not ship."},
        {"output": "Final deliverable content only."},
    ]
    accumulated_context = "Research notes that should not ship.\n\nFinal deliverable content only."

    orchestrator._generate_final_content(
        workflow=workflow,
        step_outputs=step_outputs,
        accumulated_context=accumulated_context,
        submission_data={},
        execution_steps=[],
        job_id="job_test",
        tenant_id="tenant_test",
    )

    called_ctx = job_completion_service.generate_html_from_accumulated_context.call_args.kwargs.get("accumulated_context", "")
    assert called_ctx == "Final deliverable content only."


def test_orchestrator_prefers_deliverable_flag_over_terminal_step():
    """
    If a step is explicitly marked as deliverable, it should be used even if it's not the terminal step.
    """
    step_processor = Mock()
    ai_service = Mock()
    db_service = Mock()
    s3_service = Mock()
    job_completion_service = Mock()

    db_service.get_template.return_value = {"template_id": "tmpl_test", "html_content": "<html>tmpl</html>"}
    job_completion_service.generate_html_from_accumulated_context.return_value = (
        "<html>FINAL</html>",
        "html_final",
        "final.html",
    )

    orchestrator = WorkflowOrchestrator(
        step_processor=step_processor,
        ai_service=ai_service,
        db_service=db_service,
        s3_service=s3_service,
        job_completion_service=job_completion_service,
    )

    workflow = {
        "template_id": "tmpl_test",
        "template_version": 0,
        "steps": [
            {"step_name": "Deliverable Draft", "step_order": 0, "is_deliverable": True},
            {"step_name": "Final Polish", "step_order": 1},
        ],
    }
    step_outputs = [
        {"output": "Chosen deliverable content."},
        {"output": "Terminal step content (should not be used)."},
    ]
    accumulated_context = "Chosen deliverable content.\n\nTerminal step content (should not be used)."

    orchestrator._generate_final_content(
        workflow=workflow,
        step_outputs=step_outputs,
        accumulated_context=accumulated_context,
        submission_data={},
        execution_steps=[],
        job_id="job_test",
        tenant_id="tenant_test",
    )

    called_ctx = job_completion_service.generate_html_from_accumulated_context.call_args.kwargs.get("accumulated_context", "")
    assert called_ctx == "Chosen deliverable content."


def test_finalize_job_injects_tracking_script_for_html_final():
    """
    finalize_job() must ensure the stored html_final deliverable contains the tracking script.
    """

    artifact_service = Mock()
    artifact_service.store_artifact.return_value = "art_final_123"
    artifact_service.get_artifact_public_url.return_value = "https://cdn.example.com/final.html"

    db_service = Mock()
    s3_service = Mock()
    delivery_service = Mock()
    usage_service = Mock()

    # Pretend there are already some execution steps in S3 so finalize_job reloads them
    db_service.get_job.return_value = {"execution_steps": []}
    db_service.create_notification = Mock()

    svc = JobCompletionService(
        artifact_service=artifact_service,
        db_service=db_service,
        s3_service=s3_service,
        delivery_service=delivery_service,
        usage_service=usage_service,
    )

    job_id = "job_test_123"
    job = {"job_id": job_id, "tenant_id": "tenant_test", "api_url": "https://api.example.com"}
    workflow = {"delivery_method": "none", "workflow_name": "Test Workflow"}
    submission = {"submitter_email": "test@example.com"}

    final_html = "<html><body>Hello</body></html>"

    public_url = svc.finalize_job(
        job_id=job_id,
        job=job,
        workflow=workflow,
        submission=submission,
        final_content=final_html,
        final_artifact_type="html_final",
        final_filename="final.html",
        report_artifact_id=None,
        all_image_artifact_ids=[],
        execution_steps=[],
    )

    assert public_url == "https://cdn.example.com/final.html"

    stored_content = artifact_service.store_artifact.call_args.kwargs.get("content", "")
    assert "Lead Magnet Tracking Script" in stored_content
    assert "api.example.com" in stored_content


