# Mobile Testing Checklist

## ✅ Mobile Fixes Deployed

### 1. Job Detail Page Navigation
- **Fix**: Changed from `router.push()` to `window.location.href` for static export compatibility
- **Files**: `frontend/src/app/dashboard/jobs/page.tsx`
- **Status**: ✅ Deployed

### 2. View Document Links
- **Fix**: Added event handlers to prevent parent card click propagation
- **Files**: `frontend/src/app/dashboard/jobs/page.tsx`
- **Status**: ✅ Deployed

### 3. Form Page Slug Extraction
- **Fix**: Extract slug from URL pathname for CloudFront static export compatibility
- **Files**: `frontend/src/app/v1/forms/[[...slug]]/page-client.tsx`
- **Status**: ✅ Deployed

## 📱 Mobile Test URLs

### Test on Mobile Device:

1. **Jobs List Page**:
   ```
   https://forms.mycoursecreator360.com/dashboard/jobs
   ```
   - ✅ Click on a job card → Should navigate to job detail page
   - ✅ Click "View Document" link → Should open document in new tab (not redirect to dashboard)

2. **Job Detail Page**:
   ```
   https://forms.mycoursecreator360.com/dashboard/jobs/{job_id}
   ```
   - ✅ Page should load correctly
   - ✅ Job details should display

3. **Public Form Page**:
   ```
   https://forms.mycoursecreator360.com/v1/forms/ai-personalized-resource-request
   ```
   - ✅ Form should load
   - ✅ Slug should be extracted from URL
   - ✅ Form fields should display
   - ✅ Form submission should work

## 🧪 Quick Mobile Test Commands

```bash
# Test API endpoints (works from any device)
curl "https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/ai-personalized-resource-request"

# Test form submission
curl -X POST "https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/ai-personalized-resource-request/submit" \
  -H "Content-Type: application/json" \
  -d '{"submission_data":{"name":"Mobile Test","email":"mobile@test.com","phone":"+14155551234","field_1":"Test","field_2":"test@test.com","field_3":"Technology","field_4":"Beginner","field_5":"Testing mobile"}}'
```

## 📋 Mobile-Specific Test Scenarios

### Scenario 1: Job List → Job Detail
1. Open jobs list on mobile
2. Tap a job card
3. **Expected**: Navigate to job detail page (not dashboard)

### Scenario 2: View Document Link
1. Open jobs list on mobile
2. Find a job with "View Document" link
3. Tap the "View Document" link
4. **Expected**: Document opens in new tab (not redirect to dashboard)

### Scenario 3: Form Page
1. Open form URL directly on mobile
2. **Expected**: Form loads and displays correctly
3. Fill out form and submit
4. **Expected**: Success message and job creation

## 🔍 Debugging Mobile Issues

If issues persist on mobile:

1. **Clear browser cache** on mobile device
2. **Check CloudFront cache**: Wait 2-3 minutes after deployment
3. **Verify JavaScript console** for errors:
   - Open mobile browser dev tools
   - Check for console errors
4. **Test in incognito/private mode** to avoid cache issues

## ✅ Expected Behavior

- ✅ Job cards navigate correctly on tap
- ✅ "View Document" links open documents (not redirect)
- ✅ Form pages load with correct slug extraction
- ✅ All navigation uses `window.location.href` for static export compatibility

