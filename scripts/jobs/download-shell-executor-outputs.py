#!/usr/bin/env python3
"""
Download shell executor uploads from S3.

Usage:
  - Provide a manifest (local path, s3://, or https://) to download only listed files.
  - Or provide --bucket and --prefix to download everything under that prefix.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Iterable, List, Optional, Tuple, Union
from urllib.parse import urlparse
from urllib.request import urlopen

from botocore.exceptions import ClientError

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.common import get_aws_region, get_s3_client, print_section


ManifestData = Union[List[str], dict]


def parse_s3_uri(uri: str) -> Optional[Tuple[str, str]]:
    if not uri.startswith("s3://"):
        return None
    bucket_and_key = uri[5:]
    if "/" not in bucket_and_key:
        return bucket_and_key, ""
    bucket, key = bucket_and_key.split("/", 1)
    return bucket, key


def load_manifest(source: str) -> ManifestData:
    source = source.strip()
    if source.startswith("s3://"):
        bucket, key = parse_s3_uri(source)
        if not bucket or not key:
            raise ValueError("Manifest S3 URI must include a key")
        s3 = get_s3_client()
        response = s3.get_object(Bucket=bucket, Key=key)
        raw = response["Body"].read().decode("utf-8")
    elif source.startswith("http://") or source.startswith("https://"):
        with urlopen(source) as resp:
            raw = resp.read().decode("utf-8")
    else:
        raw = Path(source).read_text(encoding="utf-8")
    return json.loads(raw)


def parse_manifest_data(data: ManifestData) -> Tuple[List[str], Optional[str], Optional[str]]:
    if isinstance(data, list):
        return [str(p) for p in data], None, None
    if isinstance(data, dict):
        files = data.get("files") or data.get("paths") or []
        if not isinstance(files, list):
            files = []
        bucket = data.get("bucket")
        prefix = data.get("prefix")
        return [str(p) for p in files], bucket, prefix
    raise ValueError("Manifest must be a JSON list or object")


def normalize_prefix(prefix: Optional[str]) -> str:
    cleaned = (prefix or "").strip().lstrip("/")
    if cleaned and not cleaned.endswith("/"):
        cleaned += "/"
    return cleaned


def sanitize_relpath(path: str) -> Optional[str]:
    clean = path.replace("\\", "/").lstrip("/")
    if not clean:
        return None
    parts = [p for p in clean.split("/") if p]
    if any(part == ".." for part in parts):
        return None
    return "/".join(parts)


def relpath_from_manifest(path: str, work_root: str) -> Optional[str]:
    raw = str(path).strip()
    if not raw:
        return None
    work_root = (work_root or "/work").rstrip("/")
    if raw.startswith(f"{work_root}/"):
        raw = raw[len(work_root) + 1 :]
    elif raw.startswith("/work/"):
        raw = raw[len("/work/") :]
    elif raw.startswith("/"):
        raw = raw.lstrip("/")
    return sanitize_relpath(raw)


def build_manifest_keys(files: Iterable[str], prefix: str, work_root: str) -> List[str]:
    keys: List[str] = []
    for entry in files:
        relpath = relpath_from_manifest(entry, work_root)
        if not relpath:
            continue
        keys.append(f"{prefix}{relpath}")
    return sorted(set(keys))


def list_prefix_keys(bucket: str, prefix: str) -> List[str]:
    s3 = get_s3_client()
    keys: List[str] = []
    token = None
    while True:
        params = {"Bucket": bucket, "Prefix": prefix}
        if token:
            params["ContinuationToken"] = token
        response = s3.list_objects_v2(**params)
        for obj in response.get("Contents", []):
            key = obj.get("Key")
            if key:
                keys.append(key)
        if not response.get("IsTruncated"):
            break
        token = response.get("NextContinuationToken")
    return keys


def download_keys(bucket: str, keys: Iterable[str], dest_root: Path, dry_run: bool) -> Tuple[int, int]:
    s3 = get_s3_client()
    downloaded = 0
    errors = 0
    for key in keys:
        local_path = dest_root / key
        if dry_run:
            print(f"[dry-run] s3://{bucket}/{key} -> {local_path}")
            downloaded += 1
            continue
        local_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            s3.download_file(bucket, key, str(local_path))
            downloaded += 1
        except ClientError as e:
            errors += 1
            print(f"✗ Failed: s3://{bucket}/{key} ({e})")
    return downloaded, errors


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download shell executor uploads from S3."
    )
    parser.add_argument(
        "--manifest",
        help="Path/URL to shell_executor_manifest.json (local, s3://, or https://)",
    )
    parser.add_argument("--bucket", help="S3 bucket name")
    parser.add_argument("--prefix", help="S3 prefix (e.g. project/20260120/)")
    parser.add_argument(
        "--dest",
        default="dist/shell-executor",
        help="Local destination root (default: dist/shell-executor)",
    )
    parser.add_argument(
        "--work-root",
        default="/work",
        help="Work root used in manifest paths (default: /work)",
    )
    parser.add_argument("--region", default=None, help="AWS region override")
    parser.add_argument("--dry-run", action="store_true", help="Print actions only")
    args = parser.parse_args()

    if args.region:
        os.environ["AWS_REGION"] = args.region

    print_section("Shell Executor Output Downloader")
    print(f"Region: {get_aws_region()}")

    if not args.manifest and (not args.bucket or args.prefix is None):
        parser.error("Provide --manifest or both --bucket and --prefix")

    keys: List[str] = []
    bucket = args.bucket
    prefix = normalize_prefix(args.prefix)

    if args.manifest:
        data = load_manifest(args.manifest)
        files, manifest_bucket, manifest_prefix = parse_manifest_data(data)
        bucket = bucket or manifest_bucket
        prefix = normalize_prefix(prefix or manifest_prefix)
        if not bucket:
            raise ValueError("Bucket not found in manifest or --bucket")
        if prefix is None:
            raise ValueError("Prefix not found in manifest or --prefix")
        keys = build_manifest_keys(files, prefix, args.work_root)
        print(f"Manifest source: {args.manifest}")
        print(f"Manifest entries: {len(files)}")
    else:
        if not bucket:
            raise ValueError("Bucket is required")
        if prefix is None:
            raise ValueError("Prefix is required")
        keys = list_prefix_keys(bucket, prefix)
        print(f"S3 prefix listing: s3://{bucket}/{prefix}")

    if not keys:
        print("No files found to download.")
        sys.exit(1)

    dest_root = Path(args.dest) / bucket
    print(f"Destination: {dest_root}")
    print(f"Files: {len(keys)}")

    downloaded, errors = download_keys(bucket, keys, dest_root, args.dry_run)
    print(f"Downloaded: {downloaded} file(s)")
    if errors:
        print(f"Errors: {errors}")
        sys.exit(1)


if __name__ == "__main__":
    main()
