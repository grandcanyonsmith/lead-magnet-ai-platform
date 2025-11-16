# Quick Edit Feature - Testing Checklist

## ✅ Pre-Test Verification

1. **Server Status**
   - ✅ Frontend running on http://localhost:3000
   - ✅ Backend API accessible
   - ✅ No console errors on page load

2. **Component Status**
   - ✅ QuickEditStepModal component exists
   - ✅ FiZap icon imported (not FiSparkles)
   - ✅ All imports correct

## 🧪 Manual Testing Steps

### Step 1: Navigate to Jobs Page
- [ ] Open http://localhost:3000/dashboard/jobs
- [ ] Verify jobs list loads
- [ ] Find a completed job (status: "completed")

### Step 2: Open Job Detail
- [ ] Click on a completed job
- [ ] URL should be `/dashboard/jobs/[job-id]`
- [ ] Scroll to "Execution Steps" section
- [ ] Expand if collapsed

### Step 3: Locate Quick Edit Button
- [ ] Find completed steps (green checkmark ✓)
- [ ] Look for purple "Quick Edit" button with ⚡ icon
- [ ] Button should be next to "Rerun Step" (if available)
- [ ] Button only appears on steps with output

### Step 4: Test Modal Opening
- [ ] Click "Quick Edit" button
- [ ] Modal opens with:
  - Header: "Quick Edit Step" with ⚡ icon
  - Step info box showing step number and name
  - Textarea for prompt input
  - "Generate Changes" button

### Step 5: Test Prompt Input
- [ ] Enter test prompt: "Make the tone more professional"
- [ ] Textarea accepts input
- [ ] "Generate Changes" button enabled

### Step 6: Test Generation
- [ ] Click "Generate Changes"
- [ ] Button shows loading state ("Generating..." with spinner)
- [ ] Wait 10-20 seconds for API response
- [ ] Check browser console (F12) for any errors

### Step 7: Review Proposed Changes
- [ ] Modal shows:
  - Blue summary box with changes description
  - Two-column layout:
    - Left: "Original Output" (gray border)
    - Right: "Edited Output" (green border)
  - Both outputs scrollable
- [ ] Verify edited output reflects prompt
- [ ] Format preserved (JSON/string/markdown)

### Step 8: Test Save
- [ ] Click "Save Changes"
- [ ] Button shows "Saving..." with spinner
- [ ] Success toast appears: "Changes saved successfully"
- [ ] Modal closes automatically
- [ ] Page refreshes

### Step 9: Verify Changes Persisted
- [ ] After refresh, expand edited step
- [ ] Output shows edited version
- [ ] Other step metadata intact

### Step 10: Test Error Handling
- [ ] Try empty prompt → Should show error toast
- [ ] Try closing modal without saving → Should close cleanly
- [ ] Try "Start Over" → Should reset to prompt input

## 🔍 Debugging

### Check Browser Console (F12)
- Look for:
  - Any red errors
  - Network requests to `/admin/jobs/*/quick-edit-step`
  - Response status codes (should be 200)

### Check Network Tab
- Filter: "quick-edit-step"
- Verify:
  - Request payload: `{ step_order, user_prompt, save: false/true }`
  - Response: `{ original_output, edited_output, changes_summary, saved }`

### Common Issues
1. **Button not showing**: Check step has output (not null/empty)
2. **Modal not opening**: Check console for import errors
3. **Generation fails**: Check backend logs, OpenAI API key
4. **Save fails**: Check S3 permissions, backend logs

## ✅ Success Criteria

- [ ] Quick Edit button visible on completed steps
- [ ] Modal opens and closes correctly
- [ ] Prompt input works
- [ ] Changes generate successfully
- [ ] Preview shows correctly
- [ ] Changes save and persist
- [ ] No console errors
- [ ] No network errors

