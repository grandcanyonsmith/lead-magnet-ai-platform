#!/usr/bin/env python3
import argparse
import base64
import os
import sys
import time

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.cua.drivers.docker_vm import DockerVMController


def _write_output(path: str, data: bytes) -> None:
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(data)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Smoke test for Docker VM CUA actions + screenshots."
    )
    parser.add_argument("--url", help="Optional URL to navigate to.")
    parser.add_argument("--width", type=int, default=1024, help="Display width.")
    parser.add_argument("--height", type=int, default=768, help="Display height.")
    parser.add_argument(
        "--output",
        default="docker_vm_smoke.png",
        help="Output screenshot file path.",
    )
    parser.add_argument(
        "--skip-actions",
        action="store_true",
        help="Skip move/click/scroll actions.",
    )
    parser.add_argument(
        "--wait",
        type=float,
        default=1.0,
        help="Seconds to wait after navigation/actions.",
    )
    args = parser.parse_args()

    controller = DockerVMController()
    try:
        controller.initialize(display_width=args.width, display_height=args.height)
    except Exception as exc:
        print(f"[docker_vm_smoke] Failed to initialize: {exc}")
        return 1

    try:
        if args.url:
            controller.navigate(args.url)
            time.sleep(args.wait)

        if not args.skip_actions:
            center_x = max(1, int(args.width / 2))
            center_y = max(1, int(args.height / 2))
            controller.execute_action({"type": "move", "x": center_x, "y": center_y})
            controller.execute_action({"type": "click", "x": center_x, "y": center_y})
            controller.execute_action({"type": "scroll", "scroll_y": 240})
            time.sleep(args.wait)

        screenshot_b64 = controller.capture_screenshot()
        screenshot_bytes = base64.b64decode(screenshot_b64)
        _write_output(args.output, screenshot_bytes)
        print(
            f"[docker_vm_smoke] Screenshot saved: {args.output} "
            f"({len(screenshot_bytes)} bytes)"
        )
    except Exception as exc:
        print(f"[docker_vm_smoke] Smoke test failed: {exc}")
        return 1
    finally:
        try:
            controller.cleanup()
        except Exception as exc:
            print(f"[docker_vm_smoke] Cleanup error: {exc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
