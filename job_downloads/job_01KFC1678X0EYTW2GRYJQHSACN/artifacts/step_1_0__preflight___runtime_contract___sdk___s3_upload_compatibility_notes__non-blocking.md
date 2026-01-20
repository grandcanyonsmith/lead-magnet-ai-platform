## Execution Contract (Global, No-Interaction Workflow)

### 1) Working Directory + Required Folder Structure
All work MUST occur under `/work/` with these relative paths:

```
/work/
  canon/     (canonical JSON registries)
  src/       (structured content JSON)
  build/     (intermediate outputs)
  dist/      (final deploy-ready site bundle)
  dist/assets/  (all deployable static assets)
```

**Deployment rule:** Only contents of `/work/dist/` are considered deployable. All images, CSS, JS, PDFs MUST be inside `/work/dist/assets/` (or referenced from there using prefix-safe paths).

---

### 2) Canonical Variables (Names Must Match Exactly)
These variables are the single source of truth and MUST be written into `/work/canon/vars.json` and reused by every later step without prompting.

- `project_slug` = `"the-key-coach-executive-functioning-reset"`
- `lead_magnet_primary_name` = `"Weekly Reset Worksheet"`
- `lead_magnet_subtitle` = `"A 30-minute workflow to track deadlines, reduce missing work, and lower homework conflict"`
- `lead_magnet_short_name` = `"Weekly Reset"`
- `pdf_filename_standard` = `"weekly-reset-worksheet-standard.pdf"`
- `pdf_filename_print` = `"weekly-reset-worksheet-print.pdf"`
- `s3_bucket_name` = `"cc360-pages"`
- `s3_region` = `"us-west-2"`
- `s3_prefix` = `"the-key-coach-executive-functioning-reset/20260119/"`
- `public_base_url` = `"https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/"`

**Determinism rule:** `s3_prefix` MUST always equal `project_slug + "/" + YYYYMMDD + "/"` using the workflow run date (here: `20260119`).

---

### 3) URL + Linking Rules
- All site URLs/paths are **relative to** `public_base_url`.
- In HTML/CSS, asset references MUST be **prefix-safe**:
  - ✅ `assets/hero-preview.png`
  - ❌ `/assets/hero-preview.png` (not allowed)
- **Legal pages in emails MUST be absolute URLs** (fully qualified using `public_base_url`).

---

### 4) Tooling Compatibility Notes (Non-Negotiable)
- Avoid unsupported image-generation parameters (example: do **not** pass a `"background"` keyword if unsupported by the active image tool).
- Any externally-returned tool URL (images, PDFs, etc.) MUST be **downloaded into local files** under `/work/build/` or `/work/dist/assets/` **before** further processing (no hotlinking in final outputs).

---

### 5) AWS Upload Assumptions (No Interaction)
- Assume AWS credentials/permissions are already available via environment variables or equivalent runtime auth.
- Upload preference order:
  1) Use **AWS CLI** if available.
  2) Otherwise use **boto3** from Python.
- Post-upload verification MUST be performed by fetching at least the landing HTML and one asset via `public_base_url` and confirming HTTP 200.

---

## Hard Acceptance Gates (Must Pass, No Placeholders)
1) **No placeholders in final outputs**
   - No `{{WEBINAR_REG_URL}}`, no dummy links, no “TBD”, no template tokens in `/work/dist/**`.

2) **Truthful previews**
   - Hero/pillar images must match the described scenes and **contain no readable text/logos/watermarks**.
   - Any “play button” overlay must be an actual baked-in pixel overlay in the final `hero-preview.png` (not implied).

3) **Dist bundle complete**
   - `/work/dist/landing-page.html` exists (or the contracted HTML filename).
   - `/work/dist/assets/` contains **all referenced assets** (images, CSS, JS, PDFs if applicable).
   - All asset links in HTML/CSS are prefix-safe (`assets/...`) and resolve locally.

4) **S3 upload verified**
   - All `/work/dist/**` files uploaded to `s3://cc360-pages/the-key-coach-executive-functioning-reset/20260119/`.
   - Verify at minimum:
     - `GET {public_base_url}landing-page.html` → 200
     - `GET {public_base_url}assets/hero-preview.png` → 200
   - If verification fails, the workflow MUST correct and re-upload automatically (no user interaction).