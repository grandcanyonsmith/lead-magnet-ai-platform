import os
import sys
import unittest
from unittest.mock import MagicMock


sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.workflow_orchestrator import WorkflowOrchestrator


class TestWorkflowOrchestratorDependencyAlignment(unittest.TestCase):
    def test_batch_execution_keeps_original_workflow_indices(self):
        mock_step_processor = MagicMock()

        def process_step_batch_mode(**kwargs):
            step = kwargs["step"]
            step_index = kwargs["step_index"]
            return (
                {
                    "step_name": step["step_name"],
                    "step_index": step_index,
                    "output": step["step_name"],
                    "artifact_id": f"art_{step_index}",
                    "image_urls": [],
                },
                [],
            )

        mock_step_processor.process_step_batch_mode.side_effect = process_step_batch_mode

        orchestrator = WorkflowOrchestrator(
            step_processor=mock_step_processor,
            ai_service=MagicMock(),
            db_service=MagicMock(),
            s3_service=MagicMock(),
            job_completion_service=MagicMock(),
        )

        workflow = {
            "workflow_id": "wf_123",
            "steps": [
                {
                    "step_name": "Second",
                    "step_order": 1,
                    "depends_on": [1],
                },
                {
                    "step_name": "First",
                    "step_order": 0,
                    "depends_on": [],
                },
            ],
        }

        final_content, _, _, report_artifact_id, _ = orchestrator.execute_workflow(
            job_id="job_123",
            job={"tenant_id": "tenant_123"},
            workflow=workflow,
            submission={"submission_data": {}},
            form=None,
            execution_steps=[],
        )

        calls = mock_step_processor.process_step_batch_mode.call_args_list
        self.assertEqual(calls[0].kwargs["step"]["step_name"], "First")
        self.assertEqual(calls[0].kwargs["step_index"], 1)
        self.assertEqual(calls[0].kwargs["workflow_steps"], workflow["steps"])

        self.assertEqual(calls[1].kwargs["step"]["step_name"], "Second")
        self.assertEqual(calls[1].kwargs["step_index"], 0)
        self.assertEqual(calls[1].kwargs["workflow_steps"], workflow["steps"])

        self.assertEqual(final_content, "Second")
        self.assertEqual(report_artifact_id, "art_0")


if __name__ == "__main__":
    unittest.main()
