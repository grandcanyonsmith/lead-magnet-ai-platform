import sys
import os
import pytest
from unittest.mock import MagicMock

# Add the current directory to sys.path to ensure modules can be imported
# correctly regardless of where pytest is run from.
worker_dir = os.path.dirname(os.path.abspath(__file__))
if worker_dir not in sys.path:
    sys.path.insert(0, worker_dir)

@pytest.fixture(autouse=True)
def mock_settings_env_vars(monkeypatch):
    """
    Automatically set dummy environment variables for all tests to avoid
    AWS credentials issues and ensure consistent config.
    """
    monkeypatch.setenv("OPENAI_API_KEY", "dummy-test-key")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")

@pytest.fixture(autouse=True)
def mock_api_key_manager(monkeypatch):
    """
    Mock APIKeyManager to avoid AWS Secrets Manager calls.
    This patches the get_openai_key method to return a dummy key.
    """
    # We need to import the class to patch it
    from services.api_key_manager import APIKeyManager
    monkeypatch.setattr(APIKeyManager, "get_openai_key", lambda *args, **kwargs: "dummy-test-key")

