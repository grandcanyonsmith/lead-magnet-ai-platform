"""
Tests for final deliverable generation + tracking injection.

These are unit-level tests and must be hermetic (no AWS / no OpenAI network calls).
"""

import os
import sys
from pathlib import Path
from unittest.mock import Mock, patch


worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("ARTIFACTS_BUCKET", "leadmagnet-artifacts-test")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")


from services.workflow_orchestrator import WorkflowOrchestrator  # noqa: E402
from services.job_completion_service import JobCompletionService  # noqa: E402


def _make_orchestrator():
    return WorkflowOrchestrator(
        step_processor=Mock(),
        ai_service=Mock(),
        db_service=Mock(),
        s3_service=Mock(),
        job_completion_service=Mock(),
    )


def test_orchestrator_detects_html_final_from_content():
    """If the last step output is HTML, the final deliverable type should be html_final."""
    orchestrator = _make_orchestrator()

    workflow = {"steps": [{"model": "gpt-5"}]}
    step_outputs = [{"output": "<html><body>LANDING</body></html>"}]

    final_content, final_type, final_filename = orchestrator._generate_final_content(
        workflow=workflow,
        step_outputs=step_outputs,
        accumulated_context="<html><body>LANDING</body></html>",
        submission_data={},
        field_label_map={},
        execution_steps=[],
        job_id="job_test",
        tenant_id="tenant_test",
    )

    assert final_type == "html_final"
    assert final_filename == "final.html"
    assert "<html>" in final_content


def test_orchestrator_extracts_html_from_shell_tool_output():
    """Deliverable extraction should pull real HTML out of shell heredoc tool output."""
    orchestrator = _make_orchestrator()

    workflow = {"steps": [{"step_name": "Build deliverable"}]}
    step_outputs = [{
        "step_name": "Build deliverable",
        "output": """Done - I created the file.

[Tool output]
$ cat > index.html <<'EOF'
<!DOCTYPE html>
<html><body>LANDING</body></html>
EOF""",
    }]

    final_content, final_type, final_filename = orchestrator._generate_final_content(
        workflow=workflow,
        step_outputs=step_outputs,
        accumulated_context=step_outputs[0]["output"],
        submission_data={},
        field_label_map={},
        execution_steps=[],
        job_id="job_test",
        tenant_id="tenant_test",
    )

    assert final_type == "html_final"
    assert final_filename == "final.html"
    assert final_content.startswith("<!DOCTYPE html>")
    assert "[Tool output]" not in final_content


def test_orchestrator_uses_terminal_step_outputs_for_deliverable_context():
    """Deliverable context should be derived from terminal step outputs."""
    orchestrator = _make_orchestrator()

    workflow = {
        "steps": [
            {"step_name": "Research", "step_order": 0},
            {"step_name": "Deliverable Draft", "step_order": 1},
        ],
    }
    step_outputs = [
        {"output": "Research notes that should not ship."},
        {"output": "Final deliverable content only."},
    ]

    final_content, _, _ = orchestrator._generate_final_content(
        workflow=workflow,
        step_outputs=step_outputs,
        accumulated_context="Research notes\n\nFinal deliverable content only.",
        submission_data={},
        field_label_map={},
        execution_steps=[],
        job_id="job_test",
        tenant_id="tenant_test",
    )

    assert "Final deliverable content only." in final_content


def test_orchestrator_prefers_deliverable_flag_over_terminal_step():
    """If a step is explicitly marked as deliverable, use it over the terminal step."""
    orchestrator = _make_orchestrator()

    workflow = {
        "steps": [
            {"step_name": "Deliverable Draft", "step_order": 0, "is_deliverable": True},
            {"step_name": "Final Polish", "step_order": 1},
        ],
    }
    step_outputs = [
        {"output": "Chosen deliverable content."},
        {"output": "Terminal step content (should not be used)."},
    ]

    final_content, _, _ = orchestrator._generate_final_content(
        workflow=workflow,
        step_outputs=step_outputs,
        accumulated_context="Chosen deliverable content.\n\nTerminal step content.",
        submission_data={},
        field_label_map={},
        execution_steps=[],
        job_id="job_test",
        tenant_id="tenant_test",
    )

    assert "Chosen deliverable content." in final_content


def test_finalize_job_injects_tracking_script_for_html_final():
    """finalize_job() must inject the tracking script into HTML before storing."""
    artifact_service = Mock()
    call_counter = {"n": 0}

    def mock_store(**kwargs):
        call_counter["n"] += 1
        return f"art_{call_counter['n']}"

    artifact_service.store_artifact.side_effect = mock_store
    artifact_service.get_artifact_public_url.return_value = "https://cdn.example.com/final.html"

    db_service = Mock()
    db_service.get_job.return_value = {"execution_steps": []}
    db_service.create_notification = Mock()

    svc = JobCompletionService(
        artifact_service=artifact_service,
        db_service=db_service,
        s3_service=Mock(),
        delivery_service=Mock(),
        usage_service=Mock(),
    )

    # Mock PDF generation so it doesn't invoke Playwright
    svc.artifact_finalizer.store_pdf_deliverable = Mock(return_value="art_pdf_1")

    public_url = svc.finalize_job(
        job_id="job_test_123",
        job={"job_id": "job_test_123", "tenant_id": "t", "api_url": "https://api.example.com"},
        workflow={"delivery_method": "none", "workflow_name": "Test"},
        submission={"submitter_email": "test@example.com"},
        final_content="<html><body>Hello</body></html>",
        final_artifact_type="html_final",
        final_filename="final.html",
        report_artifact_id=None,
        all_image_artifact_ids=[],
        execution_steps=[],
    )

    assert public_url == "https://cdn.example.com/final.html"

    first_call = artifact_service.store_artifact.call_args_list[0]
    stored = first_call.kwargs.get("content", b"")
    if isinstance(stored, bytes):
        stored = stored.decode("utf-8", errors="replace")
    assert "Lead Magnet Tracking Script" in stored
    assert "api.example.com" in stored
