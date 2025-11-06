# Course Topic Dossier Generation Instructions

## Objective

Generate a concise, citation-backed dossier from public sources to help infer what course topic [full_name] is most likely to create. Use inputs: [full_name], [primary_website], [company_name], [linkedin_url], [twitter_url], [instagram_url], [youtube_url], [tiktok_url], [other_urls] (comma- or newline-separated), and optional [niche], [location]. Handle missing fields gracefully.

The system should produce both a structured JSON dossier and render it into a polished HTML report matching the template structure.

## Guardrails (MUST FOLLOW)

- Use only publicly available, non-sensitive information. Do not collect or infer sensitive personal data (e.g., home address, exact DOB, financials, health, race, religion, political views, sexual orientation, or anything obtained from breaches, private databases, or paywalled/logged-in areas).

- Include business contact info only if clearly published for that purpose. Prioritize professional over personal details. Respect robots.txt and site terms; set polite rate limits; no automated form submissions or circumventing controls.

- Focus on professional identity, owned businesses, published content, and public brand assets. When ambiguous, prefer omission or include a low confidence score.

## Inputs Normalization

- Trim/clean URLs; normalize to https; dedupe [other_urls].

- If [full_name] is missing but a social URL is present, extract name from the profile.

- Create an entity record with known aliases, brand names, and company names gleaned from bios.

## Entity Resolution

- Verify that each discovered profile or domain belongs to the same person via cross-signals: matching headshot, same company references, consistent bio, cross-links between profiles and [primary_website].

- Assign confidence (high/medium/low) for each linkage; exclude low-confidence items from final results unless no alternatives exist.

## Identity and Image URL

- Preferred image sources: official headshot on [primary_website] (About/Team/Press/Author pages), then verified LinkedIn/Twitter/Instagram profile image, then press/media kits. Avoid random images and third-party rehosts.

- Provide the single best headshot image_url (highest resolution accessible), source_page_url, resolution if known, and license/terms if indicated.

## Discover Official Social Profiles

- Use provided URLs first. If missing, search for official profiles combining [full_name] and [company_name]. Validate via cross-links to [primary_website] or consistent branding.

- Capture profile_url, handle, follower_count (if visible), and confidence.

## Owned/Operated Websites (Domains)

- Start with [primary_website] and [other_urls]. From bios/footers/link-in-bio/Linktree, collect additional official domains (brand site, product microsites, newsletters, courses, communities, app landing pages, Substack/Gumroad/Teachable/Thinkific pages if clearly official).

- Confirm ownership via on-site statements (About, footer copyright, "by [full_name]"), consistent brand identity, and cross-links from verified profiles. Avoid scraping WHOIS or private registrant data.

- For each domain: domain, homepage_title, brief_purpose, evidence_links, confidence.

## Sitemap Generation Per Owned Domain

- First attempt to fetch the site's own sitemap: https://domain/sitemap.xml (and any nested sitemaps). If accessible, list up to 50 most relevant page locs (exclude obvious duplicates, tag pages, and search results), and include the sitemap_url.

- If no sitemap exists or is inaccessible, perform a lightweight crawl from the homepage, respecting robots.txt, staying on-host, limiting to ~50 HTML pages max, breadth-first, skipping parameter-heavy URLs and infinite scroll endpoints. Extract title and lastmod if present in meta or headers.

- Produce a minimal XML string per domain (urlset with loc and, if known, lastmod). Include a crawl_method field: native_sitemap or generated.

## YouTube Top 5 Videos

- If [youtube_url] is provided, use that channel. Otherwise, search for the official channel matching [full_name]/[company_name] and cross-verify via links or branding.

- Select top 5 videos by lifetime views; if the channel is small or new, use the 5 most recent with non-trivial engagement. For each: title, url, publish_date (ISO), view_count (approximate if exact not shown), and 3-5 inferred topics.

## Business and Professional Overview (Public Info Only)

- Summarize roles, industries, companies founded/led, flagship offers/products, audiences served, notable media/features, and publicly stated location (city/country only if clearly published). Include education/credentials only if prominently public.

- Provide concise bullet points with citation URLs for each substantive claim.

## Topic Extraction and Course-Fit Inference

- From owned sites, blog posts, product pages, lead magnets, and YouTube topics, extract recurring themes and skills. Weight by recency, depth (long-form guides, workshops), and audience response (engagement, backlinks, testimonials where public).

- Propose up to 3 course hypotheses. For each include: working_title, ideal_audience, primary_outcome, prerequisites (if any), why_now angle, 5-module outline (module title + 1 sentence outcome), and proof_sources (links mapping to their content that demonstrates authority on the topic). Add a confidence score and 2-3 bullets explaining the rationale.

## Citations and Reproducibility

- After each section, maintain a citations array of source URLs. Prefer primary sources (official sites, official profiles, the actual video page).

## Output Format

### JSON Structure (Return as JSON in Final Research Step)

```json
{
  "person": {
    "full_name": "",
    "aliases": [],
    "image": {
      "image_url": "",
      "source_page_url": "",
      "resolution": "",
      "license": ""
    }
  },
  "profiles": [{
    "platform": "LinkedIn",
    "profile_url": "",
    "handle": "",
    "follower_count": null,
    "confidence": "high"
  }],
  "owned_domains": [{
    "domain": "example.com",
    "homepage_title": "",
    "brief_purpose": "",
    "evidence_links": [""],
    "confidence": "high",
    "sitemap": {
      "method": "native_sitemap|generated",
      "sitemap_url": "",
      "urls": [""],
      "generated_sitemap_xml": "<urlset>...</urlset>"
    }
  }],
  "youtube_top_videos": [{
    "title": "",
    "url": "",
    "publish_date": "",
    "view_count": 0,
    "topics": [""]
  }],
  "business_overview": {
    "summary": "",
    "companies": [{"name": "", "role": "", "site": ""}],
    "offers": [""],
    "audiences": [""],
    "notable_mentions": [{"outlet": "", "url": ""}]
  },
  "course_hypotheses": [{
    "working_title": "",
    "ideal_audience": "",
    "primary_outcome": "",
    "prerequisites": [""],
    "why_now": "",
    "outline": [{"module": 1, "title": "", "outcome": ""}],
    "proof_sources": [""],
    "confidence": "medium",
    "rationale": ["", ""]
  }],
  "citations": [""],
  "meta": {
    "inputs_used": {
      "full_name": "[full_name]",
      "primary_website": "[primary_website]",
      "company_name": "[company_name]",
      "linkedin_url": "[linkedin_url]",
      "twitter_url": "[twitter_url]",
      "instagram_url": "[instagram_url]",
      "youtube_url": "[youtube_url]",
      "tiktok_url": "[tiktok_url]",
      "other_urls": "[other_urls]",
      "niche": "[niche]",
      "location": "[location]"
    },
    "generated_at": "ISO-8601"
  }
}
```

### HTML Template Rendering

The JSON dossier must be rendered into the HTML template format. The template structure includes the following sections:

#### Header Section
- Sticky navigation bar with logo and brand name
- Navigation links: Overview, Business, Social & Content, Reviews, Creator, Company, Brand
- Download Report button (downloads text file and copies to clipboard)

#### Hero Section
- Profile header with:
  - Avatar (image or initials fallback)
  - Full name (h1)
  - Subtitle/role
  - Profile tags (expertise areas)
- KPI metrics tiles:
  - Websites Found
  - Pages Indexed
  - Social Profiles
  - Content Items
  - Reviews Found
  - Search Sources
- Notice banner: "Automated Search Complete" with description

#### Overview Section (#overview)
- Eyebrow: "What We Found"
- Heading: "Automatically Discovered Information"
- Two-column layout:
  - Left: Businesses Discovered card with list of companies/projects found
  - Each business item shows:
    - Icon
    - Company name (strong)
    - Description
    - Link to domain
    - Search badge with page count

#### Business Section (#business)
- Eyebrow: "Business Details"
- Heading: "Discovered Business Information"
- Two-column layout:
  - Left: Website Inventory card
    - Eyebrow: "Website Inventory"
    - Heading: "Domains & Sitemaps Found"
    - For each domain:
      - Domain link with page count pill
      - Favicon and OG image previews
      - Brief purpose description
      - Brand Colors section (color swatches with hex codes)
      - Fonts section (pill badges)
      - Logo URL section (image preview with fallback)
      - Category pills (SaaS Product, B2B, Education, etc.)
      - Toggle button to view sitemap.xml (expandable pre code block)
  - Right: Content Analysis card
    - Eyebrow: "Content Analysis"
    - Heading: "Topics & Themes Found"
    - List of topics with:
      - Topic name and mention count
      - Description
      - Progress bar indicating relative strength
    - Alert box with content quality assessment

#### Social & Content Section (#social-content)
- Eyebrow: "Social Media & Content"
- Heading: "YouTube Videos & Social Posts"
- Social Media & Profiles Found card:
  - Social grid with cards for each platform:
    - Platform icon/image
    - Platform name
    - Handle/link and follower count
    - Search badge indicating discovery method
  - Alert box with content activity summary
- YouTube Videos & Recent Posts:
  - Grid of video cards (responsive, min 300px):
    - Video thumbnail (with fallback gradient)
    - Video title (link)
    - View count and publish date
    - Search badge
    - Toggle buttons for Script and Transcript
    - Expandable sections for script (timestamped) and full transcript

#### Reviews Section (#online)
- Eyebrow: "Public Information"
- Heading: "Reviews & Public Mentions Found"
- Cards grid with review/testimonial cards:
  - Star rating (★★★★★)
  - Review title (strong)
  - Review text
  - Attribution
  - Search badge with source (G2, Capterra, Reddit, etc.)
- Alert box with search summary:
  - List of sources searched
  - Counts of reviews, websites, profiles, content found

#### Creator Section (#creator)
- Eyebrow: "CourseCreator360" (or platform name)
- Heading: "About the Creator"
- Card with two-column flex layout:
  - Left: Profile image (120x120px, rounded, with fallback)
  - Right: Creator information:
    - Logo image (80x80px, with fallback)
    - "My Story (Hero's Journey)" heading and narrative text
    - "Authority & Credibility" heading with list items:
      - Key Metrics
      - Experience & Education
      - Background Summary
    - Each list item has icon and description

#### Company Section (#company)
- Eyebrow: "CourseCreator360" (or platform name)
- Heading: "About the Company"
- Two-column layout:
  - Left: Company logo and details:
    - Company logo image (100x100px, with fallback)
    - List items:
      - Provider
      - Headquarters
      - Years Active
      - Focus
      - Track Record
      - Partnerships
  - Right: Program Details:
    - List items:
      - Role in Program
      - Platform
      - Site
      - Products
      - Version
      - Notice

#### Brand Section (#brand)
- Eyebrow: "CourseCreator360" (or platform name)
- Heading: "Brand Style Guide"
- Brand logo image (120x120px, with fallback)
- Two-column layout:
  - Left: Color Palette card:
    - Grid of color swatches (2x2):
      - Color block (60px height)
      - Color name
      - Hex code and role (Primary, Accent, Background, Text)
  - Right: Typography card:
    - List items:
      - Headings Font (with sample)
      - Body Font (with sample)
      - Alternate Styles
- Two-column layout (second row):
  - Left: Voice & Tone card:
    - Voice Attributes
    - Tone Examples
  - Right: Visual Style card:
    - Style Guidelines
    - Layout Rules
    - Image Treatment
- Logo Guidelines card:
  - Two-column layout:
    - Left:
      - Logo Variations
      - Usage Rules
    - Right:
      - Minimum Size / Clear Space
      - Incorrect Usage Notes
- Alert box with system note (version, update date, deployment notes)

#### Footer
- Border top separator
- Centered text:
  - "Automated Background Search Report"
  - "Information gathered from public sources • Generated automatically"
  - Report ID and search completion time

### HTML Template Features

- **Dark Mode Design**: Uses CSS variables for theming:
  - Background: `#0b1020` with gradient overlays
  - Surface colors: `#121733`, `#151b3b`, `#0f1530`
  - Text: `#e8ecff` (primary), `#9aa4d6` (muted)
  - Primary: `#4656F6`, Accent: `#12B4B5`
  - Border: `rgba(255,255,255,0.12)`

- **Responsive Grid Layouts**: 
  - Cards grid: `repeat(auto-fit, minmax(300px, 1fr))`
  - Two-column: `1fr 1fr` (collapses to single column on mobile)
  - Three-column: `repeat(3,1fr)` (collapses to 2 then 1 on smaller screens)

- **Expandable Sections**: 
  - Toggle buttons for sitemaps, video scripts, transcripts
  - JavaScript handles show/hide with text updates
  - Hidden sections use `.hidden` class

- **Download Functionality**: 
  - Button triggers text extraction from DOM
  - Formats as structured text file
  - Copies to clipboard
  - Downloads as `.txt` file with timestamp

- **Smooth Scroll Navigation**: 
  - Anchor links scroll smoothly to sections
  - Sticky header remains visible

- **Search Badges**: 
  - Small badges indicating discovery method
  - Styled with accent color background
  - Examples: "Found via search", "Found via YouTube API", "Found on G2"

- **Progress Bars**: 
  - Visual indicators for content theme strength
  - Gradient fill from accent color

- **Social Media Cards**: 
  - Platform icons with fallback SVG
  - Platform name, handle, follower count
  - Search badge

- **Brand Elements**: 
  - Color swatches with hex codes
  - Typography samples
  - Logo previews with fallback handling

- **Image Fallbacks**: 
  - All images have `onerror` handlers
  - Fallback to gradient backgrounds or placeholder text
  - Graceful degradation

### HTML Template CSS Variables

```css
:root {
  --bg: #0b1020;
  --surface: #121733;
  --surface-2: #151b3b;
  --card: #0f1530;
  --text: #e8ecff;
  --muted: #9aa4d6;
  --primary: #4656F6;
  --primary-600: #3546f2;
  --accent: #12B4B5;
  --warning: #F59E0B;
  --success: #12B4B5;
  --danger: #F43F5E;
  --border: rgba(255,255,255,0.12);
  --shadow: 0 10px 30px rgba(0,0,0,.35);
  --radius: 14px;
  --radius-sm: 10px;
  --radius-lg: 22px;
  --grad-1: radial-gradient(1200px 600px at 20% -10%, #3e44ff22, transparent 60%),
            radial-gradient(900px 500px at 90% 10%, #0ad5b433, transparent 60%),
            linear-gradient(180deg, #0b1020, #0b1020);
}
```

### JavaScript Functionality

The template includes JavaScript for:

1. **Toggle Functionality**: Expandable sections for sitemaps, scripts, transcripts
   - Updates button text based on state
   - Toggles `.hidden` class

2. **Smooth Scroll**: Anchor link navigation
   - Prevents default behavior
   - Smooth scrolls to target section

3. **Download Report**: 
   - Extracts all text content from sections
   - Formats with headers and separators
   - Creates structured text file
   - Copies to clipboard
   - Triggers download with timestamped filename

## Quality Checks Before Finalizing

- Remove low-confidence or ambiguous items; clearly label confidence elsewhere.

- Ensure all URLs resolve (or mark as possibly inactive). Avoid dead social duplicates.

- Keep the report succinct and action-oriented for course ideation. If evidence is thin, state limitations and reduce confidence accordingly.

- Validate JSON structure matches schema exactly.

- Ensure HTML renders correctly with all data populated from JSON.

- Test download functionality works correctly.

- Verify all citations are valid URLs.

- Check that all images have proper fallback handling.

- Ensure responsive design works on mobile, tablet, and desktop.

- Validate that all expandable sections toggle correctly.

- Confirm search badges accurately reflect discovery methods.

## Implementation Notes

- The JSON generation should happen first (data collection phase). This is the research and data gathering step that produces the structured dossier.

- HTML rendering should be a separate step that consumes the JSON. This transforms the structured data into the visual report format.

- Both outputs should be stored/returned for different use cases:
  - JSON for programmatic access and further processing
  - HTML for human-readable presentation and sharing

- The HTML template uses CSS variables for theming (can be customized per deployment).

- All images should have fallback handling for missing assets (onerror handlers, placeholder gradients, or text fallbacks).

- JavaScript functionality for toggles and downloads should be included in the template.

- The template should be self-contained (all CSS inline or in `<style>` tag, all JS inline or in `<script>` tag) for easy deployment.

- When rendering HTML from JSON:
  - Map `person.full_name` to hero section h1
  - Map `person.image.image_url` to avatar
  - Map `profiles` array to social grid
  - Map `owned_domains` array to website inventory
  - Map `youtube_top_videos` array to video cards
  - Map `business_overview` to business and company sections
  - Map `course_hypotheses` to course recommendations (can be added as new section)
  - Map `citations` to footer or citations section
  - Calculate KPI metrics from data (count domains, pages, profiles, etc.)

- Brand colors, fonts, and logo should be extracted from owned domains during the research phase and included in the JSON for rendering in the Brand section.

- Video scripts and transcripts should be fetched/extracted during research phase if available, or marked as unavailable in the JSON.

- Reviews and public mentions should be gathered from public review sites, forums, and social media during research phase.

## Data Flow

1. **Input Collection**: Receive inputs (full_name, URLs, etc.)

2. **Normalization**: Clean and normalize all inputs

3. **Research Phase**: 
   - Discover profiles and domains
   - Verify entity resolution
   - Extract images, bios, content
   - Generate sitemaps
   - Fetch YouTube videos
   - Gather business information
   - Extract topics and themes
   - Generate course hypotheses
   - Collect citations

4. **JSON Generation**: Structure all discovered data into JSON format

5. **Quality Checks**: Validate data, remove low-confidence items, verify URLs

6. **HTML Rendering**: Transform JSON into HTML template

7. **Final Validation**: Test HTML rendering, download functionality, responsive design

8. **Output**: Return both JSON and HTML for storage/delivery

