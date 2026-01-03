import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add worker directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.step_processor import StepProcessor
from services.steps.base import AbstractStepHandler
from services.steps.registry import StepRegistry

class MockStepHandler(AbstractStepHandler):
    def execute(self, step, step_index, job_id, tenant_id, context, step_outputs, execution_steps):
        return {
            'step_name': step.get('step_name'),
            'step_index': step_index,
            'output': 'mock_output',
            'artifact_id': 'mock_artifact',
            'image_urls': [],
            'success': True
        }, ['mock_image_artifact']

class TestStepProcessorRefactor(unittest.TestCase):
    def setUp(self):
        self.mock_ai_service = MagicMock()
        self.mock_artifact_service = MagicMock()
        self.mock_db_service = MagicMock()
        self.mock_s3_service = MagicMock()
        self.mock_usage_service = MagicMock()
        self.mock_image_artifact_service = MagicMock()
        
        self.processor = StepProcessor(
            ai_service=self.mock_ai_service,
            artifact_service=self.mock_artifact_service,
            db_service=self.mock_db_service,
            s3_service=self.mock_s3_service,
            usage_service=self.mock_usage_service,
            image_artifact_service=self.mock_image_artifact_service
        )

    def test_registry_initialization(self):
        """Test that default handlers are registered."""
        registry = self.processor.registry
        self.assertIsNotNone(registry.get_handler('ai_generation'))
        self.assertIsNotNone(registry.get_handler('webhook'))
        self.assertIsNotNone(registry.get_handler('browser'))
        self.assertIsNotNone(registry.get_handler('html'))

    def test_process_step_batch_mode_delegation(self):
        """Test that process_step_batch_mode delegates to the correct handler."""
        # Register a mock handler
        mock_handler = MockStepHandler({})
        mock_handler.execute = MagicMock(return_value=({
            'step_name': 'Test Step',
            'output': 'mock_output',
            'artifact_id': 'mock_artifact',
            'success': True
        }, ['mock_image_id']))
        
        self.processor.registry.register('test_type', mock_handler)
        
        step = {'step_name': 'Test Step', 'step_type': 'test_type'}
        
        # Mock DB get_job to avoid side effects
        self.mock_db_service.get_job.return_value = {'execution_steps': []}
        
        result, image_ids = self.processor.process_step_batch_mode(
            step=step,
            step_index=0,
            job_id='job_123',
            tenant_id='tenant_123',
            initial_context='',
            step_outputs=[],
            sorted_steps=[step],
            execution_steps=[],
            all_image_artifact_ids=[]
        )
        
        # Verify handler was called
        mock_handler.execute.assert_called_once()
        self.assertEqual(result['output'], 'mock_output')
        self.assertEqual(image_ids, ['mock_image_id'])

    def test_process_step_webhook_detection(self):
        """Test that steps with webhook_url are routed to webhook handler."""
        webhook_handler = self.processor.registry.get_handler('webhook')
        webhook_handler.execute = MagicMock(return_value=({'success': True}, []))
        
        step = {'step_name': 'Webhook Step', 'webhook_url': 'https://example.com'}
        
        self.mock_db_service.get_job.return_value = {'execution_steps': []}
        
        self.processor.process_step_batch_mode(
            step=step,
            step_index=0,
            job_id='job_123',
            tenant_id='tenant_123',
            initial_context='',
            step_outputs=[],
            sorted_steps=[step],
            execution_steps=[],
            all_image_artifact_ids=[]
        )
        
        webhook_handler.execute.assert_called_once()

if __name__ == '__main__':
    unittest.main()
