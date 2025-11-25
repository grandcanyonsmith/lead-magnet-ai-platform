#!/usr/bin/env python3
"""
Calculate total cost for Market Research Report generation.

Based on the execution logs, calculates costs for:
1. OpenAI API calls (2 per report: narrative + courseData)
2. AWS S3 storage and requests
3. AWS DynamoDB writes
4. Lambda TTS (if applicable)
"""

from decimal import Decimal
from typing import Dict, List

# OpenAI pricing for reasoning models (per 1M tokens, USD)
# Note: o4-mini-deep-research likely refers to o1-mini or similar
# o3 likely refers to o3-mini or similar
OPENAI_PRICING = {
    'o4-mini-deep-research': {
        'input_per_1m_tokens_usd': Decimal('0.15'),   # $0.15 per 1M input tokens (o1-mini pricing)
        'output_per_1m_tokens_usd': Decimal('0.60'),   # $0.60 per 1M output tokens
    },
    'o3': {
        'input_per_1m_tokens_usd': Decimal('0.15'),   # Estimated similar to o1-mini
        'output_per_1m_tokens_usd': Decimal('0.60'),   # Estimated similar to o1-mini
    },
    # Fallback pricing
    'o1-mini': {
        'input_per_1m_tokens_usd': Decimal('0.15'),
        'output_per_1m_tokens_usd': Decimal('0.60'),
    },
    'o3-mini': {
        'input_per_1m_tokens_usd': Decimal('0.15'),
        'output_per_1m_tokens_usd': Decimal('0.60'),
    },
}

# AWS pricing (us-west-2 region)
AWS_PRICING = {
    's3': {
        'storage_per_gb_month': Decimal('0.023'),      # Standard storage: $0.023/GB/month
        'put_request_per_1k': Decimal('0.005'),        # PUT requests: $0.005 per 1,000 requests
        'get_request_per_1k': Decimal('0.0004'),       # GET requests: $0.0004 per 1,000 requests
        'data_transfer_out_per_gb': Decimal('0.09'),   # First 10TB: $0.09/GB
    },
    'dynamodb': {
        'write_request_unit': Decimal('0.00000125'),  # $1.25 per million write units (on-demand)
        'read_request_unit': Decimal('0.00000025'),  # $0.25 per million read units (on-demand)
        'storage_per_gb_month': Decimal('0.25'),       # $0.25/GB/month
    },
    'lambda': {
        'requests_per_1m': Decimal('0.20'),           # First 1M requests free, then $0.20 per 1M
        'compute_per_gb_second': Decimal('0.0000166667'), # $0.0000166667 per GB-second
    },
}

# Estimated token usage per report (based on typical market research reports)
ESTIMATED_USAGE = {
    'narrative': {
        'input_tokens': 2000,   # ~2K tokens for prompt + course description
        'output_tokens': 8000,   # ~8K tokens for market research narrative
    },
    'courseData': {
        'input_tokens': 10000,  # ~10K tokens (includes full narrative)
        'output_tokens': 5000,  # ~5K tokens for courseData JSON
    },
    'tts': {
        'audio_duration_seconds': 120,  # ~2 minutes of audio
        'lambda_invocations': 1,
        'lambda_duration_ms': 5000,    # ~5 seconds execution time
        'lambda_memory_mb': 512,
    },
    's3': {
        'html_size_kb': 50,      # ~50KB HTML file
        'js_size_kb': 30,        # ~30KB values.js file
        'audio_size_kb': 2000,   # ~2MB audio file (WAV format)
        'put_requests': 3,       # 3 PUT requests per report
    },
    'dynamodb': {
        'write_units': 1,        # 1 write unit per report
        'item_size_kb': 5,       # ~5KB item size
    },
}


def calculate_openai_cost(model: str, input_tokens: int, output_tokens: int) -> Decimal:
    """Calculate OpenAI API cost."""
    pricing = OPENAI_PRICING.get(model, OPENAI_PRICING['o1-mini'])
    
    input_cost = (Decimal(str(input_tokens)) / Decimal('1000000')) * pricing['input_per_1m_tokens_usd']
    output_cost = (Decimal(str(output_tokens)) / Decimal('1000000')) * pricing['output_per_1m_tokens_usd']
    
    return input_cost + output_cost


def calculate_s3_cost(put_requests: int, storage_gb: Decimal) -> Decimal:
    """Calculate S3 costs."""
    put_cost = (Decimal(str(put_requests)) / Decimal('1000')) * AWS_PRICING['s3']['put_request_per_1k']
    storage_cost = storage_gb * AWS_PRICING['s3']['storage_per_gb_month'] / Decimal('30')  # Daily cost
    return put_cost + storage_cost


def calculate_dynamodb_cost(write_units: int, storage_gb: Decimal) -> Decimal:
    """Calculate DynamoDB costs."""
    write_cost = Decimal(str(write_units)) * AWS_PRICING['dynamodb']['write_request_unit']
    storage_cost = storage_gb * AWS_PRICING['dynamodb']['storage_per_gb_month'] / Decimal('30')  # Daily cost
    return write_cost + storage_cost


def calculate_lambda_cost(invocations: int, duration_ms: int, memory_mb: int) -> Decimal:
    """Calculate Lambda costs."""
    request_cost = (Decimal(str(invocations)) / Decimal('1000000')) * AWS_PRICING['lambda']['requests_per_1m']
    
    # Compute cost: duration in seconds * memory in GB * price per GB-second
    duration_seconds = Decimal(str(duration_ms)) / Decimal('1000')
    memory_gb = Decimal(str(memory_mb)) / Decimal('1000')
    compute_cost = duration_seconds * memory_gb * AWS_PRICING['lambda']['compute_per_gb_second']
    
    return request_cost + compute_cost


def calculate_report_cost(num_reports: int = 1) -> Dict:
    """Calculate total cost for generating market research reports."""
    total_openai = Decimal('0')
    total_s3 = Decimal('0')
    total_dynamodb = Decimal('0')
    total_lambda = Decimal('0')
    
    breakdown = {
        'openai': {},
        's3': {},
        'dynamodb': {},
        'lambda': {},
    }
    
    # OpenAI costs
    narrative_cost = calculate_openai_cost(
        'o4-mini-deep-research',
        ESTIMATED_USAGE['narrative']['input_tokens'],
        ESTIMATED_USAGE['narrative']['output_tokens']
    )
    coursedata_cost = calculate_openai_cost(
        'o3',
        ESTIMATED_USAGE['courseData']['input_tokens'],
        ESTIMATED_USAGE['courseData']['output_tokens']
    )
    
    per_report_openai = narrative_cost + coursedata_cost
    total_openai = per_report_openai * Decimal(str(num_reports))
    
    breakdown['openai'] = {
        'narrative_per_report': float(narrative_cost),
        'coursedata_per_report': float(coursedata_cost),
        'total_per_report': float(per_report_openai),
        'total': float(total_openai),
    }
    
    # S3 costs
    total_storage_kb = (
        ESTIMATED_USAGE['s3']['html_size_kb'] +
        ESTIMATED_USAGE['s3']['js_size_kb'] +
        ESTIMATED_USAGE['s3']['audio_size_kb']
    )
    storage_gb = (Decimal(str(total_storage_kb)) * Decimal(str(num_reports))) / Decimal('1048576')  # KB to GB
    
    per_report_s3 = calculate_s3_cost(
        ESTIMATED_USAGE['s3']['put_requests'],
        Decimal(str(total_storage_kb)) / Decimal('1048576')
    )
    total_s3 = per_report_s3 * Decimal(str(num_reports))
    
    breakdown['s3'] = {
        'put_requests_per_report': ESTIMATED_USAGE['s3']['put_requests'],
        'storage_kb_per_report': total_storage_kb,
        'cost_per_report': float(per_report_s3),
        'total': float(total_s3),
    }
    
    # DynamoDB costs
    item_size_gb = Decimal(str(ESTIMATED_USAGE['dynamodb']['item_size_kb'])) / Decimal('1048576')
    per_report_dynamodb = calculate_dynamodb_cost(
        ESTIMATED_USAGE['dynamodb']['write_units'],
        item_size_gb
    )
    total_dynamodb = per_report_dynamodb * Decimal(str(num_reports))
    
    breakdown['dynamodb'] = {
        'write_units_per_report': ESTIMATED_USAGE['dynamodb']['write_units'],
        'cost_per_report': float(per_report_dynamodb),
        'total': float(total_dynamodb),
    }
    
    # Lambda TTS costs
    per_report_lambda = calculate_lambda_cost(
        ESTIMATED_USAGE['tts']['lambda_invocations'],
        ESTIMATED_USAGE['tts']['lambda_duration_ms'],
        ESTIMATED_USAGE['tts']['lambda_memory_mb']
    )
    total_lambda = per_report_lambda * Decimal(str(num_reports))
    
    breakdown['lambda'] = {
        'invocations_per_report': ESTIMATED_USAGE['tts']['lambda_invocations'],
        'duration_ms_per_report': ESTIMATED_USAGE['tts']['lambda_duration_ms'],
        'cost_per_report': float(per_report_lambda),
        'total': float(total_lambda),
    }
    
    total_cost = total_openai + total_s3 + total_dynamodb + total_lambda
    
    return {
        'num_reports': num_reports,
        'breakdown': breakdown,
        'totals': {
            'openai': float(total_openai),
            's3': float(total_s3),
            'dynamodb': float(total_dynamodb),
            'lambda': float(total_lambda),
            'total': float(total_cost),
        },
    }


def main():
    """Main function to calculate and display costs."""
    # Based on the terminal output, 2 reports were generated
    num_reports = 2
    
    print("=" * 70)
    print("Market Research Report Cost Calculator")
    print("=" * 70)
    print(f"\nCalculating costs for {num_reports} report(s)...\n")
    
    result = calculate_report_cost(num_reports)
    
    print("COST BREAKDOWN:")
    print("-" * 70)
    
    # OpenAI costs
    print("\n📊 OpenAI API Costs:")
    print(f"  Narrative generation (o4-mini-deep-research):")
    print(f"    Per report: ${result['breakdown']['openai']['narrative_per_report']:.6f}")
    print(f"  CourseData generation (o3):")
    print(f"    Per report: ${result['breakdown']['openai']['coursedata_per_report']:.6f}")
    print(f"  Total OpenAI per report: ${result['breakdown']['openai']['total_per_report']:.6f}")
    print(f"  Total OpenAI ({num_reports} reports): ${result['totals']['openai']:.6f}")
    
    # S3 costs
    print("\n💾 AWS S3 Costs:")
    print(f"  PUT requests per report: {result['breakdown']['s3']['put_requests_per_report']}")
    print(f"  Storage per report: {result['breakdown']['s3']['storage_kb_per_report']:.2f} KB")
    print(f"  Cost per report: ${result['breakdown']['s3']['cost_per_report']:.6f}")
    print(f"  Total S3 ({num_reports} reports): ${result['totals']['s3']:.6f}")
    
    # DynamoDB costs
    print("\n🗄️  AWS DynamoDB Costs:")
    print(f"  Write units per report: {result['breakdown']['dynamodb']['write_units_per_report']}")
    print(f"  Cost per report: ${result['breakdown']['dynamodb']['cost_per_report']:.6f}")
    print(f"  Total DynamoDB ({num_reports} reports): ${result['totals']['dynamodb']:.6f}")
    
    # Lambda costs
    print("\n⚡ AWS Lambda (TTS) Costs:")
    print(f"  Invocations per report: {result['breakdown']['lambda']['invocations_per_report']}")
    print(f"  Duration per report: {result['breakdown']['lambda']['duration_ms_per_report']} ms")
    print(f"  Cost per report: ${result['breakdown']['lambda']['cost_per_report']:.6f}")
    print(f"  Total Lambda ({num_reports} reports): ${result['totals']['lambda']:.6f}")
    
    # Total
    print("\n" + "=" * 70)
    print("TOTAL COST SUMMARY:")
    print("=" * 70)
    print(f"  OpenAI:     ${result['totals']['openai']:.6f}")
    print(f"  S3:         ${result['totals']['s3']:.6f}")
    print(f"  DynamoDB:   ${result['totals']['dynamodb']:.6f}")
    print(f"  Lambda:     ${result['totals']['lambda']:.6f}")
    print("-" * 70)
    print(f"  TOTAL:      ${result['totals']['total']:.6f}")
    print("=" * 70)
    
    print(f"\n💡 Cost per report: ${result['totals']['total'] / num_reports:.6f}")
    print(f"💡 Estimated monthly cost (30 reports/day): ${result['totals']['total'] / num_reports * 30:.2f}")


if __name__ == '__main__':
    main()
