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
    Automatically set dummy environment variables and update settings for all tests.
    """
    # Set env vars for any code using os.environ directly
    monkeypatch.setenv("OPENAI_API_KEY", "dummy-test-key")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")

    # Patch the settings singleton directly since it's likely already instantiated
    try:
        from core.config import settings
        monkeypatch.setattr(settings, "OPENAI_API_KEY", "dummy-test-key")
        monkeypatch.setattr(settings, "AWS_REGION", "us-east-1")
    except ImportError:
        pass

@pytest.fixture(autouse=True)
def mock_api_key_manager(monkeypatch):
    """
    Mock APIKeyManager to avoid AWS Secrets Manager calls.
    """
    try:
        from services.api_key_manager import APIKeyManager
        # Patch the static method
        monkeypatch.setattr(APIKeyManager, "get_openai_key", lambda *args, **kwargs: "dummy-test-key")
    except ImportError:
        pass

