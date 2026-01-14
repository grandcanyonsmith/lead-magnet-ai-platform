# Image Processing Utilities Documentation

## Overview

The Image Processing Utilities provide a comprehensive set of tools for handling images in the Lead Magnet AI platform. These utilities enable you to:

- Download images from URLs
- Load images from local file paths
- Process images through OpenAI's Responses API with image generation
- Upload processed images to S3
- Clean up temporary files

The utilities are designed for both standalone script usage and integration into larger workflows.

## Table of Contents

- [Installation Requirements](#installation-requirements)
- [Quick Start](#quick-start)
- [Standalone Script Usage](#standalone-script-usage)
- [Utility Functions Reference](#utility-functions-reference)
- [Error Handling](#error-handling)
- [S3 Configuration](#s3-configuration)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Installation Requirements

### Python Dependencies

The utilities require the following Python packages (already included in `backend/worker/requirements.txt`):

- `boto3` - AWS SDK for Python
- `requests` - HTTP library for downloading images
- `openai` - OpenAI Python client library

### AWS Configuration

The utilities require AWS credentials to be configured. You can set this up in one of the following ways:

1. **Environment Variables:**
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_REGION=us-east-1
   ```

2. **AWS Credentials File:**
   ```bash
   ~/.aws/credentials
   ```

3. **IAM Role** (when running on EC2/Lambda)

### Environment Variables

The following environment variables are used:

- `ARTIFACTS_BUCKET` - S3 bucket name for storing images (optional, will auto-detect if not set)
- `AWS_REGION` - AWS region (default: `us-east-1`)
- `OPENAI_API_KEY` - OpenAI API key (required for image processing)

### S3 Bucket Setup

The utilities automatically detect the artifacts bucket using one of these methods:

1. `ARTIFACTS_BUCKET` environment variable
2. Auto-detection: `leadmagnet-artifacts-{account_id}`

The bucket must:
- Exist in your AWS account
- Allow public read access (for public URLs)
- Be in the configured AWS region

## Quick Start

### Basic Usage

Process an image from a URL:

```bash
python3 scripts/process_image.py -i https://example.com/image.png
```

Process a local image file:

```bash
python3 scripts/process_image.py -i ~/Downloads/image.png
```

### With Custom Prompt

```bash
python3 scripts/process_image.py -i image.png -p "Make this image more vibrant and colorful"
```

### Keep Temporary Files

```bash
python3 scripts/process_image.py -i image.png --keep-temp
```

## OpenAI Image Inputs (Responses API)

When you need to analyze or condition on images (vision), use the Responses API input
format with `input_text` and `input_image` content items. Each `input_image` can be
provided as either:

- `image_url`: An HTTPS URL or a `data:image/...;base64,...` data URL
- `file_id`: A file uploaded via the OpenAI Files API

Reference: https://platform.openai.com/docs/guides/images-vision#analyze-images

In this codebase, `OpenAIRequestBuilder._build_multimodal_input` builds the
`input_image` items from `previous_image_urls` and converts problematic URLs to
data URLs before sending them to OpenAI.

## Standalone Script Usage

### Command-Line Arguments

The `process_image.py` script accepts the following arguments:

#### Required Arguments

- `--input`, `-i`: Image URL or local file path (required)

#### Optional Arguments

- `--prompt`, `-p`: Custom prompt for OpenAI (default: recreation prompt)
- `--model`, `-m`: OpenAI model to use (default: `gpt-5`)
- `--output-dir`, `-o`: Directory to save temporary files (default: system temp directory)
- `--keep-temp`: Keep temporary files after processing (default: delete them)
- `--background`: Background setting for image generation (default: `transparent`)
- `--quality`: Image quality setting (default: `high`)
- `--s3-prefix`: S3 key prefix for uploaded images (default: `generated-images`)

### Examples

#### Example 1: Process Image from URL

```bash
python3 scripts/process_image.py -i https://example.com/logo.png
```

**Output:**
```
================================================================================
Image Processing with OpenAI and S3 Upload
================================================================================

Step 1: Loading image...
  Detected URL: https://example.com/logo.png...
  ✓ Loaded 45678 bytes

Step 2: Processing with OpenAI...
  Model: gpt-5
  Prompt: (using default recreation prompt)
  ✓ Generated 52341 bytes

Step 3: Uploading to S3...
  ✓ Uploaded to S3

================================================================================
RESULTS
================================================================================
S3 URL:        s3://leadmagnet-artifacts-123456789/generated-images/1234567890_generated_logo.png
Public URL:    https://leadmagnet-artifacts-123456789.s3.us-east-1.amazonaws.com/generated-images/1234567890_generated_logo.png
================================================================================

✓ Processing complete!
```

#### Example 2: Process Local Image with Custom Prompt

```bash
python3 scripts/process_image.py \
  -i ~/Pictures/photo.jpg \
  -p "Convert this to a watercolor painting style" \
  -m gpt-5
```

#### Example 3: Keep Temporary Files for Debugging

```bash
python3 scripts/process_image.py \
  -i image.png \
  --keep-temp \
  -o ~/temp/processed_images
```

This will save the generated image to `~/temp/processed_images/processed_image_{timestamp}.png`.

## Utility Functions Reference

### `download_image_from_url(url, timeout=30)`

Downloads an image from a URL and returns the raw image bytes.

**Parameters:**
- `url` (str): The URL of the image to download
- `timeout` (int): Request timeout in seconds (default: 30)

**Returns:** `bytes` - Raw image bytes

**Raises:**
- `ValueError`: If URL is invalid
- `requests.RequestException`: If download fails
- `requests.HTTPError`: If server returns error status

**Example:**
```python
from scripts.lib.image_processing_utils import download_image_from_url

image_bytes = download_image_from_url("https://example.com/image.png")
print(f"Downloaded {len(image_bytes)} bytes")
```

### `load_image_from_path(file_path)`

Loads an image from a local file path.

**Parameters:**
- `file_path` (str): Path to the image file (supports `~` expansion)

**Returns:** `bytes` - Raw image bytes

**Raises:**
- `FileNotFoundError`: If file doesn't exist
- `PermissionError`: If file cannot be read
- `IOError`: If there's an error reading the file

**Example:**
```python
from scripts.lib.image_processing_utils import load_image_from_path

image_bytes = load_image_from_path("~/Downloads/image.png")
```

### `encode_image_for_openai(image_bytes, mime_type="image/png")`

Encodes an image as base64 for OpenAI API.

**Parameters:**
- `image_bytes` (bytes): Raw image bytes
- `mime_type` (str): MIME type (default: `"image/png"`)

**Returns:** `str` - Base64-encoded string

**Example:**
```python
from scripts.lib.image_processing_utils import encode_image_for_openai

b64_string = encode_image_for_openai(image_bytes, "image/png")
data_url = f"data:image/png;base64,{b64_string}"
```

### `process_image_with_openai(image_bytes, prompt=None, model="gpt-5", background="transparent", quality="high")`

Processes an image through OpenAI Responses API with image generation.

**Parameters:**
- `image_bytes` (bytes): Raw image bytes to process
- `prompt` (str, optional): Text prompt (default: recreation prompt)
- `model` (str): OpenAI model (default: `"gpt-5"`)
- `background` (str): Background setting (default: `"transparent"`)
- `quality` (str): Image quality (default: `"high"`)

**Returns:** `bytes` - Generated PNG image bytes

**Raises:**
- `ValueError`: If image_bytes is empty
- `Exception`: If API call fails or no image returned

**Example:**
```python
from scripts.lib.image_processing_utils import process_image_with_openai

generated_bytes = process_image_with_openai(
    image_bytes,
    prompt="Make this image more vibrant",
    model="gpt-5"
)
```

### `upload_image_to_s3(image_bytes, filename=None, s3_key_prefix="generated-images")`

Uploads an image to S3 and returns object URLs.

**Parameters:**
- `image_bytes` (bytes): Raw image bytes to upload
- `filename` (str, optional): Filename for S3 key
- `s3_key_prefix` (str): S3 key prefix (default: `"generated-images"`)

**Returns:** `Tuple[str, str]` - (s3_url, public_url)

**Raises:**
- `ValueError`: If image_bytes is empty
- `ClientError`: If S3 upload fails
- `RuntimeError`: If bucket name cannot be determined

**Example:**
```python
from scripts.lib.image_processing_utils import upload_image_to_s3

s3_url, public_url = upload_image_to_s3(image_bytes, "output.png")
print(f"Image available at: {public_url}")
```

### `cleanup_temp_files(*file_paths)`

Removes temporary files from the filesystem.

**Parameters:**
- `*file_paths`: Variable number of file paths to delete

**Example:**
```python
from scripts.lib.image_processing_utils import cleanup_temp_files

cleanup_temp_files("/tmp/file1.png", "/tmp/file2.png")
```

## Error Handling

### Common Errors and Solutions

#### 1. `FileNotFoundError: Image file not found`

**Cause:** The specified local file path doesn't exist.

**Solution:**
- Check that the file path is correct
- Use absolute paths or ensure relative paths are correct
- Expand `~` manually if needed: `os.path.expanduser("~/path")`

#### 2. `requests.RequestException: Timeout downloading image`

**Cause:** The image URL is unreachable or too slow.

**Solution:**
- Check the URL is accessible
- Increase timeout: `download_image_from_url(url, timeout=60)`
- Verify network connectivity

#### 3. `Exception: No generated image returned from OpenAI`

**Cause:** OpenAI API didn't return an image in the expected format.

**Solution:**
- Check OpenAI API key is set: `export OPENAI_API_KEY=your_key`
- Verify the model name is correct
- Check API response structure (enable debug logging)

#### 4. `ClientError: Error uploading image to S3`

**Cause:** S3 upload failed (permissions, bucket doesn't exist, etc.).

**Solution:**
- Verify AWS credentials are configured
- Check bucket exists: `aws s3 ls s3://bucket-name`
- Verify IAM permissions include `s3:PutObject`
- Check bucket is in the correct region

#### 5. `RuntimeError: Failed to get AWS account ID`

**Cause:** Cannot determine AWS account ID for bucket auto-detection.

**Solution:**
- Set `ARTIFACTS_BUCKET` environment variable explicitly
- Verify AWS credentials are configured
- Check AWS region is set: `export AWS_REGION=us-east-1`

### Error Handling Best Practices

1. **Always use try-except blocks:**
   ```python
   try:
       image_bytes = download_image_from_url(url)
   except requests.RequestException as e:
       logger.error(f"Failed to download: {e}")
       # Handle error appropriately
   ```

2. **Check return values:**
   ```python
   s3_url, public_url = upload_image_to_s3(image_bytes)
   if not public_url:
       raise ValueError("Failed to get public URL")
   ```

3. **Validate inputs:**
   ```python
   if not image_bytes or len(image_bytes) == 0:
       raise ValueError("Image bytes cannot be empty")
   ```

## S3 Configuration

### Bucket Naming

The utilities use the following bucket naming convention:

- **Environment variable:** `ARTIFACTS_BUCKET` (if set)
- **Auto-detection:** `leadmagnet-artifacts-{account_id}`

### S3 Key Structure

Uploaded images use the following key pattern:

```
{prefix}/{timestamp}_{filename}.png
```

Where:
- `prefix`: Default is `"generated-images"` (configurable via `--s3-prefix`)
- `timestamp`: Unix timestamp (seconds since epoch)
- `filename`: Original filename or auto-generated name

**Example:**
```
generated-images/1703123456_output.png
```

### Public URLs

The utilities generate public URLs in the following format:

```
https://{bucket}.s3.{region}.amazonaws.com/{key}
```

**Example:**
```
https://leadmagnet-artifacts-123456789.s3.us-east-1.amazonaws.com/generated-images/1703123456_output.png
```

If `CLOUDFRONT_DOMAIN` is configured, public URLs should use that domain instead
(production uses `assets.mycoursecreator360.com`):

```
https://assets.mycoursecreator360.com/cust_12345678/jobs/job_123/generated-images/1703123456_output.png
```

These URLs are:
- **Permanent** - Do not expire
- **Public** - Accessible without authentication
- **CDN-backed** - Served from CloudFront when configured, otherwise direct S3

### Bucket Permissions

The S3 bucket must have the following permissions:

1. **PutObject** - For uploading images
2. **Public read access** - For public URLs to work

Example bucket policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::leadmagnet-artifacts-*/*"
    }
  ]
}
```

## Examples

### Example 1: Complete Workflow

```python
from scripts.lib.image_processing_utils import (
    download_image_from_url,
    process_image_with_openai,
    upload_image_to_s3,
    cleanup_temp_files
)

# Download image
image_bytes = download_image_from_url("https://example.com/logo.png")

# Process with OpenAI
generated_bytes = process_image_with_openai(
    image_bytes,
    prompt="Make this logo more modern and minimalist"
)

# Upload to S3
s3_url, public_url = upload_image_to_s3(generated_bytes, "modern_logo.png")

print(f"Image available at: {public_url}")
```

### Example 2: Processing Multiple Images

```python
from scripts.lib.image_processing_utils import (
    load_image_from_path,
    process_image_with_openai,
    upload_image_to_s3
)

image_paths = [
    "~/Pictures/image1.png",
    "~/Pictures/image2.png",
    "~/Pictures/image3.png"
]

results = []

for path in image_paths:
    # Load image
    image_bytes = load_image_from_path(path)
    
    # Process
    generated_bytes = process_image_with_openai(image_bytes)
    
    # Upload
    s3_url, public_url = upload_image_to_s3(generated_bytes)
    
    results.append({
        "path": path,
        "s3_url": s3_url,
        "public_url": public_url
    })

# Print results
for result in results:
    print(f"{result['path']}: {result['public_url']}")
```

### Example 3: Error Handling

```python
from scripts.lib.image_processing_utils import (
    download_image_from_url,
    process_image_with_openai,
    upload_image_to_s3
)
import requests

try:
    # Download
    image_bytes = download_image_from_url("https://example.com/image.png")
    
    # Process
    generated_bytes = process_image_with_openai(image_bytes)
    
    # Upload
    s3_url, public_url = upload_image_to_s3(generated_bytes)
    
    print(f"Success! URL: {public_url}")
    
except requests.RequestException as e:
    print(f"Download failed: {e}")
except Exception as e:
    print(f"Processing failed: {e}")
```

## Troubleshooting

### Issue: Script cannot find the utility module

**Error:**
```
ModuleNotFoundError: No module named 'lib.image_processing_utils'
```

**Solution:**
- Ensure you're running from the project root directory
- Or use: `python3 -m scripts.process_image -i image.png`
- Or add the scripts directory to `PYTHONPATH`:
  ```bash
  export PYTHONPATH="${PYTHONPATH}:$(pwd)/scripts"
  ```

### Issue: OpenAI API key not found

**Error:**
```
openai.error.AuthenticationError: No API key provided
```

**Solution:**
- Set the API key: `export OPENAI_API_KEY=your_key`
- Or create `~/.openai/config.json` with your API key
- Verify the key is valid: `openai api keys list`

### Issue: S3 bucket not found

**Error:**
```
ClientError: The specified bucket does not exist
```

**Solution:**
- List buckets: `aws s3 ls`
- Set bucket explicitly: `export ARTIFACTS_BUCKET=your-bucket-name`
- Create bucket if needed: `aws s3 mb s3://your-bucket-name`

### Issue: Generated image is empty or corrupted

**Symptoms:**
- Image file size is 0 bytes
- Image cannot be opened/viewed

**Solution:**
- Check OpenAI API response structure (enable debug logging)
- Verify the model supports image generation
- Try a different prompt or model
- Check API rate limits and quotas

### Issue: Public URL returns 403 Forbidden

**Error:**
```
403 Forbidden when accessing public URL
```

**Solution:**
- Verify bucket has public read access
- Check bucket policy allows `s3:GetObject` for all principals
- Verify the object was uploaded successfully
- Check object ACL (though ACLs may be blocked by bucket policy)

### Debugging Tips

1. **Enable debug logging:**
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```

2. **Keep temporary files:**
   ```bash
   python3 scripts/process_image.py -i image.png --keep-temp
   ```

3. **Check S3 upload manually:**
   ```bash
   aws s3 ls s3://your-bucket/generated-images/
   ```

4. **Test OpenAI API directly:**
   ```python
   from openai import OpenAI
   client = OpenAI()
   # Test API call
   ```

## Additional Resources

- [OpenAI Responses API Documentation](https://platform.openai.com/docs/api-reference/responses)
- [OpenAI Images & Vision: Analyze Images](https://platform.openai.com/docs/guides/images-vision#analyze-images)
- [AWS S3 Python SDK (boto3) Documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)
- [Requests Library Documentation](https://requests.readthedocs.io/)

## Support

For issues or questions:
1. Check this documentation first
2. Review error messages and logs
3. Check AWS and OpenAI service status
4. Verify configuration and credentials

