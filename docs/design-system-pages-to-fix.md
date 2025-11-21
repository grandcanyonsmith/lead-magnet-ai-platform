# Pages Needing Design System Updates

Based on the new minimalist design system (Linear/Airbnb style), here are all pages that still need to be updated:

## ✅ Already Fixed
- `/dashboard` - Main dashboard page (updated)
- `/dashboard/layout.tsx` - Shell layout (updated)

## 🔴 High Priority - Core Dashboard Pages

### 1. `/dashboard/workflows` (Workflows List Page)
**File:** `frontend/src/app/dashboard/workflows/page.tsx`
**Issues:**
- Uses old color scheme (`text-gray-900`, `bg-primary-600`, `from-primary-600 to-primary-700`)
- Old button styles with gradients
- Old card styling (`bg-white rounded-lg shadow`)
- Needs: Clean cards, updated buttons, ink/brand color tokens

### 2. `/dashboard/jobs` (Jobs List Page)
**File:** `frontend/src/app/dashboard/jobs/page.tsx`
**Issues:**
- Uses old color scheme (`text-gray-900`, `bg-primary-600`)
- Old filter styling
- Old table/card styling
- Needs: Updated filters, clean table design, brand color tokens

### 3. `/dashboard/settings` (Settings Page)
**File:** `frontend/src/app/dashboard/settings/page.tsx`
**Issues:**
- Uses old color scheme (`text-gray-900`, `bg-primary-600`)
- Old form styling
- Needs: Clean form inputs, updated tabs, brand color tokens

### 4. `/dashboard/artifacts` (Artifacts/Downloads Page)
**File:** `frontend/src/app/dashboard/artifacts/page.tsx`
**Issues:**
- Uses old color scheme (`text-gray-900`, `bg-primary-600`)
- Old card grid styling
- Needs: Updated preview cards, clean grid layout

### 5. `/dashboard/files` (Files Page)
**File:** `frontend/src/app/dashboard/files/page.tsx`
**Issues:**
- Uses old color scheme (`text-gray-900`, `bg-primary-600`)
- Old upload section styling
- Old file list styling
- Needs: Clean upload UI, updated file cards

## 🟡 Medium Priority - Detail/Edit Pages

### 6. `/dashboard/workflows/[id]` (Workflow Detail)
**File:** `frontend/src/app/dashboard/workflows/[id]/page-client.tsx`
**Needs:** Review and update styling

### 7. `/dashboard/workflows/[id]/edit` (Edit Workflow)
**File:** `frontend/src/app/dashboard/workflows/[id]/edit/page-client.tsx`
**Needs:** Review and update styling

### 8. `/dashboard/workflows/new` (New Workflow)
**File:** `frontend/src/app/dashboard/workflows/new/page.tsx`
**Needs:** Review and update styling

### 9. `/dashboard/jobs/[id]` (Job Detail)
**File:** `frontend/src/app/dashboard/jobs/[id]/page-client.tsx`
**Needs:** Review and update styling

### 10. `/dashboard/forms/new` (New Form)
**File:** `frontend/src/app/dashboard/forms/new/page-client.tsx`
**Needs:** Review and update styling

### 11. `/dashboard/forms/[id]/edit` (Edit Form)
**File:** `frontend/src/app/dashboard/forms/[id]/edit/page-client.tsx`
**Needs:** Review and update styling

## 🟢 Lower Priority - Admin/Auth Pages

### 12. `/dashboard/agency/users` (Agency Users - Admin)
**File:** `frontend/src/app/dashboard/agency/users/page.tsx`
**Needs:** Review and update styling

### 13. `/auth/login` (Login Page)
**File:** `frontend/src/app/auth/login/page.tsx`
**Issues:**
- Uses old gradient backgrounds (`bg-gradient-to-br from-blue-50 via-white to-purple-50`)
- Uses old color scheme (`bg-primary-600`, `from-primary-600 to-primary-700`)
- Needs: Clean minimalist auth page, updated button styles

### 14. `/auth/signup` (Signup Page)
**File:** `frontend/src/app/auth/signup/page.tsx`
**Needs:** Review and update styling (likely similar to login)

### 15. `/onboarding/survey` (Onboarding Survey)
**File:** `frontend/src/app/onboarding/survey/page.tsx`
**Needs:** Review and update styling

## 🔵 Public Pages

### 16. `/v1/forms/[[...slug]]` (Public Form Page)
**File:** `frontend/src/app/v1/forms/[[...slug]]/page-client.tsx`
**Needs:** Review and update styling (public-facing, may need different treatment)

## Design System Tokens to Use

Replace old colors with new tokens:
- `text-gray-900` → `text-ink-900`
- `text-gray-600` → `text-ink-600`
- `bg-primary-600` → `bg-brand-600`
- `from-primary-600 to-primary-700` → `bg-brand-600` (remove gradients)
- `bg-white rounded-lg shadow` → `bg-white rounded-2xl shadow-soft border border-white/60`
- `border-gray-300` → `border-white/60` or `border-ink-200`
- Old gradients → Solid colors with subtle borders

## Common Patterns to Update

1. **Buttons:**
   - Old: `bg-gradient-to-r from-primary-600 to-primary-700`
   - New: `bg-brand-600 rounded-2xl shadow-soft`

2. **Cards:**
   - Old: `bg-white rounded-lg shadow`
   - New: `bg-white rounded-2xl shadow-soft border border-white/60`

3. **Inputs:**
   - Old: `border-gray-300 rounded-lg`
   - New: `border-white/60 rounded-2xl bg-white/90`

4. **Text:**
   - Old: `text-gray-900` → New: `text-ink-900`
   - Old: `text-gray-600` → New: `text-ink-600`


