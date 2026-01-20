```json
{
  "meta": {
    "schema_name": "cc360_canon",
    "schema_version": "1.0",
    "generated_at_iso": "2026-01-19T00:00:00Z",
    "runtime_date_yyyymmdd": "20260119",
    "single_source_of_truth_path": "/work/canon/canon.json"
  },
  "naming": {
    "project_slug": "the-key-coach-executive-functioning-reset",
    "lead_magnet_primary_name": "Weekly Reset Worksheet",
    "subtitle": "A 30-minute workflow to track deadlines, reduce missing work, and lower homework conflict",
    "short_name": "Weekly Reset"
  },
  "file_naming": {
    "pdf_filename_standard": "the-key-coach-executive-functioning-reset_v1.pdf",
    "pdf_filename_print": "the-key-coach-executive-functioning-reset_v1_print.pdf",
    "rules": {
      "pdf_filename_standard_rule": "pdf_filename_standard must equal project_slug + '_v1.pdf'",
      "pdf_filename_print_rule": "pdf_filename_print must equal project_slug + '_v1_print.pdf'"
    }
  },
  "dist": {
    "dist_index_html": "index.html",
    "dist_thankyou_html": "thank-you.html",
    "dist_privacy_html": "privacy.html",
    "dist_terms_html": "terms.html",
    "dist_assets_dir": "assets/",
    "rules": {
      "deployable_root_rule": "Only files under /work/dist/ are deployable",
      "asset_path_rule": "All referenced assets (images, CSS, JS, PDFs) must live under /work/dist/assets/ and be referenced as 'assets/...' (no leading slash)"
    }
  },
  "utm": {
    "keys": [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "referrer",
      "landing_page"
    ],
    "persistence_days": 7,
    "storage_key": "the-key-coach-executive-functioning-reset_attr_v1",
    "rules": {
      "storage_key_rule": "storage_key must equal project_slug + '_attr_v1'"
    }
  },
  "s3": {
    "s3_bucket_name": "cc360-pages",
    "s3_region": "us-west-2",
    "s3_prefix": "the-key-coach-executive-functioning-reset/20260119/",
    "public_base_url": "https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/",
    "rules": {
      "s3_prefix_rule": "s3_prefix must equal project_slug + '/' + runtime_date_yyyymmdd + '/'",
      "public_base_url_rule_primary": "If environment variable CC360_PAGES_BASE_URL is set, public_base_url = CC360_PAGES_BASE_URL + '/' + s3_prefix",
      "public_base_url_rule_fallback": "Otherwise public_base_url = 'https://cc360-pages.s3.us-west-2.amazonaws.com/' + s3_prefix"
    }
  },
  "urls": {
    "url_landing": "https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/index.html",
    "url_thankyou": "https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/thank-you.html",
    "url_privacy": "https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/privacy.html",
    "url_terms": "https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/terms.html"
  },
  "string_invariants": [
    "the-key-coach-executive-functioning-reset",
    "Weekly Reset Worksheet",
    "A 30-minute workflow to track deadlines, reduce missing work, and lower homework conflict",
    "Weekly Reset",
    "the-key-coach-executive-functioning-reset_v1.pdf",
    "the-key-coach-executive-functioning-reset_v1_print.pdf",
    "cc360-pages",
    "us-west-2",
    "the-key-coach-executive-functioning-reset/20260119/",
    "https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/",
    "https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/index.html",
    "https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/thank-you.html",
    "https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/privacy.html",
    "https://cc360-pages.s3.us-west-2.amazonaws.com/the-key-coach-executive-functioning-reset/20260119/terms.html",
    "the-key-coach-executive-functioning-reset_attr_v1",
    "index.html",
    "thank-you.html",
    "privacy.html",
    "terms.html",
    "assets/"
  ]
}
```

### How later steps must consume this (read-only)
- Treat `/work/canon/canon.json` as the **only** authoritative registry for names, filenames, dist bundle contract, attribution persistence, and deployment URLs.
- All generators/build steps must **read** (not rewrite) this file to:
  - Name the PDFs exactly as `file_naming.pdf_filename_standard` and `file_naming.pdf_filename_print`.
  - Create the dist HTML files exactly as listed in `dist.*_html`.
  - Reference assets with prefix-safe paths using `dist.dist_assets_dir` (i.e., `assets/...`).
  - Persist/restore attribution using `utm.storage_key` and `utm.persistence_days`.
  - Build absolute legal links in emails from `urls.url_privacy` and `urls.url_terms`.
  - Deploy to S3 using `s3.s3_bucket_name`, `s3.s3_region`, and `s3.s3_prefix`, and verify public access using `urls.url_landing` and at least one `assets/...` URL under `s3.public_base_url`.
- Any string listed in `string_invariants` must be copied **verbatim** wherever it appears across PDFs, pages, and emails (no punctuation/spacing/case changes).