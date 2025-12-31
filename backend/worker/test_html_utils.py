"""
Unit tests for HTML utilities.
"""

import unittest
from utils.html_utils import strip_html_tags


class TestHtmlUtils(unittest.TestCase):
    
    def test_strip_basic_tags(self):
        html = "<p>Hello <b>World</b></p>"
        expected = "Hello World"
        self.assertEqual(strip_html_tags(html), expected)
        
    def test_strip_script_tags(self):
        html = "<div>Content<script>alert('bad');</script></div>"
        expected = "Content"
        self.assertEqual(strip_html_tags(html), expected)
        
    def test_strip_style_tags(self):
        html = "<div>Content<style>body { color: red; }</style></div>"
        expected = "Content"
        self.assertEqual(strip_html_tags(html), expected)
        
    def test_normalize_newlines(self):
        html = "Line 1<br><br><br>Line 2"
        # Note: <br> is removed, leaving whatever newlines were there or not.
        # If input has actual newlines:
        text = "Line 1\n\n\n\nLine 2"
        expected = "Line 1\n\nLine 2"
        self.assertEqual(strip_html_tags(text), expected)
        
    def test_empty_input(self):
        self.assertEqual(strip_html_tags(""), "")
        self.assertEqual(strip_html_tags(None), "")
        
    def test_complex_html(self):
        html = """
        <html>
            <head>
                <style>body { color: blue; }</style>
                <script>console.log('hi');</script>
            </head>
            <body>
                <h1>Title</h1>
                <p>Paragraph with <a href="#">link</a>.</p>
            </body>
        </html>
        """
        result = strip_html_tags(html)
        self.assertNotIn("body { color: blue; }", result)
        self.assertNotIn("console.log", result)
        self.assertIn("Title", result)
        self.assertIn("Paragraph with link.", result)


if __name__ == "__main__":
    unittest.main()

