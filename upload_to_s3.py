import os
import subprocess
import datetime

BUCKET = "coursecreator360-rich-snippet-booster"
TIMESTAMP = datetime.datetime.now().strftime("%Y%m%dT%H%M%SZ")
PREFIX = f"loom-sop-diagrammer/delivery/{TIMESTAMP}"
LOCAL_ZIP = "temp_output/CourseCreator360_Loom_to_SOP_Kit.zip"
LOCAL_BUNDLE = "temp_output/bundle"

def run_command(cmd):
    print(f"Running: {cmd}")
    subprocess.check_call(cmd, shell=True)

def get_object_url(bucket, key):
    return f"https://{bucket}.s3.amazonaws.com/{key}"

try:
    # Upload Zip
    zip_key = f"{PREFIX}/CourseCreator360_Loom_to_SOP_Kit.zip"
    run_command(f"aws s3 cp {LOCAL_ZIP} s3://{BUCKET}/{zip_key}")
    
    # Sync Bundle
    bundle_prefix = f"{PREFIX}/bundle"
    run_command(f"aws s3 sync {LOCAL_BUNDLE} s3://{BUCKET}/{bundle_prefix}")
    
    print("\nUpload Complete. Object URLs:")
    print("-" * 20)
    print(f"Zip File: {get_object_url(BUCKET, zip_key)}")
    print(f"Bundle Root: {get_object_url(BUCKET, bundle_prefix)}/")
    
    # Print a few key files from the bundle for convenience
    print(f"README: {get_object_url(BUCKET, f'{bundle_prefix}/README.md')}")
    print(f"Infographic: {get_object_url(BUCKET, f'{bundle_prefix}/infographic/SOP_ONE_PAGER.png')}")
    print(f"Notion Template: {get_object_url(BUCKET, f'{bundle_prefix}/notion/SOP_NOTION_TEMPLATE.md')}")

except Exception as e:
    print(f"Error: {e}")
