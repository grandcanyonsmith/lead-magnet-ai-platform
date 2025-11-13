"""
Data Loader Service
Handles batch loading of job-related data in parallel for better performance.
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, Optional, Tuple

from db_service import DynamoDBService

logger = logging.getLogger(__name__)


class DataLoaderService:
    """Service for loading job-related data in parallel."""
    
    def __init__(self, db_service: DynamoDBService):
        """
        Initialize data loader service.
        
        Args:
            db_service: DynamoDB service instance
        """
        self.db = db_service
    
    def load_job_data(self, job_id: str) -> Dict[str, Any]:
        """
        Load all job-related data in parallel.
        
        This method loads job, workflow, submission, and form data concurrently
        to reduce overall latency.
        
        Args:
            job_id: Job ID to load data for
            
        Returns:
            Dictionary containing:
                - job: Job dictionary
                - workflow: Workflow dictionary
                - submission: Submission dictionary
                - form: Optional form dictionary
                
        Raises:
            ValueError: If job, workflow, or submission is not found
        """
        # First, load job to get IDs for other resources
        job = self.db.get_job(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")
        
        workflow_id = job.get('workflow_id')
        submission_id = job.get('submission_id')
        
        if not workflow_id:
            raise ValueError(f"Job {job_id} has no workflow_id")
        if not submission_id:
            raise ValueError(f"Job {job_id} has no submission_id")
        
        # Load workflow, submission, and form in parallel
        with ThreadPoolExecutor(max_workers=3) as executor:
            # Submit tasks
            workflow_future = executor.submit(self.db.get_workflow, workflow_id)
            submission_future = executor.submit(self.db.get_submission, submission_id)
            
            # Get form_id from submission if available
            submission = submission_future.result()
            if not submission:
                raise ValueError(f"Submission {submission_id} not found")
            
            form_id = submission.get('form_id')
            form_future = executor.submit(self._get_form_safe, form_id) if form_id else None
            
            # Get results
            workflow = workflow_future.result()
            if not workflow:
                raise ValueError(f"Workflow {workflow_id} not found")
            
            form = form_future.result() if form_future else None
        
        return {
            'job': job,
            'workflow': workflow,
            'submission': submission,
            'form': form
        }
    
    def _get_form_safe(self, form_id: str) -> Optional[Dict[str, Any]]:
        """
        Safely get form, returning None if not found instead of raising.
        
        Args:
            form_id: Form ID
            
        Returns:
            Form dictionary or None if not found
        """
        try:
            return self.db.get_form(form_id)
        except Exception as e:
            logger.warning(f"Could not retrieve form {form_id}: {e}")
            return None

