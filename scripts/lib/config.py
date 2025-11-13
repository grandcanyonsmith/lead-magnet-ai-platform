#!/usr/bin/env python3
"""
Configuration management for Lead Magnet AI scripts.

Loads configuration from environment variables, config files, or defaults.
"""

import os
from typing import Dict, Optional, Any
from pathlib import Path
from functools import lru_cache

# Try to import yaml, but don't fail if it's not available
try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


# Default configuration
DEFAULT_CONFIG = {
    "defaults": {
        "region": "us-east-1",
        "api_url": "https://czp5b77azd.execute-api.us-east-1.amazonaws.com",
    },
    "tables": {
        "jobs": "leadmagnet-jobs",
        "workflows": "leadmagnet-workflows",
        "forms": "leadmagnet-forms",
        "submissions": "leadmagnet-submissions",
        "artifacts": "leadmagnet-artifacts",
        "templates": "leadmagnet-templates",
    },
    "environments": {
        "dev": {
            "region": "us-east-1",
        },
        "prod": {
            "region": "us-east-1",
        },
    },
}


@lru_cache(maxsize=1)
def load_config_file() -> Dict[str, Any]:
    """
    Load configuration from YAML file if it exists.
    
    Returns:
        Configuration dictionary
    """
    # Look for config.yaml in scripts directory
    script_dir = Path(__file__).parent.parent
    config_path = script_dir / "config.yaml"
    
    if config_path.exists() and HAS_YAML:
        try:
            with open(config_path, "r") as f:
                return yaml.safe_load(f) or {}
        except Exception:
            pass
    
    return {}


@lru_cache(maxsize=1)
def get_config() -> Dict[str, Any]:
    """
    Get merged configuration from file and environment.
    
    Environment variables take precedence over config file.
    
    Returns:
        Merged configuration dictionary
    """
    config = DEFAULT_CONFIG.copy()
    
    # Load from file
    file_config = load_config_file()
    if file_config:
        # Merge defaults
        if "defaults" in file_config:
            config["defaults"].update(file_config["defaults"])
        # Merge tables
        if "tables" in file_config:
            config["tables"].update(file_config["tables"])
        # Merge environments
        if "environments" in file_config:
            config["environments"].update(file_config["environments"])
    
    # Override with environment variables
    env_region = os.environ.get("AWS_REGION")
    if env_region:
        config["defaults"]["region"] = env_region
    
    env_api_url = os.environ.get("API_URL")
    if env_api_url:
        config["defaults"]["api_url"] = env_api_url
    
    # Override table names from environment
    for table_name in config["tables"].keys():
        env_key = f"{table_name.upper()}_TABLE"
        env_value = os.environ.get(env_key)
        if env_value:
            config["tables"][table_name] = env_value
    
    return config


def get_region(environment: Optional[str] = None) -> str:
    """
    Get AWS region for the given environment.
    
    Args:
        environment: Environment name (dev, prod) or None for default
        
    Returns:
        AWS region string
    """
    config = get_config()
    
    if environment and environment in config.get("environments", {}):
        return config["environments"][environment].get(
            "region", config["defaults"]["region"]
        )
    
    return config["defaults"]["region"]


def get_api_url() -> str:
    """
    Get API URL from configuration.
    
    Returns:
        API URL string
    """
    config = get_config()
    return config["defaults"]["api_url"]


def get_table_name(table_type: str) -> str:
    """
    Get table name for the given table type.
    
    Args:
        table_type: Table type (jobs, workflows, forms, etc.)
        
    Returns:
        Table name string
    """
    config = get_config()
    return config["tables"].get(table_type, f"leadmagnet-{table_type}")

