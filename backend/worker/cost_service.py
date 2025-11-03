"""
Cost calculation service for OpenAI API usage (Python).
References: /Users/canyonsmith/market-research-report-v10/src/services/cost_service.py
"""

from decimal import Decimal
from typing import Dict

# OpenAI model pricing (per 1K tokens, USD)
OPENAI_PRICING = {
    'gpt-4o': {
        'input_per_1k_tokens_usd': Decimal('0.0025'),
        'output_per_1k_tokens_usd': Decimal('0.01'),
    },
    'gpt-4-turbo': {
        'input_per_1k_tokens_usd': Decimal('0.01'),
        'output_per_1k_tokens_usd': Decimal('0.03'),
    },
    'gpt-3.5-turbo': {
        'input_per_1k_tokens_usd': Decimal('0.0005'),
        'output_per_1k_tokens_usd': Decimal('0.0015'),
    },
    'gpt-4o-mini': {
        'input_per_1k_tokens_usd': Decimal('0.00015'),
        'output_per_1k_tokens_usd': Decimal('0.0006'),
    },
    'gpt-5': {
        'input_per_1k_tokens_usd': Decimal('0.005'),
        'output_per_1k_tokens_usd': Decimal('0.015'),
    },
}


def calculate_openai_cost(model: str, input_tokens: int, output_tokens: int) -> Dict[str, float]:
    """
    Calculate OpenAI API cost for a request.
    
    Args:
        model: Model name (e.g., "gpt-4o", "gpt-4-turbo")
        input_tokens: Input token count
        output_tokens: Output token count
        
    Returns:
        Dictionary with input_tokens, output_tokens, and cost_usd
    """
    pricing = OPENAI_PRICING.get(model, OPENAI_PRICING['gpt-5'])  # Default to gpt-5 if unknown
    
    # Calculate cost with Decimal precision
    input_cost = Decimal(str(input_tokens)) / Decimal('1000') * pricing['input_per_1k_tokens_usd']
    output_cost = Decimal(str(output_tokens)) / Decimal('1000') * pricing['output_per_1k_tokens_usd']
    total_cost = input_cost + output_cost
    
    return {
        'input_tokens': input_tokens,
        'output_tokens': output_tokens,
        'cost_usd': float(total_cost),
    }

