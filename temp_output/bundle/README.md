# Course Creator 360 - Loom to SOP Kit

## Overview
This kit contains a complete, systemized Standard Operating Procedure (SOP) generated from your Loom video. It is designed to help you teach, delegate, or sell your process immediately.

## Bundle Map
- **notion/**: Ready-to-paste Notion template (`SOP_NOTION_TEMPLATE.md`).
- **sop/**: Raw structured data of the SOP (`sop_model.json`).
- **diagrams/**: 
  - `rendered/`: Visual flowcharts and swimlane diagrams.
  - `specs/`: Source definitions for the diagrams.
- **infographic/**: One-page visual summary (`SOP_ONE_PAGER.png`).
- **transcripts/**: Cleaned transcripts from the original video.
- **scripts/**: Python scripts used for generation and packaging.
- **qa/**: Quality Assurance checklist.
- **meta/**: Manifest and checksums for integrity verification.

## Quick Start (Notion)
1. Open the `notion/SOP_NOTION_TEMPLATE.md` file.
2. Create a new page in Notion.
3. Copy the Markdown content and paste it into Notion.
4. Upload the diagrams from `diagrams/rendered/` and the infographic from `infographic/` into the relevant sections of your Notion page.

## How to Use the Diagrams
- **Flowcharts**: Use these to understand the high-level logic and decision points.
- **Swimlanes**: Use these to see which role is responsible for each step.
- **Decisions**: Detailed breakdown of complex decision logic.

## How to Re-run / Reproduce
To regenerate this bundle, run the packaging script:
```bash
python3 scripts/package_bundle.py
```
*Note: Requires Python 3 standard library.*

## Troubleshooting
- **Missing Artifacts**: Check the `Delivery Notes` below.
- **Loom Access**: Ensure your Loom video has captions enabled and is accessible.

## Delivery Notes
Missing artifacts: 
Assumptions: Best-effort matching was used to select files.

## Course Creator 360 Inc
Ready to systemize your entire business?
**Offer**: Done-for-you SOP library + course ops systemization.
**Contact**: help@coursecreator360.com
