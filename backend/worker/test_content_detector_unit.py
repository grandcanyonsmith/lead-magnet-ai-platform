"""
Unit tests for content type detection utility.
"""

import sys
from pathlib import Path

# Add the worker directory to Python path so imports work
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

from utils.content_detector import detect_content_type


def test_detects_json_object():
    assert detect_content_type('{"a": 1, "b": "c"}', "Any Step") == ".json"


def test_detects_json_array():
    assert detect_content_type('[{"a": 1}, {"b": 2}]', "Any Step") == ".json"


def test_detects_json_in_code_fence():
    content = "```json\n{\n  \"a\": 1\n}\n```"
    assert detect_content_type(content, "Any Step") == ".json"


def test_detects_html():
    html = "<!DOCTYPE html><html><head></head><body><h1>Hello</h1></body></html>"
    assert detect_content_type(html, "Some Step") == ".html"


def test_detects_html_in_code_fence():
    html = "```html\n<!DOCTYPE html><html><body>OK</body></html>\n```"
    assert detect_content_type(html, "Some Step") == ".html"


def test_defaults_to_markdown():
    md = "# Title\n\nSome text."
    assert detect_content_type(md, "Some Step") == ".md"


def test_markdown_with_json_snippet_is_not_misclassified():
    md = "Here is JSON:\n\n```json\n{\"a\": 1}\n```\n\nThanks."
    assert detect_content_type(md, "Some Step") == ".md"

