import os
import shutil
import json
import hashlib
import zipfile
import pathlib
import datetime
import sys
import platform
import re

# Configuration
BASE_DIR = pathlib.Path(os.environ.get("OUTPUT_DIR", "/output"))
BUNDLE_DIR = BASE_DIR / "bundle"
ZIP_PATH = BASE_DIR / "CourseCreator360_Loom_to_SOP_Kit.zip"

def setup_directories():
    if BUNDLE_DIR.exists():
        shutil.rmtree(BUNDLE_DIR)
    
    subdirs = [
        "transcripts",
        "sop",
        "diagrams/specs",
        "diagrams/rendered",
        "infographic",
        "scripts",
        "notion",
        "qa",
        "meta"
    ]
    
    for sd in subdirs:
        (BUNDLE_DIR / sd).mkdir(parents=True, exist_ok=True)

def get_file_info(path):
    stat = path.stat()
    return {
        "path": str(path),
        "size": stat.st_size,
        "mtime": stat.st_mtime
    }

def scan_artifacts():
    candidates = {
        "transcripts": [],
        "sop_model": [],
        "diagram_specs": [],
        "rendered_diagrams": [],
        "notion_template": [],
        "infographic": [],
        "scripts": []
    }
    
    # Exclude bundle dir and final zip
    for path in BASE_DIR.rglob("*"):
        if not path.is_file():
            continue
        if BUNDLE_DIR in path.parents:
            continue
        if path == ZIP_PATH:
            continue
        if path.name == "package_bundle.py": # Include self if found, but handle separately
            pass

        name_lower = path.name.lower()
        parent_lower = path.parent.name.lower()
        
        # A) Transcripts
        if any(x in name_lower for x in ["transcript", "captions", "vtt", "srt"]) or \
           (name_lower.endswith(".txt") or name_lower.endswith(".md")):
             # Weak filter for txt/md, usually transcripts are named as such
             if "transcript" in name_lower or "caption" in name_lower:
                 candidates["transcripts"].append(path)

        # B) SOP Model
        if path.suffix == ".json" and ("sop_model" in name_lower or "sop" in name_lower):
            candidates["sop_model"].append(path)
            
        # C) Diagram Specs
        if path.suffix == ".json" and ("diagram_specs" in name_lower or "diagram" in name_lower):
            candidates["diagram_specs"].append(path)
            
        # D) Rendered Diagrams
        if path.suffix in [".png", ".svg"] and \
           any(x in parent_lower or x in name_lower for x in ["diagram", "rendered", "flow", "swimlane", "decision"]):
            candidates["rendered_diagrams"].append(path)
            
        # E) Notion Template
        if path.suffix == ".md" and ("notion" in name_lower or "sop" in name_lower or "template" in name_lower):
            candidates["notion_template"].append(path)
            
        # F) Infographic
        if path.suffix in [".png", ".jpeg", ".jpg"] and \
           any(x in name_lower for x in ["onepager", "infographic", "summary"]):
            candidates["infographic"].append(path)
            
        # G) Scripts
        if path.suffix == ".py" and ("render" in name_lower or "diagram" in name_lower or "package" in name_lower):
            candidates["scripts"].append(path)

    # Sort candidates by size (desc) then mtime (desc)
    for k in candidates:
        candidates[k].sort(key=lambda p: (p.stat().st_size, p.stat().st_mtime), reverse=True)
        
    return candidates

def select_and_copy(candidates, manifest_selection_log):
    selected = {}
    
    # Helper to copy and log
    def copy_file(category, source_path, dest_rel_path):
        dest = BUNDLE_DIR / dest_rel_path
        shutil.copy2(source_path, dest)
        selected[category] = dest
        
        # Log rationale
        log_entry = {
            "category": category,
            "chosen": str(source_path),
            "destination": str(dest_rel_path),
            "candidates": [str(c) for c in candidates.get(category, [])]
        }
        manifest_selection_log[category] = log_entry

    # 1. Transcripts
    # Best timestamped
    ts_cands = candidates["transcripts"]
    if ts_cands:
        copy_file("transcript", ts_cands[0], f"transcripts/{ts_cands[0].name}")

    # 2. SOP Model
    if candidates["sop_model"]:
        copy_file("sop_model", candidates["sop_model"][0], "sop/sop_model.json")
        
    # 3. Diagram Specs
    if candidates["diagram_specs"]:
        copy_file("diagram_specs", candidates["diagram_specs"][0], "diagrams/specs/diagram_specs.json")
        
    # 4. Rendered Diagrams (Copy ALL valid ones)
    diag_log = []
    for p in candidates["rendered_diagrams"]:
        dest_name = p.name
        shutil.copy2(p, BUNDLE_DIR / "diagrams/rendered" / dest_name)
        diag_log.append(str(p))
    manifest_selection_log["rendered_diagrams"] = {"chosen": diag_log}

    # 5. Notion Template
    if candidates["notion_template"]:
        copy_file("notion_template", candidates["notion_template"][0], "notion/SOP_NOTION_TEMPLATE.md")

    # 6. Infographic
    if candidates["infographic"]:
        copy_file("infographic", candidates["infographic"][0], "infographic/SOP_ONE_PAGER.png")
        
    # 7. Scripts
    scripts_log = []
    for p in candidates["scripts"]:
        shutil.copy2(p, BUNDLE_DIR / "scripts" / p.name)
        scripts_log.append(str(p))
    # Also copy this script if not already included
    this_script = pathlib.Path(__file__)
    if not (BUNDLE_DIR / "scripts" / this_script.name).exists():
        shutil.copy2(this_script, BUNDLE_DIR / "scripts" / this_script.name)
        scripts_log.append(str(this_script))
    manifest_selection_log["scripts"] = {"chosen": scripts_log}

    return selected

def create_documentation(selected_files, manifest):
    # README.md
    readme_content = f"""# Course Creator 360 - Loom to SOP Kit

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
Missing artifacts: {', '.join(manifest.get('missing_expected_artifacts', []))}
Assumptions: Best-effort matching was used to select files.

## Course Creator 360 Inc
Ready to systemize your entire business?
**Offer**: Done-for-you SOP library + course ops systemization.
**Contact**: help@coursecreator360.com
"""
    with open(BUNDLE_DIR / "README.md", "w") as f:
        f.write(readme_content)

    # QA_CHECKLIST.md
    qa_content = """# SOP Quality Assurance Checklist

## Basics
- [ ] **Trigger Defined**: Is it clear when this SOP starts?
- [ ] **Success Criteria**: Is the desired outcome clearly stated?
- [ ] **Roles Assigned**: Are owners defined for each step?

## Content
- [ ] **Steps Clear**: Are instructions actionable and unambiguous?
- [ ] **Inputs/Outputs**: Are required inputs and produced outputs listed?
- [ ] **Decisions**: Are all "If/Then" branches covered?
- [ ] **Edge Cases**: Are common errors or exceptions addressed?

## Assets
- [ ] **Diagrams**: Do the flowcharts match the text steps?
- [ ] **Links**: Are all external links working?
- [ ] **Attachments**: Are referenced files included or accessible?

## Final Review
- [ ] **Delegability**: Could a stranger complete this task using only this doc?
- [ ] **Timing**: Are time estimates realistic?
- [ ] **Access**: Does the assignee have all necessary permissions?
"""
    with open(BUNDLE_DIR / "qa/QA_CHECKLIST.md", "w") as f:
        f.write(qa_content)

def create_manifest(selection_log):
    manifest = {
        "bundle_name": "CourseCreator360_Loom_to_SOP_Kit",
        "created_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "model_step": "Step 6 - Packaging, QA, and Lead Magnet Delivery Bundle",
        "loom_url": None, # Placeholder, would need regex search in files
        "selection_log": selection_log,
        "included_files": [],
        "missing_expected_artifacts": [],
        "environment": {
            "python_version": sys.version,
            "platform": platform.platform()
        },
        "s3_upload": {}
    }
    
    # Check for missing expected
    expected_keys = ["sop_model", "notion_template", "infographic"]
    for k in expected_keys:
        if k not in selection_log:
            manifest["missing_expected_artifacts"].append(k)

    # List included files
    for path in BUNDLE_DIR.rglob("*"):
        if path.is_file():
            rel_path = path.relative_to(BUNDLE_DIR)
            stat = path.stat()
            manifest["included_files"].append({
                "relative_path": str(rel_path),
                "bytes": stat.st_size,
                "modified_time": stat.st_mtime
            })
            
    with open(BUNDLE_DIR / "meta/manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)
        
    return manifest

def create_checksums():
    checksums = {}
    paths = sorted([p for p in BUNDLE_DIR.rglob("*") if p.is_file()], key=lambda p: str(p.relative_to(BUNDLE_DIR)))
    
    lines = []
    for path in paths:
        if path.name == "checksums.sha256":
            continue
        h = hashlib.sha256()
        with open(path, "rb") as f:
            while chunk := f.read(8192):
                h.update(chunk)
        rel_path = path.relative_to(BUNDLE_DIR)
        lines.append(f"{h.hexdigest()}  {rel_path}")
        
    with open(BUNDLE_DIR / "meta/checksums.sha256", "w") as f:
        f.write("\n".join(lines))

def create_zip():
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
        
    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Walk bundle dir
        for root, dirs, files in os.walk(BUNDLE_DIR):
            # Sort for determinism
            dirs.sort()
            files.sort()
            
            for file in files:
                abs_path = pathlib.Path(root) / file
                rel_path = abs_path.relative_to(BUNDLE_DIR)
                
                # Set deterministic time
                zinfo = zipfile.ZipInfo(str(rel_path))
                zinfo.date_time = (1980, 1, 1, 0, 0, 0)
                zinfo.compress_type = zipfile.ZIP_DEFLATED
                
                with open(abs_path, 'rb') as f:
                    zf.writestr(zinfo, f.read())
                    
    return ZIP_PATH

def main():
    print(f"Starting packaging in {BASE_DIR}...")
    setup_directories()
    
    candidates = scan_artifacts()
    selection_log = {}
    selected = select_and_copy(candidates, selection_log)
    
    manifest = create_manifest(selection_log)
    create_documentation(selected, manifest)
    create_checksums()
    
    zip_path = create_zip()
    print(f"Zip created at: {zip_path}")
    print(f"Zip size: {zip_path.stat().st_size} bytes")
    
    # Print tree (simple version)
    print("\nBundle Tree:")
    for root, dirs, files in os.walk(BUNDLE_DIR):
        level = root.replace(str(BUNDLE_DIR), '').count(os.sep)
        indent = ' ' * 4 * (level)
        print(f"{indent}{os.path.basename(root)}/")
        subindent = ' ' * 4 * (level + 1)
        for f in files:
            print(f"{subindent}{f}")

if __name__ == "__main__":
    main()
