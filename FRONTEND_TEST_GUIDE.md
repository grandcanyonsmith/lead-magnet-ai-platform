# 🧪 Frontend E2E Testing Guide

## 🎯 Overview

This guide walks you through testing all frontend features with the live backend.

**Frontend URL:** http://localhost:3002  
**Backend API:** https://czp5b77azd.execute-api.us-east-1.amazonaws.com

---

## 🔐 Step 1: Authentication Test

### Login
1. Navigate to: http://localhost:3002
2. Should redirect to: http://localhost:3002/auth/login
3. Enter credentials:
   - Email: `test@example.com`
   - Password: `TestPass123!`
4. Click "Sign in"

**Expected:** Redirect to dashboard

**✅ Success Criteria:**
- No error messages
- Successfully redirected to /dashboard
- Dashboard page loads

---

## 📊 Step 2: Dashboard Test

### View Analytics
1. Should see dashboard with stats
2. Check for these widgets:
   - Total Jobs
   - Completed Jobs
   - Failed Jobs
   - Pending Jobs
   - Success Rate
   - Avg Processing Time

**Expected:** Analytics data from DynamoDB

**✅ Success Criteria:**
- Widgets display numbers
- Quick Actions buttons present
- System Overview section shows data

**Test Data Check:**
Open browser console and check for API calls:
- Should see: `GET /admin/analytics`
- Should return: Analytics data object

---

## 📝 Step 3: Workflows Test

### View Workflows
1. Click "Workflows" in sidebar
2. Should see list of workflows

**Expected:** See test workflow (wf_test001)

**✅ Success Criteria:**
- Table displays workflows
- Shows: Test Workflow
- Status: active badge
- AI Model: gpt-4o

### View Workflow Details
1. Click the eye icon on test workflow
2. Should navigate to workflow detail page

**Expected:** Full workflow information

---

## 📋 Step 4: Forms Test

### View Forms
1. Click "Forms" in sidebar
2. Should see list of forms

**Expected:** See test form (form_test001)

**✅ Success Criteria:**
- Table displays forms
- Shows: Test Form
- Public slug: test-form

### Test Public Form URL
1. Copy the public form URL
2. Open in new tab: `/v1/forms/test-form`

**Expected:** Form schema JSON displayed

---

## 🎨 Step 5: Templates Test

### View Templates
1. Click "Templates" in sidebar
2. Should see list of templates

**Expected:** See test template (tmpl_test001)

**✅ Success Criteria:**
- Table displays templates
- Shows: Test Template
- Version: 1

---

## 💼 Step 6: Jobs Test

### View Jobs
1. Click "Jobs" in sidebar
2. Should see list of jobs

**Expected:** Multiple completed jobs

**✅ Success Criteria:**
- Table displays jobs
- Status badges (completed, pending, etc.)
- Job IDs displayed
- Timestamps shown
- "View Output" links present

### Check Job Details
1. Look for completed jobs
2. Check if output URL is present

**Expected:** Jobs from our test submissions

---

## ⚙️ Step 7: Settings Test

### View Settings
1. Click "Settings" in sidebar
2. Should see settings form

**Expected:** Settings loaded or default values

**✅ Success Criteria:**
- Form displays
- Fields editable
- Save button present

### Update Settings
1. Change "Organization Name" to "Test Org"
2. Click "Save Settings"

**Expected:** Success message

**✅ Success Criteria:**
- Green success banner
- "Settings saved successfully!"
- No errors

---

## 🔍 Step 8: Browser Console Test

### Check API Calls
Open browser DevTools (F12) → Network tab

**Verify these API calls work:**

1. **GET /admin/analytics** → Should return 200
2. **GET /admin/workflows** → Should return 200
3. **GET /admin/forms** → Should return 200
4. **GET /admin/jobs** → Should return 200
5. **GET /admin/templates** → Should return 200
6. **GET /admin/settings** → Should return 200
7. **PUT /admin/settings** → Should return 200 (after save)

**Expected:** All return 200 OK with JSON data

---

## 🧪 Step 9: Create New Workflow Test

### Test Workflow Creation
1. Go to Workflows page
2. Click "New Workflow" button
3. Fill in form:
   - Name: "My Test Workflow"
   - AI Model: gpt-4o
   - AI Instructions: "Generate a test report"
   - Template: Select test template
4. Click "Save"

**Expected:** New workflow created

**✅ Success Criteria:**
- Success message
- Redirected to workflows list
- New workflow appears in table

---

## 📱 Step 10: Mobile Responsive Test

### Test Mobile View
1. Open DevTools (F12)
2. Toggle device toolbar (Cmd+Shift+M or Ctrl+Shift+M)
3. Select mobile device (iPhone, iPad, etc.)
4. Navigate through pages

**Expected:** Responsive layout

**✅ Success Criteria:**
- Hamburger menu appears
- Sidebar collapses
- Content adjusts to screen size
- All features accessible

---

## 🎯 Step 11: Sign Out Test

### Test Logout
1. Click "Sign Out" in sidebar
2. Should redirect to login page

**Expected:** Logged out successfully

**✅ Success Criteria:**
- Redirected to /auth/login
- Session cleared
- Cannot access /dashboard without login

---

## ✅ CHECKLIST SUMMARY

Use this checklist while testing:

- [ ] Login successful
- [ ] Dashboard loads with analytics
- [ ] Workflows page displays data
- [ ] Forms page displays data
- [ ] Templates page displays data
- [ ] Jobs page displays data
- [ ] Settings page loads
- [ ] Settings can be updated
- [ ] All API calls return 200
- [ ] No console errors
- [ ] Mobile responsive works
- [ ] Sign out works

---

## 🐛 Troubleshooting

### Issue: "Unauthorized" errors
**Fix:** Check if logged in, token might be expired

### Issue: "Network Error"
**Fix:** Verify API URL in .env.local, check backend is running

### Issue: Data not loading
**Fix:** Check browser console for errors, verify DynamoDB has data

### Issue: CORS errors
**Fix:** API Gateway CORS should be configured (already done)

---

## 📝 Test Results Template

```
=== FRONTEND E2E TEST RESULTS ===

Date: _______________
Tester: _______________

Authentication:
□ Login              [ PASS / FAIL ]
□ Logout             [ PASS / FAIL ]

Dashboard:
□ Analytics display  [ PASS / FAIL ]
□ Quick actions      [ PASS / FAIL ]

Data Management:
□ Workflows list     [ PASS / FAIL ]
□ Forms list         [ PASS / FAIL ]
□ Templates list     [ PASS / FAIL ]
□ Jobs list          [ PASS / FAIL ]
□ Settings page      [ PASS / FAIL ]

Functionality:
□ Create workflow    [ PASS / FAIL ]
□ Update settings    [ PASS / FAIL ]
□ View job details   [ PASS / FAIL ]

UI/UX:
□ Mobile responsive  [ PASS / FAIL ]
□ Navigation works   [ PASS / FAIL ]
□ No console errors  [ PASS / FAIL ]

Overall Result: [ PASS / FAIL ]
```

---

## 🎉 Expected Outcome

After completing all tests:
- ✅ All features working
- ✅ No errors in console
- ✅ Data loads from backend
- ✅ CRUD operations work
- ✅ Mobile responsive
- ✅ Ready for production!

---

**Once testing is complete, report results and we'll push to GitHub!**

