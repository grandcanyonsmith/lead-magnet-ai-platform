"""
DynamoDB Service
Handles all DynamoDB operations for the worker.
"""

import os
import logging
import json
from typing import Dict, Any, Optional
import boto3
from boto3.dynamodb.conditions import Key
from datetime import datetime
from ulid import new as ulid

logger = logging.getLogger(__name__)

# DynamoDB item size limit is 400KB
# We'll use 300KB as a safe threshold to leave room for other fields in the item
# This accounts for other job fields like status, timestamps, artifacts, etc.
MAX_DYNAMODB_ITEM_SIZE = 300 * 1024  # 300KB in bytes


class DynamoDBService:
    """Service for DynamoDB operations."""
    
    def __init__(self):
        """Initialize DynamoDB client."""
        self.dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        
        # Table references
        self.workflows_table = self.dynamodb.Table(os.environ['WORKFLOWS_TABLE'])
        self.forms_table = self.dynamodb.Table(os.environ['FORMS_TABLE'])
        self.submissions_table = self.dynamodb.Table(os.environ['SUBMISSIONS_TABLE'])
        self.jobs_table = self.dynamodb.Table(os.environ['JOBS_TABLE'])
        self.artifacts_table = self.dynamodb.Table(os.environ['ARTIFACTS_TABLE'])
        self.templates_table = self.dynamodb.Table(os.environ['TEMPLATES_TABLE'])
        self.user_settings_table = self.dynamodb.Table(os.environ.get('USER_SETTINGS_TABLE', 'user_settings'))
        self.usage_records_table = self.dynamodb.Table(os.environ.get('USAGE_RECORDS_TABLE', 'leadmagnet-usage-records'))
        self.notifications_table = self.dynamodb.Table(os.environ.get('NOTIFICATIONS_TABLE', 'leadmagnet-notifications'))
    
    def get_job(self, job_id: str, s3_service=None) -> Optional[Dict[str, Any]]:
        """
        Get job by ID.
        
        Args:
            job_id: Job ID
            s3_service: Optional S3Service instance to load execution_steps from S3 if stored there
        """
        try:
            response = self.jobs_table.get_item(Key={'job_id': job_id})
            job = response.get('Item')
            
            # If execution_steps is stored in S3, load it
            if job and s3_service and job.get('execution_steps_s3_key'):
                try:
                    s3_key = job['execution_steps_s3_key']
                    execution_steps_json = s3_service.download_artifact(s3_key)
                    job['execution_steps'] = json.loads(execution_steps_json)
                    logger.debug(f"Loaded execution_steps from S3 for job {job_id}")
                except Exception as e:
                    logger.error(f"Error loading execution_steps from S3 for job {job_id}: {e}")
                    # Fall back to empty array if S3 load fails
                    job['execution_steps'] = []
            
            return job
        except Exception as e:
            logger.error(f"Error getting job {job_id}: {e}")
            raise
    
    def _estimate_dynamodb_size(self, value: Any) -> int:
        """
        Estimate the size of a value when serialized for DynamoDB.
        This is approximate but should catch items that are clearly too large.
        DynamoDB serialization adds overhead, so we add a 10% buffer to be safe.
        """
        try:
            # Convert to JSON string to estimate size
            json_str = json.dumps(value, default=str)
            # Get actual UTF-8 byte size
            byte_size = len(json_str.encode('utf-8'))
            # Add 10% buffer for DynamoDB serialization overhead
            return int(byte_size * 1.1)
        except Exception:
            # Fallback: estimate based on string representation
            byte_size = len(str(value).encode('utf-8'))
            return int(byte_size * 1.1)
    
    def update_job(self, job_id: str, updates: Dict[str, Any], s3_service=None):
        """
        Update job with given fields.
        
        If execution_steps is too large (>350KB), it will be stored in S3
        and only the S3 key will be stored in DynamoDB.
        
        Args:
            job_id: Job ID
            updates: Dictionary of fields to update
            s3_service: Optional S3Service instance to store large execution_steps in S3
        """
        try:
            # Check if execution_steps is in updates and if it's too large
            if 'execution_steps' in updates and s3_service:
                execution_steps = updates['execution_steps']
                estimated_size = self._estimate_dynamodb_size(execution_steps)
                
                if estimated_size > MAX_DYNAMODB_ITEM_SIZE:
                    logger.info(f"execution_steps for job {job_id} is too large ({estimated_size} bytes), storing in S3")
                    # Store in S3
                    s3_key = f"jobs/{job_id}/execution_steps.json"
                    execution_steps_json = json.dumps(execution_steps, default=str)
                    s3_service.upload_artifact(s3_key, execution_steps_json, content_type='application/json', public=False)
                    
                    # Replace execution_steps with S3 key reference
                    updates['execution_steps_s3_key'] = s3_key
                    # Remove execution_steps from updates to avoid storing it in DynamoDB
                    del updates['execution_steps']
                    logger.info(f"Stored execution_steps in S3 at {s3_key} for job {job_id}")
            
            # Remove execution_steps_s3_key if we're storing execution_steps directly (and it fits)
            if 'execution_steps' in updates and 'execution_steps_s3_key' in updates:
                del updates['execution_steps_s3_key']
            
            if not updates:
                logger.debug(f"No updates to apply for job {job_id}")
                return
            
            update_expression = "SET " + ", ".join([f"#{k} = :{k}" for k in updates.keys()])
            expression_attribute_names = {f"#{k}": k for k in updates.keys()}
            expression_attribute_values = {f":{k}": v for k, v in updates.items()}
            
            self.jobs_table.update_item(
                Key={'job_id': job_id},
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )
            logger.debug(f"Updated job {job_id}")
        except Exception as e:
            logger.error(f"Error updating job {job_id}: {e}")
            raise
    
    def get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Get workflow by ID."""
        try:
            response = self.workflows_table.get_item(Key={'workflow_id': workflow_id})
            return response.get('Item')
        except Exception as e:
            logger.error(f"Error getting workflow {workflow_id}: {e}")
            raise
    
    def get_submission(self, submission_id: str) -> Optional[Dict[str, Any]]:
        """Get submission by ID."""
        try:
            response = self.submissions_table.get_item(Key={'submission_id': submission_id})
            return response.get('Item')
        except Exception as e:
            logger.error(f"Error getting submission {submission_id}: {e}")
            raise
    
    def get_form(self, form_id: str) -> Optional[Dict[str, Any]]:
        """Get form by ID."""
        try:
            response = self.forms_table.get_item(Key={'form_id': form_id})
            return response.get('Item')
        except Exception as e:
            logger.error(f"Error getting form {form_id}: {e}")
            raise
    
    def get_template(self, template_id: str, version: int = 0) -> Optional[Dict[str, Any]]:
        """
        Get template by ID and version.
        If version is 0, get the latest version.
        """
        try:
            if version == 0:
                # Query for latest version
                response = self.templates_table.query(
                    KeyConditionExpression=Key('template_id').eq(template_id),
                    ScanIndexForward=False,  # Descending order
                    Limit=1
                )
                items = response.get('Items', [])
                return items[0] if items else None
            else:
                # Get specific version
                response = self.templates_table.get_item(
                    Key={'template_id': template_id, 'version': version}
                )
                return response.get('Item')
        except Exception as e:
            logger.error(f"Error getting template {template_id}:{version}: {e}")
            raise
    
    def put_artifact(self, artifact: Dict[str, Any]):
        """Create artifact record."""
        try:
            self.artifacts_table.put_item(Item=artifact)
            logger.debug(f"Created artifact {artifact['artifact_id']}")
        except Exception as e:
            logger.error(f"Error creating artifact: {e}")
            raise
    
    def get_artifact(self, artifact_id: str) -> Optional[Dict[str, Any]]:
        """Get artifact by ID."""
        try:
            response = self.artifacts_table.get_item(Key={'artifact_id': artifact_id})
            return response.get('Item')
        except Exception as e:
            logger.error(f"Error getting artifact {artifact_id}: {e}")
            raise
    
    def get_settings(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get user settings by tenant ID."""
        try:
            response = self.user_settings_table.get_item(Key={'tenant_id': tenant_id})
            return response.get('Item')
        except Exception as e:
            logger.error(f"Error getting settings for tenant {tenant_id}: {e}")
            return None
    
    def put_usage_record(self, usage_record: Dict[str, Any]):
        """Create usage record for billing tracking."""
        try:
            self.usage_records_table.put_item(Item=usage_record)
            logger.debug(f"Created usage record {usage_record.get('usage_id')}")
        except Exception as e:
            logger.error(f"Error creating usage record: {e}")
            # Don't fail the job if usage tracking fails
            pass
    
    def create_notification(
        self,
        tenant_id: str,
        notification_type: str,
        title: str,
        message: str,
        related_resource_id: Optional[str] = None,
        related_resource_type: Optional[str] = None
    ):
        """Create a notification for the tenant."""
        try:
            notification_id = f"notif_{ulid()}"
            now = datetime.utcnow().isoformat()
            ttl = int(datetime.utcnow().timestamp()) + (90 * 24 * 60 * 60)  # 90 days
            
            notification = {
                'notification_id': notification_id,
                'tenant_id': tenant_id,
                'type': notification_type,
                'title': title,
                'message': message,
                'read': False,
                'created_at': now,
                'ttl': ttl
            }
            
            if related_resource_id:
                notification['related_resource_id'] = related_resource_id
            if related_resource_type:
                notification['related_resource_type'] = related_resource_type
            
            self.notifications_table.put_item(Item=notification)
            logger.debug(f"Created notification {notification_id} for tenant {tenant_id}")
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            # Don't fail the job if notification creation fails
            pass

