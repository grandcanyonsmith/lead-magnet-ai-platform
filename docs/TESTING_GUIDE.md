# E2E Testing Guide for Artifact Features

## Prerequisites
- Frontend running on http://localhost:3000
- API running on http://localhost:3001
- At least one completed job with artifacts

## Testing Steps

### 1. Test Markdown Rendering

**Steps:**
1. Navigate to http://localhost:3000/dashboard/artifacts
2. Look for artifacts with `.md` extension or `text/markdown` content type
3. **Expected:** Markdown files should render as formatted markdown (with headers, lists, links, etc.) instead of just showing an icon
4. **Verify:** The preview card should show rendered markdown content, not just a file icon

**What to look for:**
- Markdown files display formatted content
- Headers are styled
- Lists are properly formatted
- Links are clickable
- Code blocks are syntax highlighted

### 2. Test HTML File Extension

**Steps:**
1. Navigate to http://localhost:3000/dashboard/artifacts
2. Look for artifacts that contain HTML content
3. **Expected:** HTML files should have `.html` extension (not `.md`)
4. **Verify:** Check the file name badge in the top-right corner of artifact cards - should show "HTML" not "MD"

**What to look for:**
- HTML artifacts have `.html` extension
- File extension badge shows "HTML"
- HTML files render in iframe preview correctly

### 3. Test Image Artifacts

**Steps:**
1. Navigate to http://localhost:3000/dashboard/artifacts
2. Look for artifacts with type "image" or image content types (`image/png`, `image/jpeg`)
3. **Expected:** Images should appear as separate artifacts in the list
4. **Verify:** 
   - Image previews should show the actual image
   - Images should have proper file extensions (`.png`, `.jpg`, etc.)
   - Image artifacts should be filterable by type

**What to look for:**
- Images appear as artifacts (not just URLs in step outputs)
- Image previews render correctly
- Image artifacts have correct metadata (size, type, etc.)
- Filter by "image" type shows only images

### 4. Test Artifact Filtering

**Steps:**
1. Navigate to http://localhost:3000/dashboard/artifacts
2. Use the filter dropdown to filter by artifact type
3. **Expected:** Should see types including: `step_output`, `html_final`, `markdown_final`, `image`
4. **Verify:** Filtering works correctly for each type

### 5. Test Artifact Preview

**Steps:**
1. Click on any artifact card to view details
2. **Expected:** 
   - Markdown files show rendered content
   - HTML files show rendered HTML in iframe
   - Images show the image preview
   - File extension badge is correct
3. **Verify:** Download and "open in new tab" buttons work

## Manual Verification Checklist

- [ ] Markdown files render as formatted markdown (not just icons)
- [ ] HTML files have `.html` extension (not `.md`)
- [ ] Images appear as separate artifacts
- [ ] Image previews work correctly
- [ ] Artifact filtering works for all types
- [ ] File extension badges are correct
- [ ] Download buttons work
- [ ] "Open in new tab" buttons work

## Troubleshooting

### Markdown not rendering
- Check browser console for errors
- Verify `react-markdown` is installed
- Check that `content_type` is `text/markdown`

### HTML files still showing as .md
- Check that new jobs are being created (old jobs may still have .md)
- Verify backend changes are deployed/restarted
- Check job execution logs for file extension detection

### Images not appearing
- Check that jobs have generated images
- Verify image URLs are being extracted from step outputs
- Check backend logs for image artifact storage
- Verify API is mapping `mime_type` to `content_type`

## Notes

- Old artifacts created before these changes may still have `.md` extensions
- New jobs will use the updated logic
- Image artifacts are only created for jobs that generate images
- Markdown rendering requires the artifact to be publicly accessible

