"""
Regression tests for execution_steps persistence (S3-backed).

This guards against the historical bug where stale in-memory execution_steps
overwrote the canonical `execution_steps.json` in S3 during finalization.
"""

import sys
from pathlib import Path
from unittest.mock import Mock


# Add the worker directory to Python path so imports work
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))


from services.job_completion_service import JobCompletionService  # noqa: E402


def test_finalize_job_reloads_execution_steps_before_appending_final_output():
    """
    If execution_steps passed into finalize_job() are stale/partial, we must reload
    the authoritative list from S3 (via db.get_job(..., s3_service=...)) before we append
    the final output step and persist.
    """

    # Arrange: mocks + minimal objects
    artifact_service = Mock()
    artifact_service.store_artifact.return_value = "art_final_123"
    artifact_service.get_artifact_public_url.return_value = "https://example.com/final.html"

    db_service = Mock()
    s3_service = Mock()
    delivery_service = Mock()
    usage_service = Mock()

    # The authoritative list in S3 already has 2 steps…
    canonical_steps = [
        {"step_name": "Step 1", "step_order": 1, "step_type": "ai_generation", "output": "a"},
        {"step_name": "Step 2", "step_order": 2, "step_type": "ai_generation", "output": "b"},
    ]
    db_service.get_job.return_value = {"execution_steps": canonical_steps}
    db_service.create_notification = Mock()

    svc = JobCompletionService(
        artifact_service=artifact_service,
        db_service=db_service,
        s3_service=s3_service,
        delivery_service=delivery_service,
        usage_service=usage_service,
    )

    # …but the caller passes a stale list with only 1 step.
    stale_steps = [
        {"step_name": "Step 1", "step_order": 1, "step_type": "ai_generation", "output": "a"},
    ]

    job_id = "job_test_123"
    job = {"job_id": job_id, "tenant_id": "cust_test"}
    workflow = {"delivery_method": "none", "workflow_name": "Test Workflow"}
    submission = {"submitter_email": "test@example.com"}

    # Act
    public_url = svc.finalize_job(
        job_id=job_id,
        job=job,
        workflow=workflow,
        submission=submission,
        final_content="<html>ok</html>",
        final_artifact_type="html_final",
        final_filename="final.html",
        report_artifact_id=None,
        all_image_artifact_ids=[],
        execution_steps=stale_steps,
    )

    # Assert: URL is returned
    assert public_url == "https://example.com/final.html"

    # Assert: we reloaded from db.get_job(job_id, s3_service=...) before update_job
    db_service.get_job.assert_called()
    assert db_service.get_job.call_args.args[0] == job_id
    assert db_service.get_job.call_args.kwargs.get("s3_service") is s3_service

    # Assert: update_job persisted canonical + final_output (not stale-only)
    assert db_service.update_job.called, "finalize_job must persist execution_steps"
    update_kwargs = db_service.update_job.call_args.args[1] if db_service.update_job.call_args.args else {}
    persisted_steps = update_kwargs.get("execution_steps", [])

    assert len(persisted_steps) == 3, "should contain 2 canonical steps + 1 final_output step"
    assert persisted_steps[0]["step_order"] == 1
    assert persisted_steps[1]["step_order"] == 2
    assert persisted_steps[-1]["step_type"] == "final_output"


