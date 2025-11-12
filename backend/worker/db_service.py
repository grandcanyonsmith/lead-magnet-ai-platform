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

# Note: Execution steps are always stored in S3 (never in DynamoDB) to ensure
# complete data storage without size limitations. The MAX_DYNAMODB_ITEM_SIZE
# constant is kept for reference but is no longer used for execution steps.


class DynamoDBService:
    """Service for DynamoDB operations."""
    
    def __init__(self):
        """Initialize DynamoDB client."""
        region = os.environ.get('AWS_REGION', 'us-east-1')
        logger.info(f"[DynamoDB] Initializing DynamoDB service", extra={'region': region})
        
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        
        # Required environment variables
        required_env_vars = [
            'WORKFLOWS_TABLE',
            'FORMS_TABLE',
            'SUBMISSIONS_TABLE',
            'JOBS_TABLE',
            'ARTIFACTS_TABLE',
            'TEMPLATES_TABLE'
        ]
        
        # Check for missing required environment variables
        missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
        if missing_vars:
            error_msg = f"Missing required environment variables: {', '.join(missing_vars)}"
            logger.error(f"[DynamoDB] {error_msg}", extra={
                'missing_vars': missing_vars,
                'available_env_vars': [k for k in os.environ.keys() if 'TABLE' in k.upper()]
            })
            raise ValueError(error_msg)
        
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
        
        logger.info(f"[DynamoDB] DynamoDB service initialized successfully", extra={
            'workflows_table': self.workflows_table.table_name,
            'jobs_table': self.jobs_table.table_name,
            'artifacts_table': self.artifacts_table.table_name
        })
    
    def get_job(self, job_id: str, s3_service=None) -> Optional[Dict[str, Any]]:
        """
        Get job by ID.
        
        Note: Execution steps are stored in S3, not DynamoDB. If s3_service is provided
        and execution_steps_s3_key exists, execution_steps will be loaded from S3.
        
        Args:
            job_id: Job ID
            s3_service: Optional S3Service instance to load execution_steps from S3
        """
        logger.debug(f"[DynamoDB] Getting job", extra={'job_id': job_id})
        try:
            response = self.jobs_table.get_item(Key={'job_id': job_id})
            job = response.get('Item')
            
            if not job:
                logger.warning(f"[DynamoDB] Job not found", extra={'job_id': job_id})
                return None
            
            logger.debug(f"[DynamoDB] Job retrieved successfully", extra={
                'job_id': job_id,
                'status': job.get('status'),
                'workflow_id': job.get('workflow_id'),
                'has_execution_steps_s3_key': bool(job.get('execution_steps_s3_key'))
            })
            
            # If execution_steps is stored in S3, load it
            if job and s3_service and job.get('execution_steps_s3_key'):
                try:
                    s3_key = job['execution_steps_s3_key']
                    logger.debug(f"[DynamoDB] Loading execution_steps from S3", extra={
                        'job_id': job_id,
                        's3_key': s3_key
                    })
                    execution_steps_json = s3_service.download_artifact(s3_key)
                    job['execution_steps'] = json.loads(execution_steps_json)
                    logger.info(f"[DynamoDB] Loaded execution_steps from S3", extra={
                        'job_id': job_id,
                        's3_key': s3_key,
                        'steps_count': len(job.get('execution_steps', []))
                    })
                except Exception as e:
                    logger.error(f"[DynamoDB] Error loading execution_steps from S3", extra={
                        'job_id': job_id,
                        's3_key': job.get('execution_steps_s3_key'),
                        'error_type': type(e).__name__,
                        'error_message': str(e)
                    }, exc_info=True)
                    # Fall back to empty array if S3 load fails
                    job['execution_steps'] = []
            
            return job
        except Exception as e:
            logger.error(f"[DynamoDB] Error getting job", extra={
                'job_id': job_id,
                'error_type': type(e).__name__,
                'error_message': str(e)
            }, exc_info=True)
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
        
        Execution steps are ALWAYS stored in S3 (never in DynamoDB) to ensure
        complete data storage without size limitations. Only the S3 key reference
        is stored in DynamoDB.
        
        Args:
            job_id: Job ID
            updates: Dictionary of fields to update
            s3_service: Required S3Service instance to store execution_steps in S3
        """
        logger.debug(f"[DynamoDB] Updating job", extra={
            'job_id': job_id,
            'update_fields': list(updates.keys()),
            'has_execution_steps': 'execution_steps' in updates
        })
        
        try:
            # Always store execution_steps in S3 (simplified approach - single source of truth)
            if 'execution_steps' in updates:
                if not s3_service:
                    raise ValueError("s3_service is required when updating execution_steps")
                
                execution_steps = updates['execution_steps']
                
                logger.debug(f"[DynamoDB] Storing execution_steps in S3", extra={
                    'job_id': job_id,
                    'steps_count': len(execution_steps) if isinstance(execution_steps, list) else 0
                })
                
                # Always store in S3 - single source of truth
                s3_key = f"jobs/{job_id}/execution_steps.json"
                execution_steps_json = json.dumps(execution_steps, default=str)
                s3_service.upload_artifact(s3_key, execution_steps_json, content_type='application/json', public=True)  # Public so URLs never expire
                
                # Store S3 key reference in DynamoDB, remove execution_steps from updates
                updates['execution_steps_s3_key'] = s3_key
                del updates['execution_steps']
                
                logger.info(f"[DynamoDB] Stored execution_steps in S3", extra={
                    'job_id': job_id,
                    's3_key': s3_key,
                    'steps_count': len(execution_steps) if isinstance(execution_steps, list) else 0
                })
            
            if not updates:
                logger.debug(f"[DynamoDB] No updates to apply", extra={'job_id': job_id})
                return
            
            # Build update expression
            set_updates = {}
            remove_attributes = []
            
            for key, value in updates.items():
                if value is None:
                    # Remove this attribute from DynamoDB
                    remove_attributes.append(key)
                else:
                    set_updates[key] = value
            
            # Build the update expression
            update_parts = []
            if set_updates:
                set_expr = "SET " + ", ".join([f"#{k} = :{k}" for k in set_updates.keys()])
                update_parts.append(set_expr)
            
            if remove_attributes:
                remove_expr = "REMOVE " + ", ".join([f"#{k}" for k in remove_attributes])
                update_parts.append(remove_expr)
            
            if not update_parts:
                logger.debug(f"[DynamoDB] No update expression to apply", extra={'job_id': job_id})
                return
            
            update_expression = " ".join(update_parts)
            expression_attribute_names = {f"#{k}": k for k in set_updates.keys()}
            # Add names for removed attributes
            for attr in remove_attributes:
                expression_attribute_names[f"#{attr}"] = attr
            expression_attribute_values = {f":{k}": v for k, v in set_updates.items()}
            
            # DynamoDB update_item requires ExpressionAttributeValues even if empty for REMOVE-only operations
            # But we can pass an empty dict if there are no SET operations
            update_params = {
                'Key': {'job_id': job_id},
                'UpdateExpression': update_expression,
                'ExpressionAttributeNames': expression_attribute_names,
            }
            if expression_attribute_values:
                update_params['ExpressionAttributeValues'] = expression_attribute_values
            
            logger.debug(f"[DynamoDB] Executing update_item", extra={
                'job_id': job_id,
                'set_fields_count': len(set_updates),
                'remove_fields_count': len(remove_attributes)
            })
            
            self.jobs_table.update_item(**update_params)
            logger.info(f"[DynamoDB] Job updated successfully", extra={
                'job_id': job_id,
                'updated_fields': list(set_updates.keys()),
                'removed_fields': remove_attributes
            })
        except Exception as e:
            logger.error(f"[DynamoDB] Error updating job", extra={
                'job_id': job_id,
                'update_fields': list(updates.keys()),
                'error_type': type(e).__name__,
                'error_message': str(e)
            }, exc_info=True)
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

