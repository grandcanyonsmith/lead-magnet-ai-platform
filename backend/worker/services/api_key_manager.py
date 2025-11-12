"""
API Key Manager Service
Handles retrieval of OpenAI API key from AWS Secrets Manager.
"""

import logging
import os
import json
import boto3
from typing import Optional

logger = logging.getLogger(__name__)


class APIKeyManager:
    """Manages OpenAI API key retrieval from AWS Secrets Manager."""
    
    @staticmethod
    def get_openai_key(secret_name: Optional[str] = None, region: Optional[str] = None) -> str:
        """
        Get OpenAI API key from AWS Secrets Manager.
        
        Args:
            secret_name: Secret name (defaults to env var or 'leadmagnet/openai-api-key')
            region: AWS region (defaults to env var or 'us-east-1')
            
        Returns:
            OpenAI API key string
            
        Raises:
            ValueError: If secret format is not supported
            Exception: If secret retrieval fails
        """
        secret_name = secret_name or os.environ.get('OPENAI_SECRET_NAME', 'leadmagnet/openai-api-key')
        region = region or os.environ.get('AWS_REGION', 'us-east-1')
        
        logger.info(f"[APIKeyManager] Retrieving API key from Secrets Manager", extra={
            'secret_name': secret_name,
            'region': region
        })
        
        # Create a Secrets Manager client
        session = boto3.session.Session()
        client = session.client(
            service_name='secretsmanager',
            region_name=region
        )
        
        try:
            logger.debug(f"[APIKeyManager] Calling get_secret_value for secret: {secret_name}")
            response = client.get_secret_value(SecretId=secret_name)
            
            # Parse the secret value
            if 'SecretString' in response:
                secret = response['SecretString']
                logger.debug(f"[APIKeyManager] Secret retrieved successfully, length: {len(secret)}")
                # Handle both plain string and JSON format
                try:
                    secret_dict = json.loads(secret)
                    api_key = secret_dict.get('api_key', secret_dict.get('OPENAI_API_KEY', secret))
                    logger.info(f"[APIKeyManager] Successfully parsed JSON secret, API key length: {len(api_key) if api_key else 0}")
                    return api_key
                except json.JSONDecodeError:
                    logger.debug(f"[APIKeyManager] Secret is plain string format, using directly")
                    return secret
            else:
                logger.error(f"[APIKeyManager] Secret binary format not supported")
                raise ValueError("Secret binary format not supported")
                
        except Exception as e:
            logger.error(f"[APIKeyManager] Failed to retrieve OpenAI API key from Secrets Manager", extra={
                'secret_name': secret_name,
                'region': region,
                'error_type': type(e).__name__,
                'error_message': str(e)
            }, exc_info=True)
            raise

