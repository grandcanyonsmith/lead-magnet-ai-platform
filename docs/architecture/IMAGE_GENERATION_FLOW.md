# Image Generation Flow

## Overview
This document explains how image generation works in the workflow processing system.

## Flow Diagram

```
1. Form Submission
   └─> Creates Job in DynamoDB
       └─> Job status: "processing"

2. JobProcessor.process_job()
   └─> WorkflowOrchestrator.execute_workflow()
       └─> StepProcessor.process_step_batch_mode()
           └─> AIService.generate_report()
               ├─> Detects image_generation tool in step config
               ├─> If image model is gpt-image-*:
               │   └─> ImageGenerator.generate_images_via_api()
               │       ├─> Planner call (Responses API) generates JSON prompts
               │       ├─> Images API called per prompt (gpt-image-*)
               │       ├─> Base64 images uploaded to S3 via ImageHandler
               │       └─> Returns response_details.image_urls
               └─> Otherwise: regular Responses API flow (non-image tools)

3. StepProcessor receives response_details
   └─> Extracts image_urls from response_details
       └─> ImageArtifactService.store_image_artifacts()
           └─> Stores images in S3 and creates artifacts

4. ExecutionStepManager.create_ai_generation_step()
   └─> Stores step with image_urls in execution_steps
       └─> Saved to S3 (execution_steps_s3_key)
```

## Key Files

### API Call Location
- **File**: `backend/worker/services/openai_client.py`
- **Method**: `create_response()` → `client.responses.create(**params)`
- **Line**: ~146

### Image Extraction Location
- **File**: `backend/worker/services/ai/image_generator.py`
- **Method**: `generate_images_via_api()`
- **Section**: Uploads base64 to S3 and returns `image_urls`

### Workflow Processing Entry Point
- **File**: `backend/worker/processor.py`
- **Method**: `JobProcessor.process_job()`
- **Calls**: `WorkflowOrchestrator.execute_workflow()`

### Step Processing
- **File**: `backend/worker/services/step_processor.py`
- **Method**: `process_step_batch_mode()`
- **Calls**: `AIService.generate_report()`

### AI Service
- **File**: `backend/worker/ai_service.py`
- **Method**: `generate_report()`
- **Calls**: `OpenAIClient.make_api_call()` then `process_api_response()`

## Debugging

To see where API calls are made, check logs for:
- `[OpenAI Client] Making Responses API call` - Shows API call is being made
- `[OpenAI Client] Received Responses API response` - Shows response received
- `[OpenAI Client] Found ImageGenerationCall class` - Shows image item found
- `[OpenAI Client] Processing base64 image data` - Shows base64 extraction
- `[OpenAI Client] Successfully converted base64 image` - Shows URL conversion

## Common Issues

1. **No image URLs extracted**
   - Check if `ImageGenerationCall` items are found in response.output
   - Check if `image_handler` is initialized (requires S3Service)
   - Check backend logs for extraction attempts

2. **API call not made**
   - Check if workflow processing is triggered
   - Check if step has `image_generation` tool configured
   - Check if `tool_choice` is set correctly

3. **Base64 conversion fails**
   - Check if `image_handler` is passed to `process_api_response`
   - Check S3 permissions and bucket configuration
   - Check if base64 data is valid
4. **Wrong asset domain**
   - Ensure `CLOUDFRONT_DOMAIN=assets.mycoursecreator360.com` is set
   - Verify CloudFront custom domain is attached to the distribution

