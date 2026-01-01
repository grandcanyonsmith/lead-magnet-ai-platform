import sys
import os

# Add the current directory to sys.path to ensure modules can be imported
# correctly regardless of where pytest is run from.
worker_dir = os.path.dirname(os.path.abspath(__file__))
if worker_dir not in sys.path:
    sys.path.insert(0, worker_dir)
