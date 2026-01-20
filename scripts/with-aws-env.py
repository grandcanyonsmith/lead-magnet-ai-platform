#!/usr/bin/env python3
"""
Run a command with AWS credentials loaded from ~/.aws/credentials.

Examples:
  python3 scripts/with-aws-env.py --check
  python3 scripts/with-aws-env.py -- python3 scripts/run-worker-manually.py <job_id>
  python3 scripts/with-aws-env.py --profile staging --region us-east-1 -- <cmd>
"""

import argparse
import configparser
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional, Tuple


def _expand_path(path: str) -> Path:
    return Path(os.path.expanduser(path)).resolve()


def _load_credentials(path: Path, profile: str) -> Tuple[str, str, Optional[str]]:
    parser = configparser.RawConfigParser()
    parser.read(path)
    section = profile or "default"
    if not parser.has_section(section):
        raise ValueError(f"Profile '{section}' not found in {path}")
    access_key = parser.get(section, "aws_access_key_id", fallback="").strip()
    secret_key = parser.get(section, "aws_secret_access_key", fallback="").strip()
    session_token = parser.get(section, "aws_session_token", fallback="").strip()
    if not access_key or not secret_key:
        raise ValueError(f"Missing access_key/secret_key in {path} [{section}]")
    return access_key, secret_key, session_token or None


def _load_region(path: Path, profile: str) -> Optional[str]:
    parser = configparser.RawConfigParser()
    parser.read(path)
    section = "default" if profile in ("", "default", None) else f"profile {profile}"
    if not parser.has_section(section):
        return None
    region = parser.get(section, "region", fallback="").strip()
    return region or None


def _print_check(profile: str, region: Optional[str], has_session: bool) -> None:
    print(f"AWS_PROFILE={profile or 'default'}")
    print("AWS_ACCESS_KEY_ID=SET")
    print("AWS_SECRET_ACCESS_KEY=SET")
    print(f"AWS_SESSION_TOKEN={'SET' if has_session else 'MISSING'}")
    if region:
        print(f"AWS_REGION={region}")
        print(f"AWS_DEFAULT_REGION={region}")
    else:
        print("AWS_REGION=MISSING")
        print("AWS_DEFAULT_REGION=MISSING")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run a command with AWS credentials loaded from shared config.",
    )
    parser.add_argument("--profile", default=os.environ.get("AWS_PROFILE", "default"))
    parser.add_argument("--region", default=os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION"))
    parser.add_argument("--credentials", default="~/.aws/credentials")
    parser.add_argument("--config", default="~/.aws/config")
    parser.add_argument("--check", action="store_true", help="Print presence of AWS env values and exit")
    parser.add_argument("command", nargs=argparse.REMAINDER, help="Command to run")
    args = parser.parse_args()

    credentials_path = _expand_path(args.credentials)
    config_path = _expand_path(args.config)

    if not credentials_path.exists():
        print(f"❌ Credentials file not found: {credentials_path}", file=sys.stderr)
        return 1

    try:
        access_key, secret_key, session_token = _load_credentials(
            credentials_path,
            args.profile,
        )
    except Exception as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 1

    region = args.region
    if not region and config_path.exists():
        region = _load_region(config_path, args.profile)

    if args.check and not args.command:
        _print_check(args.profile, region, bool(session_token))
        return 0

    if not args.command:
        parser.error("Provide a command to run or use --check")

    cmd = list(args.command)
    if cmd and cmd[0] == "--":
        cmd = cmd[1:]
    if not cmd:
        parser.error("Provide a command after --")

    env = os.environ.copy()
    env["AWS_ACCESS_KEY_ID"] = access_key
    env["AWS_SECRET_ACCESS_KEY"] = secret_key
    if session_token:
        env["AWS_SESSION_TOKEN"] = session_token
    if region:
        env["AWS_REGION"] = region
        env["AWS_DEFAULT_REGION"] = region
    env["AWS_PROFILE"] = args.profile or "default"

    result = subprocess.run(cmd, env=env)
    return int(result.returncode)


if __name__ == "__main__":
    sys.exit(main())
