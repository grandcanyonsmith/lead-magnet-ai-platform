import os
import sys
from dotenv import load_dotenv

# Load .env
load_dotenv()

# Set job args
os.environ['JOB_ID'] = 'job_01KFXMPBMZ5KE325463TP88B47'
os.environ['STEP_INDEX'] = '2'

# Set defaults from server-local.js
os.environ.setdefault('WORKFLOWS_TABLE', 'leadmagnet-workflows')
os.environ.setdefault('WORKFLOW_VERSIONS_TABLE', 'leadmagnet-workflow-versions')
os.environ.setdefault('FORMS_TABLE', 'leadmagnet-forms')
os.environ.setdefault('SUBMISSIONS_TABLE', 'leadmagnet-submissions')
os.environ.setdefault('JOBS_TABLE', 'leadmagnet-jobs')
os.environ.setdefault('ARTIFACTS_TABLE', 'leadmagnet-artifacts')
os.environ.setdefault('TEMPLATES_TABLE', 'leadmagnet-templates')
os.environ.setdefault('USER_SETTINGS_TABLE', 'leadmagnet-user-settings')
os.environ.setdefault('USAGE_RECORDS_TABLE', 'leadmagnet-usage-records')
os.environ.setdefault('NOTIFICATIONS_TABLE', 'leadmagnet-notifications')
os.environ.setdefault('WEBHOOK_LOGS_TABLE', 'leadmagnet-webhook-logs')
os.environ.setdefault('TRACKING_EVENTS_TABLE', 'leadmagnet-tracking-events')
os.environ.setdefault('RATE_LIMITS_TABLE', 'leadmagnet-rate-limits')
os.environ.setdefault('HTML_PATCH_REQUESTS_TABLE', 'leadmagnet-html-patch-requests')
os.environ.setdefault('AWS_REGION', 'us-east-1')
os.environ.setdefault('LOG_LEVEL', 'info')
os.environ.setdefault('OPENAI_SECRET_NAME', 'leadmagnet/openai-api-key')
os.environ.setdefault('LAMBDA_FUNCTION_NAME', 'leadmagnet-api-handler')
os.environ.setdefault('AWS_ACCOUNT_ID', '471112574622')
os.environ.setdefault('STEP_FUNCTIONS_ARN', 'arn:aws:states:us-east-1:471112574622:stateMachine:leadmagnet-job-processor')
os.environ.setdefault('ARTIFACTS_BUCKET', 'leadmagnet-artifacts-471112574622')
os.environ.setdefault('CLOUDFRONT_DOMAIN', 'assets.mycoursecreator360.com')
os.environ.setdefault('SHELL_EXECUTOR_RESULTS_BUCKET', 'leadmagnet-artifacts-shell-results-471112574622')
os.environ.setdefault('SHELL_EXECUTOR_TASK_DEFINITION_ARN', 'leadmagnet-shell-executor')
os.environ.setdefault('SHELL_EXECUTOR_CLUSTER_ARN', 'arn:aws:ecs:us-east-1:471112574622:cluster/leadmagnet-shell-executor')
os.environ.setdefault('SHELL_EXECUTOR_SECURITY_GROUP_ID', 'sg-01b137df0bd0d797c')
os.environ.setdefault('SHELL_EXECUTOR_SUBNET_IDS', 'subnet-0ecf31413d0908e66,subnet-04e3bee51e6d630ac')
os.environ.setdefault('SHELL_TOOL_ENABLED', 'true')
os.environ.setdefault('IS_LOCAL', 'true')
os.environ.setdefault('NODE_ENV', 'development')

# Add backend/worker to path so imports work
worker_dir = os.path.abspath('backend/worker')
sys.path.insert(0, worker_dir)

# Run worker
import worker
worker.main()
