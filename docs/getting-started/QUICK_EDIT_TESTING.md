# Quick Edit Feature - E2E Testing Guide

## Prerequisites
1. Frontend dev server running on `http://localhost:3000`
2. Backend API running on `http://localhost:3001` (or configured API URL)
3. At least one completed job with execution steps

## Manual Testing Steps

### Step 1: Navigate to Jobs List
1. Open browser to `http://localhost:3000/dashboard/jobs`
2. Verify you can see a list of jobs
3. Look for a job with status "completed"

### Step 2: Open Job Detail Page
1. Click on any completed job
2. URL should be `/dashboard/jobs/[job-id]`
3. Scroll down to find the "Execution Steps" section
4. Expand the Execution Steps section if collapsed

### Step 3: Locate Quick Edit Button
1. Find a completed step (should have a green checkmark)
2. Look for the "Quick Edit" button with sparkles icon (purple color)
3. Button should be visible next to "Rerun Step" button (if available)
4. Verify button is only shown on steps with output (completed steps)

### Step 4: Open Quick Edit Modal
1. Click the "Quick Edit" button
2. Modal should open with:
   - Header: "Quick Edit Step" with sparkles icon
   - Step info showing step number and name
   - Textarea for entering prompt
   - "Generate Changes" button

### Step 5: Generate Changes
1. Enter a test prompt in the textarea, e.g.:
   - "Make the tone more professional"
   - "Add more details about the main topic"
   - "Fix any grammar errors"
2. Click "Generate Changes" button
3. Button should show loading state ("Generating...")
4. Wait for API response (may take 5-15 seconds)

### Step 6: Review Proposed Changes
1. After generation completes, modal should show:
   - Blue summary box with changes summary
   - Two-column layout:
     - Left: "Original Output" (gray border)
     - Right: "Edited Output" (green border)
   - Both outputs should be scrollable if long
2. Verify the edited output reflects your prompt
3. Check that format is preserved (JSON stays JSON, markdown stays markdown)

### Step 7: Save Changes
1. Review the changes
2. Click "Save Changes" button
3. Button should show loading state ("Saving...")
4. Success toast should appear: "Changes saved successfully"
5. Modal should close automatically
6. Page should refresh to show updated step output

### Step 8: Verify Changes Saved
1. After page refresh, expand the step that was edited
2. Verify the output shows the edited version
3. Check that the step still has all other metadata intact

### Step 9: Test Error Handling
1. Try generating changes with empty prompt
   - Should show error: "Please enter a prompt describing the changes you want"
2. Try with a very long prompt (1000+ characters)
   - Should still work (may take longer)
3. Try editing a step that doesn't exist
   - Should show appropriate error message

### Step 10: Test Cancel/Close
1. Open Quick Edit modal
2. Enter a prompt and generate changes
3. Click "Start Over" button
   - Should clear the changes and reset to prompt input
4. Click "X" button or click outside modal
   - Should close modal without saving

## Expected Behavior

### Visual Elements
- Quick Edit button: Purple color (#9333EA), sparkles icon
- Modal: Centered, max-width 4xl, scrollable content
- Loading states: Spinner icon, disabled buttons
- Success/Error: Toast notifications at top of screen

### API Calls
1. **Generate Changes** (save=false):
   - `POST /admin/jobs/{jobId}/quick-edit-step`
   - Body: `{ step_order: number, user_prompt: string, save: false }`
   - Response: `{ original_output, edited_output, changes_summary, saved: false }`

2. **Save Changes** (save=true):
   - `POST /admin/jobs/{jobId}/quick-edit-step`
   - Body: `{ step_order: number, user_prompt: string, save: true }`
   - Response: `{ original_output, edited_output, changes_summary, saved: true }`

### Browser Console
- Check for any errors in browser DevTools console
- Network tab should show API calls to `/admin/jobs/{jobId}/quick-edit-step`
- Verify responses are successful (200 status)

## Troubleshooting

### Quick Edit button not showing
- Verify step has output (not null/undefined/empty)
- Check step_order > 0 (form submission step excluded)
- Verify `onQuickEdit` prop is passed to ExecutionSteps component

### Modal not opening
- Check browser console for errors
- Verify jobId is valid
- Check that QuickEditStepModal component is imported

### Changes not generating
- Check API endpoint is accessible
- Verify OpenAI API key is configured
- Check backend logs for errors
- Verify execution steps exist in S3

### Changes not saving
- Check S3 permissions
- Verify job has execution_steps_s3_key
- Check backend logs for S3 upload errors
- Verify DynamoDB update permissions

## Test Cases Checklist

- [ ] Quick Edit button appears on completed steps
- [ ] Quick Edit button does NOT appear on pending steps
- [ ] Modal opens when button clicked
- [ ] Prompt input accepts text
- [ ] Generate Changes button works
- [ ] Loading state shows during generation
- [ ] Proposed changes display correctly
- [ ] Original and edited outputs are formatted properly
- [ ] Save Changes button works
- [ ] Changes persist after page refresh
- [ ] Error handling works for empty prompt
- [ ] Modal closes after save
- [ ] Start Over button resets modal
- [ ] Cancel/close works without saving

