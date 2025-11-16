# Manual Testing Guide for Markdown & HTML Changes

## ✅ Backend Tests Passed

All backend logic tests passed:
- ✅ HTML content detection works correctly
- ✅ File extension assignment (.html vs .md) works correctly  
- ✅ Content type mapping works correctly

## Manual Testing Steps

### Prerequisites
- Frontend running on http://localhost:3000
- API running on http://localhost:3001
- At least one completed job with artifacts

### Test 1: Markdown File Rendering

**Steps:**
1. Navigate to http://localhost:3000/dashboard/artifacts
2. Look for artifacts with `.md` extension or `text/markdown` content type
3. **Expected Behavior:**
   - Markdown files should render as **formatted markdown** (not just an icon)
   - You should see:
     - Headers styled properly
     - Lists formatted correctly
     - Links clickable
     - Code blocks syntax highlighted
     - Bold/italic text rendered

**What to Check:**
- [ ] Markdown preview shows formatted content (not just "Text File" icon)
- [ ] Headers are styled and larger
- [ ] Lists have proper bullets/numbers
- [ ] Links are blue and clickable
- [ ] Code blocks have syntax highlighting
- [ ] Loading state shows "Loading markdown..." while fetching

**If markdown doesn't render:**
- Check browser console for errors
- Verify the artifact has `content_type: "text/markdown"`
- Check that the artifact URL is accessible (not expired)

### Test 2: HTML File Extension

**Steps:**
1. Navigate to http://localhost:3000/dashboard/artifacts
2. Look for artifacts that contain HTML content
3. **Expected Behavior:**
   - HTML files should have `.html` extension (not `.md`)
   - File extension badge should show "HTML" (not "MD")
   - HTML files should render in iframe preview

**What to Check:**
- [ ] HTML artifacts have `.html` extension in filename
- [ ] File extension badge shows "HTML" in top-right corner
- [ ] HTML preview renders correctly in iframe
- [ ] Old artifacts may still have `.md` (this is expected for artifacts created before the change)

**Note:** Only NEW jobs created after the changes will have HTML files with `.html` extension. Old jobs will still have `.md` extensions.

### Test 3: Create New Job to Verify Changes

**Steps:**
1. Create a new workflow/job that generates HTML content
2. Wait for the job to complete
3. Navigate to http://localhost:3000/dashboard/artifacts
4. Find the newly created artifacts

**Expected Behavior:**
- Step outputs that contain HTML should have `.html` extension
- Step outputs that contain markdown should have `.md` extension
- Markdown files should render formatted content
- HTML files should render in iframe

**What to Check:**
- [ ] New HTML artifacts have `.html` extension
- [ ] New markdown artifacts have `.md` extension
- [ ] Markdown files render formatted content
- [ ] HTML files render in iframe preview

### Test 4: Browser Console Verification

**Steps:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Navigate to http://localhost:3000/dashboard/artifacts
4. Check for any errors

**Expected:**
- No errors related to ReactMarkdown
- No errors related to PreviewRenderer
- No "Element type is invalid" errors

**If you see errors:**
- Check that `react-markdown` and `remark-gfm` are installed
- Verify imports are correct
- Check browser console for specific error messages

### Test 5: Network Tab Verification

**Steps:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to http://localhost:3000/dashboard/artifacts
4. Look for requests to artifact URLs

**Expected:**
- Markdown files should fetch content when scrolled into view
- Requests should return `text/markdown` content type
- No CORS errors
- No 404 errors for artifact URLs

## Verification Checklist

### Markdown Rendering
- [ ] Markdown files show formatted content (not just icon)
- [ ] Headers are styled properly
- [ ] Lists are formatted correctly
- [ ] Links are clickable
- [ ] Code blocks have syntax highlighting
- [ ] Loading state works correctly
- [ ] Error state shows if markdown fails to load

### HTML File Extensions
- [ ] New HTML artifacts have `.html` extension
- [ ] File extension badge shows "HTML"
- [ ] HTML preview renders in iframe
- [ ] Old artifacts may still have `.md` (expected)

### Content Types
- [ ] Markdown files have `content_type: "text/markdown"`
- [ ] HTML files have `content_type: "text/html"`
- [ ] Images have `content_type: "image/png"` or `"image/jpeg"`

### API Mapping
- [ ] API returns `content_type` field (mapped from `mime_type`)
- [ ] Frontend receives correct content types
- [ ] PreviewRenderer uses content types correctly

## Troubleshooting

### Markdown not rendering
1. Check browser console for errors
2. Verify `react-markdown` is installed: `npm list react-markdown`
3. Check artifact has `content_type: "text/markdown"`
4. Verify artifact URL is accessible
5. Check Network tab for failed requests

### HTML files still showing as .md
1. Verify you're looking at a NEW job (created after changes)
2. Check backend logs for file extension detection
3. Verify the content actually starts with `<` character
4. Old artifacts will still have `.md` (this is expected)

### Content type not showing
1. Check API response includes `content_type` field
2. Verify API maps `mime_type` to `content_type`
3. Check browser DevTools Network tab for API response
4. Restart API server if needed

## Expected Results

After testing, you should see:

1. **Markdown files:** Render as formatted markdown with proper styling
2. **HTML files:** Have `.html` extension and render in iframe
3. **File badges:** Show correct file type (MD, HTML, PNG, etc.)
4. **No errors:** Browser console should be clean
5. **Proper content types:** All artifacts have correct content types

## Notes

- Old artifacts created before these changes will still have `.md` extensions
- Only new jobs will use the updated logic
- Markdown rendering requires the artifact to be publicly accessible
- The changes are backward compatible - old artifacts will still work

