"""
Content Detector Utility
Detects content type (JSON, HTML, or Markdown) from content and step name.
"""

import json
import re
from typing import List, Optional, Tuple


FULL_CODE_FENCE_RE = re.compile(
    r"^```[a-zA-Z0-9_-]*\s*\n?(?P<body>[\s\S]*?)\n?\s*```$",
    re.IGNORECASE,
)
HTML_CODE_FENCE_RE = re.compile(
    r"```html\s*(?P<body>[\s\S]*?)\s*```",
    re.IGNORECASE,
)
GENERIC_CODE_FENCE_RE = re.compile(
    r"```(?:[a-zA-Z0-9_-]+)?\s*(?P<body>[\s\S]*?)\s*```",
    re.IGNORECASE,
)
DOCTYPE_HTML_RE = re.compile(
    r"(?P<body><!doctype html[\s\S]*?</html>)",
    re.IGNORECASE,
)
HTML_DOCUMENT_RE = re.compile(
    r"(?P<body><html\b[\s\S]*?</html>)",
    re.IGNORECASE,
)
FILE_HEREDOC_PATTERNS = [
    re.compile(
        r"""^\s*(?:\$?\s*)?cat\s*(?:1>>|1>|>>|>\|?)\s*(?P<file>"[^"]+"|'[^']+'|[^\s<]+)\s*<<-?\s*['"]?(?P<marker>[A-Za-z0-9_]+)['"]?\s*$""",
        re.IGNORECASE,
    ),
    re.compile(
        r"""^\s*(?:\$?\s*)?cat\s*<<-?\s*['"]?(?P<marker>[A-Za-z0-9_]+)['"]?\s*(?:1>>|1>|>>|>\|?)\s*(?P<file>"[^"]+"|'[^']+'|[^\s<]+)\s*$""",
        re.IGNORECASE,
    ),
    re.compile(
        r"""^\s*(?:\$?\s*)?tee\s+(?P<file>"[^"]+"|'[^']+'|[^\s>]+)(?:\s*>\s*/dev/null)?\s*<<-?\s*['"]?(?P<marker>[A-Za-z0-9_]+)['"]?\s*$""",
        re.IGNORECASE,
    ),
    re.compile(
        r"""^\s*(?:\$?\s*)?tee\s*<<-?\s*['"]?(?P<marker>[A-Za-z0-9_]+)['"]?\s+(?P<file>"[^"]+"|'[^']+'|[^\s>]+)(?:\s*>\s*/dev/null)?\s*$""",
        re.IGNORECASE,
    ),
]


def _unwrap_full_code_fence(content: str) -> str:
    match = FULL_CODE_FENCE_RE.match(content.strip())
    if not match:
        return content.strip()
    return (match.group("body") or "").strip()


def _strip_wrapping_quotes(value: str) -> str:
    trimmed = value.strip()
    if (
        (trimmed.startswith('"') and trimmed.endswith('"')) or
        (trimmed.startswith("'") and trimmed.endswith("'"))
    ):
        return trimmed[1:-1]
    return trimmed


def _looks_like_html(content: str) -> bool:
    content_stripped = content.strip()
    return (
        content_stripped.startswith('<!DOCTYPE') or
        content_stripped.startswith('<!doctype') or
        content_stripped.startswith('<html') or
        content_stripped.startswith('<HTML') or
        (content_stripped.startswith('<') and
         any(tag in content_stripped[:200].lower() for tag in [
             '<html', '<head', '<body', '<div', '<p>', '<h1', '<h2', '<h3'
         ]))
    )


def _extract_parseable_json(content: str) -> Optional[str]:
    content_stripped = content.strip()
    if not content_stripped or content_stripped[0] not in ["{", "["]:
        return None
    try:
        parsed = json.loads(content_stripped)
        if isinstance(parsed, (dict, list)):
            return content_stripped
    except Exception:
        return None
    return None


def _normalize_extension(filename: str) -> Optional[str]:
    lower = filename.lower()
    if lower.endswith((".html", ".htm")):
        return ".html"
    if lower.endswith(".json"):
        return ".json"
    if lower.endswith((".md", ".markdown")):
        return ".md"
    return None


def _extract_shell_generated_files(content: str) -> List[Tuple[str, str]]:
    normalized = str(content).replace("\r\n", "\n")
    lines = normalized.split("\n")
    matches: List[Tuple[str, str]] = []
    index = 0

    while index < len(lines):
        line = lines[index]
        match = None
        for pattern in FILE_HEREDOC_PATTERNS:
            match = pattern.match(line)
            if match:
                break

        if not match:
            index += 1
            continue

        file_name = _strip_wrapping_quotes(match.group("file") or "")
        marker = (match.group("marker") or "").strip()
        if not file_name or not marker:
            index += 1
            continue

        content_lines: List[str] = []
        cursor = index + 1
        end_index = None
        while cursor < len(lines):
            next_line = lines[cursor]
            if next_line.strip() == marker:
                end_index = cursor
                break
            content_lines.append(next_line)
            cursor += 1

        if end_index is None:
            index += 1
            continue

        matches.append((file_name, "\n".join(content_lines).strip()))
        index = end_index + 1

    return matches


def resolve_artifact_content(content: str, step_name: str = '') -> Tuple[str, str]:
    """
    Resolve the primary artifact payload and extension from a raw step output.

    This prefers structured deliverables embedded inside shell/tool output
    (for example `cat > index.html <<'EOF' ... EOF`) over surrounding prose.
    """
    if content is None:
        return "", ".md"

    original = str(content)
    stripped = original.strip()
    step_name_lower = step_name.lower()

    if not stripped:
        return "", ".md"

    unwrapped = _unwrap_full_code_fence(stripped)

    json_candidate = _extract_parseable_json(unwrapped)
    if json_candidate is not None:
        return json_candidate, ".json"

    if _looks_like_html(unwrapped):
        return unwrapped, ".html"

    generated_files = _extract_shell_generated_files(original)
    html_files = [
        file_content for file_name, file_content in generated_files
        if file_content and (
            _normalize_extension(file_name) == ".html" or _looks_like_html(file_content)
        )
    ]
    if html_files:
        return html_files[-1], ".html"

    json_files = [
        file_content for file_name, file_content in generated_files
        if file_content and _normalize_extension(file_name) == ".json" and _extract_parseable_json(file_content)
    ]
    if json_files:
        json_content = json_files[-1].strip()
        return json_content, ".json"

    markdown_files = [
        file_content for file_name, file_content in generated_files
        if file_content and _normalize_extension(file_name) == ".md"
    ]
    if markdown_files:
        return markdown_files[-1], ".md"

    html_fence_matches = list(HTML_CODE_FENCE_RE.finditer(original))
    if html_fence_matches:
        html_body = (html_fence_matches[-1].group("body") or "").strip()
        if html_body:
            return html_body, ".html"

    generic_fence_matches = list(GENERIC_CODE_FENCE_RE.finditer(original))
    for match in reversed(generic_fence_matches):
        body = (match.group("body") or "").strip()
        if not body:
            continue
        if _looks_like_html(body):
            return body, ".html"

    for pattern in (DOCTYPE_HTML_RE, HTML_DOCUMENT_RE):
        html_matches = list(pattern.finditer(original))
        if html_matches:
            html_body = (html_matches[-1].group("body") or "").strip()
            if html_body:
                return html_body, ".html"

    if 'html' in step_name_lower:
        return unwrapped, ".html"

    return unwrapped, ".md"


def detect_content_type(content: str, step_name: str = '') -> str:
    """
    Detect content type (JSON, HTML, or Markdown) from content and step name.
    
    Args:
        content: Content string to analyze
        step_name: Optional step name that may hint at content type
        
    Returns:
        File extension string: '.json', '.html', or '.md'
    """
    _, file_ext = resolve_artifact_content(content, step_name)
    return file_ext

