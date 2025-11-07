"""
Delivery Service
Handles webhook and SMS delivery notifications.
"""

import logging
import json
import os
from datetime import datetime
from typing import Dict, Any, Optional
import boto3
import requests

from ai_service import AIService
from db_service import DynamoDBService

logger = logging.getLogger(__name__)


class DeliveryService:
    """Service for delivering notifications via webhooks and SMS."""
    
    def __init__(self, db_service: DynamoDBService, ai_service: AIService):
        self.db = db_service
        self.ai_service = ai_service
    
    def send_webhook_notification(
        self,
        webhook_url: str,
        webhook_headers: Dict[str, str],
        job_id: str,
        output_url: str,
        submission: Dict[str, Any],
        job: Dict[str, Any]
    ):
        """
        Send webhook notification about completed job with dynamic payload.
        
        Args:
            webhook_url: Webhook URL to send notification to
            webhook_headers: Additional headers to include in request
            job_id: Job ID
            output_url: URL to the generated artifact
            submission: Submission data
            job: Job data
        """
        logger.info(f"[DeliveryService] Sending webhook notification", extra={
            'job_id': job_id,
            'webhook_url': webhook_url,
            'has_custom_headers': bool(webhook_headers),
            'output_url': output_url
        })
        
        # Build payload with dynamic values from submission data
        submission_data = submission.get('submission_data', {})
        payload = {
            'job_id': job_id,
            'status': 'completed',
            'output_url': output_url,
            'submission_data': submission_data,
            'lead_name': submission_data.get('name'),
            'lead_email': submission_data.get('email'),
            'lead_phone': submission_data.get('phone'),
            'completed_at': datetime.utcnow().isoformat(),
            'workflow_id': job.get('workflow_id'),
        }
        
        # Merge with any additional dynamic values from submission
        for key, value in submission_data.items():
            if key not in payload:
                payload[f'submission_{key}'] = value
        
        headers = {
            'Content-Type': 'application/json',
            **webhook_headers
        }
        
        logger.debug(f"[DeliveryService] Webhook payload prepared", extra={
            'job_id': job_id,
            'payload_keys': list(payload.keys()),
            'headers_count': len(headers)
        })
        
        try:
            logger.debug(f"[DeliveryService] Sending POST request to webhook", extra={
                'job_id': job_id,
                'webhook_url': webhook_url,
                'timeout': 30
            })
            response = requests.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            logger.info(f"[DeliveryService] Webhook notification sent successfully", extra={
                'job_id': job_id,
                'webhook_url': webhook_url,
                'status_code': response.status_code,
                'response_length': len(response.content)
            })
        except Exception as e:
            logger.error(f"[DeliveryService] Failed to send webhook notification", extra={
                'job_id': job_id,
                'webhook_url': webhook_url,
                'error_type': type(e).__name__,
                'error_message': str(e),
                'response_status': getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            }, exc_info=True)
    
    def _get_twilio_credentials(self) -> Dict[str, str]:
        """
        Get Twilio credentials from AWS Secrets Manager.
        
        Returns:
            Dictionary with account_sid, auth_token, and from_number
            
        Raises:
            Exception: If credentials cannot be retrieved
        """
        secret_name = os.environ.get('TWILIO_SECRET_NAME', 'leadmagnet/twilio-credentials')
        # Twilio secret is stored in us-east-1
        region = os.environ.get('AWS_REGION', 'us-east-1')
        
        # Create a Secrets Manager client
        session = boto3.session.Session()
        client = session.client(
            service_name='secretsmanager',
            region_name=region
        )
        
        try:
            response = client.get_secret_value(SecretId=secret_name)
            
            # Parse the secret value
            if 'SecretString' in response:
                secret = response['SecretString']
                # Handle both plain string and JSON format
                try:
                    secret_dict = json.loads(secret)
                    return {
                        'account_sid': secret_dict.get('TWILIO_ACCOUNT_SID', ''),
                        'auth_token': secret_dict.get('TWILIO_AUTH_TOKEN', ''),
                        'from_number': secret_dict.get('TWILIO_FROM_NUMBER', '')
                    }
                except json.JSONDecodeError:
                    # If not JSON, try to parse as plain string (fallback)
                    return {
                        'account_sid': '',
                        'auth_token': '',
                        'from_number': ''
                    }
            else:
                raise ValueError("Secret binary format not supported")
                
        except Exception as e:
            logger.error(f"Failed to retrieve Twilio credentials: {e}")
            raise
    
    def send_sms_notification(
        self,
        workflow: Dict[str, Any],
        tenant_id: str,
        job_id: str,
        output_url: str,
        submission: Dict[str, Any],
        research_content: Optional[str] = None
    ):
        """
        Send SMS notification using Twilio or AI-generated message.
        
        Args:
            workflow: Workflow configuration
            tenant_id: Tenant ID
            job_id: Job ID
            output_url: URL to the generated artifact
            submission: Submission data
            research_content: Optional research content for AI message generation
        """
        submission_data = submission.get('submission_data', {})
        phone_number = submission_data.get('phone')
        
        logger.info(f"SMS Notification: Starting for job {job_id}, phone: {phone_number[:10] if phone_number else 'N/A'}...")
        
        if not phone_number:
            logger.error(f"SMS Notification: No phone number in submission data for job {job_id}. Submission data keys: {list(submission_data.keys())}")
            return
        
        # Validate phone number format
        if not phone_number or len(phone_number.strip()) < 10:
            logger.error(f"SMS Notification: Invalid phone number format: {phone_number}")
            return
        
        # Get SMS message
        sms_message = None
        if workflow.get('delivery_sms_ai_generated', False):
            # Generate SMS via AI
            logger.info(f"SMS Notification: Generating AI SMS message for job {job_id}")
            try:
                sms_message = self.generate_sms_message(
                    workflow,
                    tenant_id,
                    job_id,
                    submission_data,
                    output_url,
                    research_content
                )
                logger.info(f"SMS Notification: AI message generated successfully, length: {len(sms_message) if sms_message else 0}")
            except Exception as e:
                logger.error(f"SMS Notification: Failed to generate AI message: {e}")
                sms_message = f"Thank you! Your personalized report is ready: {output_url}"
        else:
            # Use manual message or default
            sms_message = workflow.get('delivery_sms_message', '')
            if not sms_message:
                # Default message
                sms_message = f"Thank you! Your personalized report is ready: {output_url}"
            else:
                # Replace placeholders in manual message
                sms_message = sms_message.replace('{output_url}', output_url)
                sms_message = sms_message.replace('{name}', submission_data.get('name', 'there'))
                sms_message = sms_message.replace('{job_id}', job_id)
        
        if not sms_message:
            logger.error(f"SMS Notification: No SMS message generated for job {job_id}, cannot send SMS")
            return
        
        logger.info(f"SMS Notification: Prepared message (length: {len(sms_message)}) for job {job_id}")
        
        # Get Twilio credentials from Secrets Manager
        try:
            logger.info(f"SMS Notification: Retrieving Twilio credentials...")
            twilio_creds = self._get_twilio_credentials()
            twilio_account_sid = twilio_creds['account_sid']
            twilio_auth_token = twilio_creds['auth_token']
            twilio_from_number = twilio_creds['from_number']
            
            if not twilio_account_sid or not twilio_auth_token or not twilio_from_number:
                logger.error(f"SMS Notification: Twilio credentials incomplete - account_sid: {'present' if twilio_account_sid else 'missing'}, auth_token: {'present' if twilio_auth_token else 'missing'}, from_number: {'present' if twilio_from_number else 'missing'}")
                return
            
            logger.info(f"SMS Notification: Twilio credentials retrieved successfully, from_number: {twilio_from_number[:5]}...")
        except Exception as e:
            logger.error(f"SMS Notification: Failed to retrieve Twilio credentials: {e}", exc_info=True)
            return
        
        try:
            # Send SMS via Twilio API
            logger.info(f"SMS Notification: Sending SMS to {phone_number} via Twilio...")
            response = requests.post(
                f'https://api.twilio.com/2010-04-01/Accounts/{twilio_account_sid}/Messages.json',
                auth=(twilio_account_sid, twilio_auth_token),
                data={
                    'From': twilio_from_number,
                    'To': phone_number,
                    'Body': sms_message
                },
                timeout=30
            )
            response.raise_for_status()
            response_data = response.json()
            logger.info(f"SMS Notification: SMS sent successfully to {phone_number}. Twilio SID: {response_data.get('sid', 'N/A')}, Status: {response_data.get('status', 'N/A')}")
        except requests.exceptions.HTTPError as e:
            logger.error(f"SMS Notification: HTTP error sending SMS: {e}. Response: {e.response.text if e.response else 'N/A'}")
        except Exception as e:
            logger.error(f"SMS Notification: Failed to send SMS: {e}", exc_info=True)
    
    def generate_sms_message(
        self,
        workflow: Dict[str, Any],
        tenant_id: str,
        job_id: str,
        submission_data: Dict[str, Any],
        output_url: str,
        research_content: Optional[str] = None
    ) -> str:
        """
        Generate SMS message using AI based on context.
        
        Args:
            workflow: Workflow configuration
            tenant_id: Tenant ID
            job_id: Job ID
            submission_data: Submission data
            output_url: URL to the generated artifact
            research_content: Optional research content
            
        Returns:
            Generated SMS message string
        """
        sms_instructions = workflow.get('delivery_sms_ai_instructions', '')
        
        # Build context for SMS generation
        context_parts = []
        if research_content:
            context_parts.append(f"Research Content: {research_content[:500]}...")  # Truncate for SMS context
        
        context_parts.append(f"Form Submission: {json.dumps(submission_data)}")
        context_parts.append(f"Lead Magnet URL: {output_url}")
        
        context = "\n".join(context_parts)
        
        prompt = f"""Generate a friendly, concise SMS message (max 160 characters) to send to a lead with their personalized lead magnet.

{sms_instructions if sms_instructions else "Keep it friendly, include the URL, and make it personal."}

Context:
{context}

Generate ONLY the SMS message text, no explanations, no markdown."""
        
        try:
            response, usage_info = self.ai_service.generate_report(
                model=workflow.get('ai_model', 'gpt-5'),
                instructions=prompt,
                context="",
                tools=[{"type": "web_search_preview"}],
                tool_choice="auto"
            )
            
            # Store usage record
            from decimal import Decimal
            from ulid import new as ulid
            
            usage_id = f"usage_{ulid()}"
            cost_usd = usage_info.get('cost_usd', 0.0)
            if isinstance(cost_usd, float):
                cost_usd = Decimal(str(cost_usd))
            elif not isinstance(cost_usd, Decimal):
                cost_usd = Decimal(str(cost_usd))
            
            usage_record = {
                'usage_id': usage_id,
                'tenant_id': tenant_id,
                'job_id': job_id,
                'service_type': 'openai_sms_generation',
                'model': usage_info.get('model', workflow.get('ai_model', 'gpt-5')),
                'input_tokens': usage_info.get('input_tokens', 0),
                'output_tokens': usage_info.get('output_tokens', 0),
                'cost_usd': cost_usd,
                'created_at': datetime.utcnow().isoformat(),
            }
            self.db.put_usage_record(usage_record)
            
            # Clean up response (remove markdown if present)
            sms_message = response.strip()
            if sms_message.startswith('"') and sms_message.endswith('"'):
                sms_message = sms_message[1:-1]
            if sms_message.startswith("'") and sms_message.endswith("'"):
                sms_message = sms_message[1:-1]
            
            return sms_message
        except Exception as e:
            logger.error(f"Failed to generate SMS message: {e}")
            raise

