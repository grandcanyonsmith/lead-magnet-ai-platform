#!/usr/bin/env python3
"""
Convert DynamoDB format (with S, N, L, M, BOOL type indicators) to normal JSON.
"""

import json
import sys
from typing import Any, Dict, List


def convert_dynamodb_item(item: Any) -> Any:
    """
    Recursively convert DynamoDB format to normal Python types.
    
    DynamoDB format uses type indicators:
    - "S" for String
    - "N" for Number
    - "L" for List
    - "M" for Map
    - "BOOL" for Boolean
    - "NULL" for Null
    """
    if isinstance(item, dict):
        # Check if this is a DynamoDB type wrapper
        if len(item) == 1:
            key = list(item.keys())[0]
            value = item[key]
            
            if key == "S":
                return str(value)
            elif key == "N":
                # Try to convert to int first, then float
                try:
                    if '.' in str(value):
                        return float(value)
                    return int(value)
                except ValueError:
                    return value
            elif key == "L":
                return [convert_dynamodb_item(v) for v in value]
            elif key == "M":
                return {k: convert_dynamodb_item(v) for k, v in value.items()}
            elif key == "BOOL":
                return bool(value)
            elif key == "NULL":
                return None
            elif key in ["SS", "NS", "BS"]:
                # String Set, Number Set, Binary Set
                return list(value)
        
        # Regular dict - convert recursively
        return {k: convert_dynamodb_item(v) for k, v in item.items()}
    elif isinstance(item, list):
        return [convert_dynamodb_item(v) for v in item]
    else:
        return item


def convert_dynamodb_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a DynamoDB response to normal JSON format.
    
    Handles both direct Item format and response wrapper format.
    """
    # If it has an "Item" key, extract it
    if "Item" in data:
        item = data["Item"]
        converted_item = convert_dynamodb_item(item)
        
        # Return the converted item with metadata if present
        result = {"Item": converted_item}
        
        # Preserve other metadata fields
        if "SdkHttpMetadata" in data:
            result["SdkHttpMetadata"] = data["SdkHttpMetadata"]
        if "SdkResponseMetadata" in data:
            result["SdkResponseMetadata"] = data["SdkResponseMetadata"]
            
        return result
    
    # Otherwise, convert the whole thing
    return convert_dynamodb_item(data)


def main():
    """Main function to convert DynamoDB format from stdin or file."""
    if len(sys.argv) > 1:
        # Read from file
        with open(sys.argv[1], 'r') as f:
            data = json.load(f)
    else:
        # Read from stdin
        data = json.load(sys.stdin)
    
    converted = convert_dynamodb_response(data)
    print(json.dumps(converted, indent=2, default=str))


if __name__ == "__main__":
    main()

