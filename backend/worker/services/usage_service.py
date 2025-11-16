"""
Usage Service
Handles usage record storage for billing tracking.
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any
from ulid import new as ulid

from core.db_service import DynamoDBService

logger = logging.getLogger(__name__)


class UsageService:
    """Service for storing usage records."""
    
    def __init__(self, db_service: DynamoDBService):
        """
        Initialize usage service.
        
        Args:
            db_service: DynamoDB service instance
        """
        self.db = db_service
    
    def store_usage_record(
        self,
        tenant_id: str,
        job_id: str,
        usage_info: Dict[str, Any],
        service_type: str = 'unknown'
    ) -> None:
        """
        Store usage record for billing tracking.
        
        Args:
            tenant_id: Tenant ID
            job_id: Job ID
            usage_info: Usage information dictionary containing:
                - model: Model name
                - input_tokens: Input token count
                - output_tokens: Output token count
                - cost_usd: Cost in USD (will be converted to Decimal)
                - service_type: Optional service type (defaults to parameter)
        """
        try:
            usage_id = f"usage_{ulid()}"
            
            # Convert cost_usd to Decimal for DynamoDB compatibility
            cost_usd = usage_info.get('cost_usd', 0.0)
            if isinstance(cost_usd, float):
                cost_usd = Decimal(str(cost_usd))
            elif not isinstance(cost_usd, Decimal):
                cost_usd = Decimal(str(cost_usd))
            
            # Use service_type from usage_info if provided, otherwise use parameter
            final_service_type = usage_info.get('service_type', service_type)
            
            usage_record = {
                'usage_id': usage_id,
                'tenant_id': tenant_id,
                'job_id': job_id,
                'service_type': final_service_type,
                'model': usage_info.get('model', 'unknown'),
                'input_tokens': usage_info.get('input_tokens', 0),
                'output_tokens': usage_info.get('output_tokens', 0),
                'cost_usd': cost_usd,
                'created_at': datetime.utcnow().isoformat(),
            }
            self.db.put_usage_record(usage_record)
            logger.debug(f"Stored usage record {usage_id} for job {job_id}")
        except Exception as e:
            logger.error(f"Failed to store usage record: {e}")
            # Don't fail the job if usage tracking fails
            pass

