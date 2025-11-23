"""
Pytest configuration file for worker tests.

This file automatically adds the worker directory to sys.path before any tests run,
allowing test files to import modules like processor, core, and services.
"""

import sys
from pathlib import Path

# Add the worker directory to Python path so imports work correctly
# conftest.py is in backend/worker/tests/, so we need to go up one level to backend/worker/
worker_dir = Path(__file__).parent.parent
if str(worker_dir) not in sys.path:
    sys.path.insert(0, str(worker_dir))

