# CC360 Executable Build Spec (End-to-End, No-Interaction)
Project: **the-key-coach-executive-functioning-reset**  
Runtime date: **20260119**  
Canonical registry (read-only): **/work/canon/canon.json**  
Deploy target: **s3://cc360-pages/the-key-coach-executive-functioning-reset/20260119/** (region **us-west-2**)  
Public base URL: **https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/**

This spec is written so later steps can execute it without interpretation and without pausing for user input.

---

## 0) Hard Locks (Non-Negotiable)

### 0.1 Canonical strings and filenames (must match verbatim)
All generators must read `/work/canon/canon.json` and must not rewrite it.

**Project slug (verbatim):**  
- `the-key-coach-executive-functioning-reset`

**Lead magnet name (verbatim):**  
- `Weekly Reset Worksheet`

**Subtitle (verbatim):**  
- `A 30-minute workflow to track deadlines, reduce missing work, and lower homework conflict`

**Short name (verbatim):**  
- `Weekly Reset`

**PDF filenames (exact):**
- Standard: `the-key-coach-executive-functioning-reset_v1.pdf`
- Print: `the-key-coach-executive-functioning-reset_v1_print.pdf`

**Dist HTML filenames (exact):**
- `index.html`
- `thank-you.html`
- `privacy.html`
- `terms.html`

**Assets directory rule (exact):**
- All referenced assets (images, CSS, JS, PDFs) must live under `/work/dist/assets/`
- In HTML/CSS/JS, assets must be referenced as `assets/...` (no leading slash)

### 0.2 PDF page count + format (locked)
Two PDFs must be generated, both with these properties:

**Standard PDF**
- File path: `/work/dist/assets/pdf/the-key-coach-executive-functioning-reset_v1.pdf`
- Page count: **8 pages exactly**
- Page size: **US Letter (8.5 in × 11 in)**
- Orientation: **Portrait**
- Margins: **0.5 in** on all sides (content safe area)
- Export intent: screen-friendly (color allowed)

**Print PDF**
- File path: `/work/dist/assets/pdf/the-key-coach-executive-functioning-reset_v1_print.pdf`
- Page count: **8 pages exactly**
- Page size: **US Letter (8.5 in × 11 in)**
- Orientation: **Portrait**
- Margins: **0.5 in**
- Export intent: print-friendly (single-ink look; no full-bleed backgrounds)

If either PDF is not exactly 8 pages, the build fails.

### 0.3 Required preview pages to export (locked)
These preview renders must be produced **from the generated standard PDF** (not from source layout files):

Render the following pages to PNG at **1600 px width** (keep aspect ratio), RGB, 8-bit:

1. Page 1
2. Page 3
3. Page 6

Exact output paths:
- `/work/dist/assets/img/previews/the-key-coach-executive-functioning-reset_p01_1600w.png`
- `/work/dist/assets/img/previews/the-key-coach-executive-functioning-reset_p03_1600w.png`
- `/work/dist/assets/img/previews/the-key-coach-executive-functioning-reset_p06_1600w.png`

Also produce smaller 800 px width versions for performance:
- `/work/dist/assets/img/previews/the-key-coach-executive-functioning-reset_p01_800w.png`
- `/work/dist/assets/img/previews/the-key-coach-executive-functioning-reset_p03_800w.png`
- `/work/dist/assets/img/previews/the-key-coach-executive-functioning-reset_p06_800w.png`

### 0.4 Required mobile crops to export (locked)
All crops must be derived from the **1600w preview PNGs generated from the PDF**.

Each crop must output **1080 × 1350** PNG.

Crop definitions use normalized coordinates relative to the source preview image:
- `x` and `y` are top-left origin fractions (0.0–1.0)
- `w` and `h` are width/height fractions (0.0–1.0)
- After cropping, resize to 1080×1350

Required crops:

**Crop A (cover hero)**
- Source: `..._p01_1600w.png`
- Crop box: `x=0.08, y=0.10, w=0.84, h=0.70`
- Output: `/work/dist/assets/img/crops/weekly-reset_cover-hero_1080x1350.png`

**Crop B (worksheet detail)**
- Source: `..._p03_1600w.png`
- Crop box: `x=0.08, y=0.18, w=0.84, h=0.68`
- Output: `/work/dist/assets/img/crops/weekly-reset_worksheet-detail_1080x1350.png`

**Crop C (time blocks detail)**
- Source: `..._p06_1600w.png`
- Crop box: `x=0.08, y=0.18, w=0.84, h=0.68`
- Output: `/work/dist/assets/img/crops/weekly-reset_time-blocks-detail_1080x1350.png`

### 0.5 Required parallax backgrounds + CSS hooks (locked)
Parallax backgrounds must be derived from the PDF (from preview render page 1).

Create two JPG backgrounds (2400×1600) derived from the PDF page 1 preview:
- Start from `/work/dist/assets/img/previews/the-key-coach-executive-functioning-reset_p01_1600w.png`
- Upscale/canvas to 2400×1600 (cover) and apply gaussian blur radius 24
- Apply a dark overlay equivalent to rgba(10, 18, 32, 0.55)
- Save as JPG quality 82

Outputs:
- `/work/dist/assets/img/bg/parallax-hero_2400x1600.jpg`
- `/work/dist/assets/img/bg/parallax-section_2400x1600.jpg`

CSS requirement (must exist exactly in site CSS):
- Class `.cc360-parallax` implements background parallax on desktop widths
- Modifier classes:
  - `.cc360-parallax.hero` uses `assets/img/bg/parallax-hero_2400x1600.jpg`
  - `.cc360-parallax.section` uses `assets/img/bg/parallax-section_2400x1600.jpg`

Behavior lock:
- On screens wider than 900 px: `background-attachment: fixed`
- On screens 900 px and below: `background-attachment: scroll` (mobile performance)

### 0.6 Required device mockups (locked; must embed real crops/previews)
Mockups must embed the actual exported crops/previews (not re-created artwork).

Create three PNG mockups:

1) **Phone mockup (square)**
- Output: `/work/dist/assets/img/mockups/weekly-reset_mockup-phone_1400x1400.png`
- Must embed: `/work/dist/assets/img/crops/weekly-reset_worksheet-detail_1080x1350.png`

2) **Tablet mockup (landscape)**
- Output: `/work/dist/assets/img/mockups/weekly-reset_mockup-tablet_1600x1200.png`
- Must embed: `/work/dist/assets/img/previews/the-key-coach-executive-functioning-reset_p01_1600w.png`

3) **Duo mockup hero image**
- Output: `/work/dist/assets/img/mockups/weekly-reset_mockup-duo_1920x1080.png`
- Must embed: both phone mockup and tablet mockup above (composited)

Mockup style lock (to avoid dependency on external device frames):
- Use a simple vector frame (rounded rectangle device silhouette) generated locally
- Screen area must clip the embedded crop/preview
- Add subtle shadow (blur radius 18, opacity 0.25)
- No third-party branded hardware frames

### 0.7 Funnel pages + emails + UTM capture behavior (locked)
**Funnel pages (exact):**
- Landing: `/work/dist/index.html`
- Thank-you: `/work/dist/thank-you.html`
- Privacy: `/work/dist/privacy.html`
- Terms: `/work/dist/terms.html`

**Email deliverables (must exist locally):**
- `/work/dist/emails/weekly-reset_delivery.html`
- `/work/dist/emails/weekly-reset_delivery.txt`
- `/work/dist/emails/weekly-reset_nurture-1.html`
- `/work/dist/emails/weekly-reset_nurture-1.txt`
- `/work/dist/emails/weekly-reset_nurture-2.html`
- `/work/dist/emails/weekly-reset_nurture-2.txt`

**UTM schema (exact keys):**
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `referrer`
- `landing_page`

**Attribution persistence lock:**
- Persistence: **7 days**
- Storage key (exact): `the-key-coach-executive-functioning-reset_attr_v1`

**Capture behavior lock (must be implemented in JS):**
- On every page load (landing + thank-you at minimum):
  1. Parse query params for all UTM keys listed above.
  2. Record `referrer` as `document.referrer` when not already stored.
  3. Record `landing_page` as the full current page URL (without hash).
  4. Store object in `localStorage` under `the-key-coach-executive-functioning-reset_attr_v1` with:
     - `data` (the key/value pairs)
     - `stored_at_ms` (Date.now)
     - `expires_at_ms` (stored_at_ms + 7 days in ms)
  5. If storage exists but is expired, delete and replace.

**Form behavior lock (no backend assumed):**
- Landing page includes an email input form.
- On submit:
  - Prevent default
  - Store `lead_email` in localStorage under key `the-key-coach-executive-functioning-reset_lead_email_v1`
  - Redirect to `thank-you.html` and append all stored attribution keys (URL-encoded) as query params.

### 0.8 Legal requirements (hard)
Applies to PDF, pages, and emails:

- **No medical claims**: do not claim diagnosis, treatment, cure, or prevention of any medical condition.
- **No guarantees**: do not promise outcomes (“will”, “guaranteed”, “always” in outcome context).
- **Emails must contain absolute legal links** exactly pointing to:
  - Privacy: `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/privacy.html`
  - Terms: `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/terms.html`

---

## 1) Required Output Tree (All Deliverables Must Exist Under /work/dist)

Create this exact structure (additional files allowed, but these must exist):

```
/work/dist/
  index.html
  thank-you.html
  privacy.html
  terms.html
  emails/
    weekly-reset_delivery.html
    weekly-reset_delivery.txt
    weekly-reset_nurture-1.html
    weekly-reset_nurture-1.txt
    weekly-reset_nurture-2.html
    weekly-reset_nurture-2.txt
  assets/
    css/
      site.css
    js/
      site.js
    pdf/
      the-key-coach-executive-functioning-reset_v1.pdf
      the-key-coach-executive-functioning-reset_v1_print.pdf
    img/
      og-image_1200x630.jpg
      previews/
        the-key-coach-executive-functioning-reset_p01_1600w.png
        the-key-coach-executive-functioning-reset_p03_1600w.png
        the-key-coach-executive-functioning-reset_p06_1600w.png
        the-key-coach-executive-functioning-reset_p01_800w.png
        the-key-coach-executive-functioning-reset_p03_800w.png
        the-key-coach-executive-functioning-reset_p06_800w.png
      crops/
        weekly-reset_cover-hero_1080x1350.png
        weekly-reset_worksheet-detail_1080x1350.png
        weekly-reset_time-blocks-detail_1080x1350.png
      bg/
        parallax-hero_2400x1600.jpg
        parallax-section_2400x1600.jpg
      mockups/
        weekly-reset_mockup-phone_1400x1400.png
        weekly-reset_mockup-tablet_1600x1200.png
        weekly-reset_mockup-duo_1920x1080.png
  build.json
```

`build.json` is required and must include SHA256 hashes for every file under `/work/dist` plus derived metadata (details in section 6).

---

## 2) PDF Content Spec (8 Pages, Locked Headings)
The PDF must be the “Weekly Reset Worksheet” and must include the locked subtitle somewhere on page 1.

### Page-by-page structure (must be present; wording may vary but headings must match exactly)
Headings below must appear exactly as written (case and spelling):

**Page 1**
- Title: `Weekly Reset Worksheet`
- Subtitle: `A 30-minute workflow to track deadlines, reduce missing work, and lower homework conflict`
- Small note (non-medical): “Educational planning tool. Not medical or psychological advice.”

**Page 2**
- Heading: `How to Use the Weekly Reset (30 Minutes)`
- Include a simple 3-step checklist with time estimates.

**Page 3**
- Heading: `This Week at a Glance`
- Provide a weekly overview grid (Mon–Sun or Mon–Fri + weekend).

**Page 4**
- Heading: `Assignments and Due Dates`
- Table with columns: Class/Subject, Task, Due Date, Status, Notes.

**Page 5**
- Heading: `Materials and Missing Work`
- Checklist-style layout.

**Page 6**
- Heading: `Time Blocks (Plan the Week)`
- Time-block grid for at least 5 days.

**Page 7**
- Heading: `Quick Reflection`
- Prompts: What worked, What was hard, What to adjust.

**Page 8**
- Heading: `Reset Script (Keep Conflict Lower)`
- Provide neutral language prompts (no guarantees).

### Typography lock (implementation-level constraint)
- Use only locally available fonts or fonts bundled with the build.
- No externally hosted font URLs in dist HTML/CSS (avoid runtime fetch).
- PDF must embed fonts (verify by running `pdffonts` if available; otherwise accept as best-effort but do not use webfont links in PDF generation).

---

## 3) Landing Page + Thank-You Page Requirements (Copy + Structure)
All asset references must be relative `assets/...`.

### 3.1 `index.html` (landing)
Must include:
- H1: `Weekly Reset Worksheet`
- Subtitle text verbatim.
- Primary CTA button text: `Get the Weekly Reset`
- Email form:
  - input type=email, name=`email`, required
  - submit button text: `Send It to Me`
- “Instant download” secondary link pointing to `thank-you.html` (still goes through UTM capture; JS must append params)
- Preview section showing the three preview images (800w versions)
- Mockup hero image: `assets/img/mockups/weekly-reset_mockup-duo_1920x1080.png`
- Footer links to `privacy.html` and `terms.html`

### 3.2 `thank-you.html`
Must include:
- H1: `Your Weekly Reset is Ready`
- Primary download button linking to:
  - `assets/pdf/the-key-coach-executive-functioning-reset_v1.pdf`
- Secondary link to print version:
  - `assets/pdf/the-key-coach-executive-functioning-reset_v1_print.pdf`
- Show captured email if present (read from localStorage key `the-key-coach-executive-functioning-reset_lead_email_v1`), but do not display it if missing.
- Footer links to `privacy.html` and `terms.html`

### 3.3 `privacy.html` and `terms.html`
Must be plain, readable, and include:
- Project name and slug somewhere (slug can be in a small footer note)
- Last updated date: `2026-01-19`
- No medical claims and no guarantees
- Footer links to both legal pages (self + other)

---

## 4) JavaScript + CSS Implementation Locks

### 4.1 `/work/dist/assets/js/site.js` (required functions)
Must implement the following behaviors:

1) **Attribution capture**
- Storage key: `the-key-coach-executive-functioning-reset_attr_v1`
- Expiry: 7 days
- Keys captured: exactly the UTM keys list in section 0.7
- Must populate missing `referrer` and `landing_page`

2) **Form submit handler**
- Store email under key: `the-key-coach-executive-functioning-reset_lead_email_v1`
- Redirect to `thank-you.html` with attribution query params

3) **Append attribution to internal links**
- Any link with `data-cc360-append-attribution="1"` must have current attribution appended as query parameters when clicked.

### 4.2 `/work/dist/assets/css/site.css` (required classes)
Must include:
- `.cc360-parallax`
- `.cc360-parallax.hero` with background image `assets/img/bg/parallax-hero_2400x1600.jpg`
- `.cc360-parallax.section` with background image `assets/img/bg/parallax-section_2400x1600.jpg`

Also must include:
- Mobile-first responsive rules
- Respect `prefers-reduced-motion` by disabling parallax fixed attachment

---

## 5) OG Image (Locked)
Create:
- `/work/dist/assets/img/og-image_1200x630.jpg`

Derivation rules (truthfulness lock):
- Must be derived from `weekly-reset_cover-hero_1080x1350.png` by center-cropping to 1200×630 and adding only minimal padding/background if needed.
- No new illustrations or unrelated stock imagery.

---

## 6) Build Manifest (`/work/dist/build.json`) (Locked Schema)
A JSON file must be created at `/work/dist/build.json` with:

- `project_slug`: `the-key-coach-executive-functioning-reset`
- `runtime_date_yyyymmdd`: `20260119`
- `generated_at_iso`: ISO-8601 timestamp at build time
- `canon_path`: `/work/canon/canon.json`
- `dist_root`: `/work/dist`
- `pdf` object:
  - `standard_path`: `assets/pdf/the-key-coach-executive-functioning-reset_v1.pdf`
  - `print_path`: `assets/pdf/the-key-coach-executive-functioning-reset_v1_print.pdf`
  - `standard_sha256`
  - `print_sha256`
  - `page_count_standard`: 8
  - `page_count_print`: 8
- `files` array: one entry per file under `/work/dist`:
  - `path` (relative to `/work/dist`)
  - `bytes`
  - `sha256`
- `s3` object:
  - `bucket`: `cc360-pages`
  - `region`: `us-west-2`
  - `prefix`: `the-key-coach-executive-functioning-reset/20260119/`
  - `public_base_url`: `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/`

No nulls, no missing keys.

---

## 7) S3 Publish Requirements (Hard)
Publishing must occur only after all files exist under `/work/dist`.

### 7.1 Upload target (locked)
- Bucket: `cc360-pages`
- Region: `us-west-2`
- Prefix: `the-key-coach-executive-functioning-reset/20260119/`

### 7.2 Upload rules
- Upload every file under `/work/dist` to:
  - `s3://cc360-pages/the-key-coach-executive-functioning-reset/20260119/`
- Keys must preserve relative paths (example: `/work/dist/assets/js/site.js` → `assets/js/site.js` under the prefix).
- Set content types correctly at upload time:
  - `.html` → `text/html; charset=utf-8`
  - `.css` → `text/css; charset=utf-8`
  - `.js` → `application/javascript; charset=utf-8`
  - `.png` → `image/png`
  - `.jpg` → `image/jpeg`
  - `.pdf` → `application/pdf`
  - `.json` → `application/json; charset=utf-8`
  - `.txt` → `text/plain; charset=utf-8`
- Cache-Control:
  - HTML: `no-store`
  - All under `assets/` and `build.json`: `public, max-age=31536000, immutable`

### 7.3 Post-upload verification (hard gate)
After upload, verification must HEAD every required object (at minimum, this set):

- `index.html`
- `thank-you.html`
- `privacy.html`
- `terms.html`
- `build.json`
- `assets/css/site.css`
- `assets/js/site.js`
- `assets/pdf/the-key-coach-executive-functioning-reset_v1.pdf`
- `assets/pdf/the-key-coach-executive-functioning-reset_v1_print.pdf`
- `assets/img/og-image_1200x630.jpg`
- `assets/img/bg/parallax-hero_2400x1600.jpg`
- `assets/img/bg/parallax-section_2400x1600.jpg`
- `assets/img/mockups/weekly-reset_mockup-duo_1920x1080.png`
- `assets/img/previews/the-key-coach-executive-functioning-reset_p01_800w.png`

Verification must use `aws s3api head-object` (not a browser check) and must fail the build if any HEAD fails.

---

## 8) Programmatic QA Checklist (Hard Gates)
Later QA must be able to evaluate these checks mechanically. All must pass.

### 8.1 Canon registry integrity
- File exists: `/work/canon/canon.json`
- JSON parses
- Values match exactly:
  - `naming.project_slug` equals `the-key-coach-executive-functioning-reset`
  - `file_naming.pdf_filename_standard` equals `the-key-coach-executive-functioning-reset_v1.pdf`
  - `file_naming.pdf_filename_print` equals `the-key-coach-executive-functioning-reset_v1_print.pdf`
  - `utm.storage_key` equals `the-key-coach-executive-functioning-reset_attr_v1`
  - `s3.s3_bucket_name` equals `cc360-pages`
  - `s3.s3_region` equals `us-west-2`
  - `s3.s3_prefix` equals `the-key-coach-executive-functioning-reset/20260119/`
  - `urls.url_landing` equals `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/index.html`
  - `urls.url_privacy` equals `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/privacy.html`
  - `urls.url_terms` equals `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/terms.html`

### 8.2 Dist bundle completeness
All required files listed in section 1 exist under `/work/dist` and are non-empty (bytes > 0).

### 8.3 No placeholders anywhere (hard)
Across all files under `/work/dist` (including emails), a recursive scan must find none of:
- The substring `{{`
- The substring `}}`
- The substring `TODO`
- The substring `[[`
- The substring `]]`

Build fails if any found.

### 8.4 Asset path rule (hard)
In every `.html`, `.css`, `.js` under `/work/dist`:
- No occurrences of `src="/assets/` or `href="/assets/` or `url(/assets/`
- All asset references that point to local files begin with `assets/`

### 8.5 PDF locks (hard)
- Both PDF files exist at the exact required paths.
- Filenames match canon exactly.
- Page count is exactly 8 for both.
- Page size is Letter portrait for both (must be validated via a PDF inspection tool in the build).

### 8.6 Preview + crop truthfulness (hard)
- Preview PNGs exist exactly as specified.
- Crops exist exactly as specified.
- Mockups exist exactly as specified.
- QA must validate that preview PNGs were generated from the standard PDF by re-rendering the same pages and comparing SHA256 hashes of the resulting preview files. The build process must therefore generate previews only by rendering the PDF (not by rendering source HTML directly).

### 8.7 Email legal links absolute (hard)
In every email file under `/work/dist/emails`:
- Must contain the exact privacy URL:
  - `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/privacy.html`
- Must contain the exact terms URL:
  - `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/terms.html`

### 8.8 No medical claims / no guarantees (hard, automated heuristic + manual spot)
Automated heuristic must flag and fail if any of these substrings appear anywhere in `/work/dist`:
- `cure`
- `treat`
- `guarantee`
- `guaranteed`
- `will eliminate`
- `will fix`
- `medical advice`

Manual spot check still required by QA, but automated failure is mandatory if any appear.

### 8.9 S3 upload + HEAD verification (hard)
- Upload performed to exactly:
  - `s3://cc360-pages/the-key-coach-executive-functioning-reset/20260119/`
- Region used: `us-west-2`
- HEAD verification done for the minimum required object list in section 7.3 and all succeeded.

---

## 9) Build Execution Outline (Deterministic, No Prompts)
This is the required order of operations:

1. Read and validate `/work/canon/canon.json` against the locked values in section 8.1. Fail fast if mismatch.
2. Generate the 8-page standard PDF at `/work/dist/assets/pdf/the-key-coach-executive-functioning-reset_v1.pdf`.
3. Generate the 8-page print PDF at `/work/dist/assets/pdf/the-key-coach-executive-functioning-reset_v1_print.pdf`.
4. Validate both PDFs page count and page size.
5. Render preview pages (1, 3, 6) from the standard PDF into the required PNGs (1600w and 800w).
6. Generate mobile crops from the 1600w previews into the required 1080×1350 PNGs.
7. Generate parallax backgrounds from page 1 preview into the required JPGs.
8. Generate mockups embedding the exported crops/previews into the required PNGs.
9. Generate OG image from the cover hero crop into the required JPG.
10. Generate `index.html`, `thank-you.html`, `privacy.html`, `terms.html` with correct relative asset references.
11. Generate `assets/css/site.css` and `assets/js/site.js` implementing locked behaviors.
12. Generate all email files with absolute legal links.
13. Generate `/work/dist/build.json` with SHA256 hashes for every dist file.
14. Run all QA gates in section 8 locally. If any fail, stop.
15. Upload `/work/dist` to S3 prefix.
16. Run S3 HEAD verification (section 7.3). If any fail, stop.

---

## 10) Deployment URLs (Locked Outputs)
After successful upload, these must be reachable (and must match canon exactly):

- Landing page:  
  `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/index.html`

- Thank-you page:  
  `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/thank-you.html`

- Privacy page:  
  `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/privacy.html`

- Terms page:  
  `https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/terms.html`

---

## 11) Notes on Interpretation (None Allowed)
Where this spec says “must”, later steps must implement exactly.  
Where a tool choice is not specified, later steps must still satisfy the outputs and QA gates exactly, but must not change any locked filenames, paths, page counts, crop geometry, or URLs described above.

This concludes the single-source executable build spec and QA checklist.