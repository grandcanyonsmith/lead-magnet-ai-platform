"""
Unit tests for lead magnet handoff step handler.
"""

import sys
from unittest.mock import Mock, patch

# Add the worker directory to Python path so imports work
from pathlib import Path

worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

from services.steps.handlers.handoff import HandoffStepHandler


@patch("services.steps.handlers.handoff.requests.post")
def test_handoff_step_triggers_destination_workflow(mock_post):
    db = Mock()
    s3 = Mock()

    db.get_job.return_value = {
        "job_id": "job_1",
        "tenant_id": "tenant_1",
        "workflow_id": "wf_source",
        "submission_id": "sub_1",
        "api_url": "https://api.example.com",
    }
    db.get_submission.return_value = {
        "submission_id": "sub_1",
        "submission_data": {"name": "Test User", "email": "test@example.com"},
    }
    db.get_workflow.return_value = {
        "workflow_id": "wf_target",
        "tenant_id": "tenant_1",
        "workflow_name": "Target Workflow",
    }
    db.ensure_webhook_token.return_value = "token_123"

    mock_resp = Mock()
    mock_resp.status_code = 202
    mock_resp.text = '{"job_id":"job_child"}'
    mock_resp.json.return_value = {"job_id": "job_child"}
    mock_post.return_value = mock_resp

    handler = HandoffStepHandler({"db_service": db, "s3_service": s3})

    step = {
        "step_name": "Handoff",
        "handoff_workflow_id": "wf_target",
        "handoff_payload_mode": "previous_step_output",
        "handoff_input_field": "input",
    }

    execution_steps = []
    step_outputs = [{"output": "previous output"}]

    result, image_artifact_ids = handler.execute(
        step=step,
        step_index=1,
        job_id="job_1",
        tenant_id="tenant_1",
        context="CTX",
        step_outputs=step_outputs,
        execution_steps=execution_steps,
    )

    assert image_artifact_ids == []
    assert result["success"] is True
    assert result["handoff_result"]["triggered_job_id"] == "job_child"

    mock_post.assert_called_once()
    called_url = mock_post.call_args.args[0]
    assert called_url == "https://api.example.com/v1/webhooks/token_123"

    called_json = mock_post.call_args.kwargs["json"]
    assert called_json["workflow_id"] == "wf_target"
    assert called_json["submission_data"]["input"] == "previous output"

