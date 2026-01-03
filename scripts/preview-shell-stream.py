#!/usr/bin/env python3
"""
Shell Stream Preview Formatter

Reads input from stdin (e.g., from a pipe) and formats recognized data structures
(like kpis and citations) into beautiful tables using the 'rich' library.
Also handles JSON log parsing, URL highlighting, HTML conversion, and syntax highlighting.
"""

import sys
import re
import json
import ast
from typing import List, Dict, Any, Optional

try:
    from rich.console import Console
    from rich.table import Table
    from rich.syntax import Syntax
    from rich.panel import Panel
    from rich.text import Text
    from rich.box import ROUNDED
    from rich.json import JSON
    from rich.markdown import Markdown
    from rich.markup import escape
except ImportError:
    sys.stderr.write("Error: 'rich' library not installed. Please run: pip install rich\n")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

# Initialize Rich Console
console = Console()

def html_to_markdown(html_content: str) -> str:
    """
    Simple HTML to Markdown converter using BeautifulSoup.
    """
    if not HAS_BS4:
        return html_content
        
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Handle bold
    for tag in soup.find_all(['b', 'strong']):
        tag.replace_with(f"**{tag.get_text()}**")
        
    # Handle italics
    for tag in soup.find_all(['i', 'em']):
        tag.replace_with(f"*{tag.get_text()}*")
        
    # Handle links
    for tag in soup.find_all('a'):
        href = tag.get('href', '')
        text = tag.get_text()
        tag.replace_with(f"[{text}]({href})")
        
    # Handle headings
    for i in range(1, 7):
        for tag in soup.find_all(f'h{i}'):
            tag.replace_with(f"{'#' * i} {tag.get_text()}\n\n")
            
    # Handle lists
    for tag in soup.find_all('li'):
        tag.replace_with(f"- {tag.get_text()}\n")
    for tag in soup.find_all(['ul', 'ol']):
        tag.unwrap()
        
    # Handle line breaks
    for tag in soup.find_all('br'):
        tag.replace_with("\n")
    for tag in soup.find_all('p'):
        tag.replace_with(f"\n{tag.get_text()}\n")

    return soup.get_text()

def extract_kpis(content: str) -> Optional[List[Dict]]:
    """
    Extracts kpis array from content.
    Expected format: input.kpis = [ ... ];
    """
    match = re.search(r'input\.kpis\s*=\s*(\[\s*\{.*\}\s*\]);?', content, re.DOTALL)
    if not match:
        return None
    
    array_str = match.group(1)
    
    # Manual parsing for robustness against variables
    items = []
    # Find all objects {...} inside the array
    # This is a simple regex that assumes no nested braces for now
    object_matches = re.finditer(r'\{\s*(.*?)\s*\}', array_str, re.DOTALL)
    
    for obj_match in object_matches:
        inner = obj_match.group(1)
        item = {}
        
        # Extract label
        label_m = re.search(r"label:\s*['\"](.*?)['\"]", inner)
        if label_m:
            item['label'] = label_m.group(1)
            
        # Extract value
        value_m = re.search(r"value:\s*['\"](.*?)['\"]", inner)
        if value_m:
            item['value'] = value_m.group(1)
            
        # Extract note (might be string or variable)
        # Try quoted string first
        note_m = re.search(r"note:\s*['\"](.*?)['\"]", inner)
        if note_m:
            item['note'] = note_m.group(1)
        else:
            # Try unquoted variable
            note_m_var = re.search(r"note:\s*([a-zA-Z0-9_]+)", inner)
            if note_m_var:
                item['note'] = f"<{note_m_var.group(1)}>" # Indicate it's a var
        
        if item:
            items.append(item)
            
    return items

def extract_citations(content: str) -> Optional[Dict]:
    """
    Extracts citations object from content.
    Expected format: input.citations = { ... };
    """
    match = re.search(r'input\.citations\s*=\s*(\{.*\});?', content, re.DOTALL)
    if not match:
        return None
    
    obj_str = match.group(1)
    
    # Heuristic parsing
    items = {}
    
    # Look for keys like '1': { ... }
    # Regex to find top level keys
    key_matches = re.finditer(r"['\"](\d+)['\"]\s*:\s*\{\s*(.*?)\s*\}(?=\s*[,}])", obj_str, re.DOTALL)
    
    for km in key_matches:
        cid = km.group(1)
        inner = km.group(2)
        
        citation = {}
        # label
        lm = re.search(r"label:\s*['\"](.*?)['\"]", inner)
        if lm: citation['label'] = lm.group(1)
        
        # url
        um = re.search(r"url:\s*['\"](.*?)['\"]", inner)
        if um: citation['url'] = um.group(1)
        
        # tooltip
        tm = re.search(r"tooltip:\s*['\"](.*?)['\"]", inner)
        if tm: citation['tooltip'] = tm.group(1)
        
        items[cid] = citation
        
    return items

def render_kpi_table(kpis: List[Dict]):
    table = Table(title="KPIs", box=ROUNDED, show_header=True, header_style="bold magenta")
    table.add_column("Label", style="cyan")
    table.add_column("Value", style="green")
    table.add_column("Note", style="italic white")
    
    for kpi in kpis:
        table.add_row(
            kpi.get('label', ''),
            kpi.get('value', ''),
            kpi.get('note', '')
        )
    
    console.print(table)

def render_citations_table(citations: Dict):
    table = Table(title="Citations", box=ROUNDED, show_header=True, header_style="bold magenta")
    table.add_column("ID", style="yellow", justify="right")
    table.add_column("Label", style="cyan")
    table.add_column("URL", style="blue underline")
    table.add_column("Tooltip", style="white dim")
    
    for cid, data in citations.items():
        table.add_row(
            cid,
            data.get('label', ''),
            data.get('url', ''),
            data.get('tooltip', '')
        )
    
    console.print(table)

def detect_and_render_json(text: str) -> bool:
    """
    Detects if the text contains a JSON object/array and renders it.
    Returns True if rendered, False otherwise.
    """
    text = text.strip()
    # Simple heuristic for JSON object/array
    if (text.startswith('{') and text.endswith('}')) or \
       (text.startswith('[') and text.endswith(']')):
        try:
            parsed = json.loads(text)
            console.print(JSON.from_data(parsed))
            return True
        except json.JSONDecodeError:
            pass
    return False

def enhance_and_print_text(text: str, level_style="white", timestamp="", level=""):
    """
    Smart text renderer:
    - HTML -> Markdown -> Render
    - Markdown -> Render (includes bold, links)
    - Raw Text -> regex enhancements -> Print
    """
    prefix = ""
    if level:
        prefix = f"[dim cyan]{timestamp}[/dim cyan] [{level_style}]{level}[/{level_style}]: "
    
    # 1. HTML Detection (heuristic: starts with < and has >)
    if HAS_BS4 and re.search(r'<[a-z][\s\S]*>', text):
        md = html_to_markdown(text)
        # Add link icons to md links
        md = re.sub(r'\[(.*?)\]\((.*?)\)', r'🔗 [\1](\2)', md)
        console.print(prefix, end="")
        console.print(Markdown(md))
        return

    # 2. Markdown/Text Processing
    # We want to support **bold** and URLs.
    # Rich Markdown supports these.
    
    # Pre-process URLs to add icon
    processed_text = text
    
    def repl_url(m):
        url = m.group(0)
        return f"[🔗 {url}]({url})"

    # Basic pattern for URL
    url_pattern = r'https?://[^\s<>\[\]"\')]+'
    
    processed_text = re.sub(url_pattern, repl_url, processed_text)
    
    console.print(prefix, end="")
    console.print(Markdown(processed_text))

def process_line(line: str):
    line = line.strip()
    if not line:
        return

    # Check if line is JSON log
    try:
        if line.startswith('{') and line.endswith('}'):
            log_data = json.loads(line)
            # If it has message, print that formatted
            if 'message' in log_data:
                msg = log_data['message']
                level = log_data.get('level', 'INFO').upper()
                timestamp = log_data.get('timestamp', '')
                
                # Style based on level
                level_style = "bold white"
                if level == 'ERROR': level_style = "bold red"
                elif level == 'WARN': level_style = "bold yellow"
                elif level == 'INFO': level_style = "bold green"
                elif level == 'DEBUG': level_style = "dim blue"
                
                # 1. Try Extractors (JS-like structures from shell tool)
                kpis = extract_kpis(msg)
                if kpis:
                    console.print(f"[dim cyan]{timestamp}[/dim cyan] [{level_style}]{level}[/{level_style}]: Detected KPIs data")
                    render_kpi_table(kpis)
                    return 
                
                citations = extract_citations(msg)
                if citations:
                    console.print(f"[dim cyan]{timestamp}[/dim cyan] [{level_style}]{level}[/{level_style}]: Detected Citations data")
                    render_citations_table(citations)
                    return
                
                # 2. Try pure JSON (Expandable/Pretty)
                # Print prefix first
                if (msg.strip().startswith('{') and msg.strip().endswith('}')) or \
                   (msg.strip().startswith('[') and msg.strip().endswith(']')):
                    try:
                        parsed = json.loads(msg)
                        console.print(f"[dim cyan]{timestamp}[/dim cyan] [{level_style}]{level}[/{level_style}]:")
                        console.print(JSON.from_data(parsed))
                        return
                    except json.JSONDecodeError:
                        pass

                # 3. Enhanced Text (HTML/Markdown/Bold/Links)
                # If it looks like code block from previous logic, use Syntax
                if "input.kpis" in msg:
                     syntax = Syntax(msg, "javascript", theme="monokai", word_wrap=True)
                     console.print(f"[dim cyan]{timestamp}[/dim cyan] [{level_style}]{level}[/{level_style}]:")
                     console.print(syntax)
                else:
                    enhance_and_print_text(msg, level_style, timestamp, level)
                    
            else:
                 console.print(JSON.from_data(log_data))
        else:
            # Not JSON log, maybe raw output
            # Check for KPIs/Citations in raw text
            if "input.kpis" in line or "input.citations" in line or "={" in line:
                 console.print(Syntax(line, "javascript", theme="monokai"))
            else:
                # Apply enhancements to raw lines too
                enhance_and_print_text(line)
            
    except json.JSONDecodeError:
        # Not JSON
        enhance_and_print_text(line)

def main():
    buffer = ""
    in_code_block = False
    
    try:
        for line in sys.stdin:
            clean_line = line.strip()
            
            # JSON Log Line
            if clean_line.startswith('{') and clean_line.endswith('}'):
                if buffer:
                    console.print(buffer)
                    buffer = ""
                process_line(line)
                continue
                
            # Raw text block handling (for JS objects split across lines)
            if "input.kpis = [" in clean_line:
                in_code_block = True
                buffer += line
            elif "input.citations = {" in clean_line:
                in_code_block = True
                buffer += line
            elif in_code_block:
                buffer += line
                if "];" in clean_line or "};" in clean_line:
                    kpis = extract_kpis(buffer)
                    citations = extract_citations(buffer)
                    
                    if kpis:
                        render_kpi_table(kpis)
                    elif citations:
                        render_citations_table(citations)
                    else:
                        console.print(Syntax(buffer, "javascript", theme="monokai"))
                    
                    buffer = ""
                    in_code_block = False
            else:
                if buffer:
                    console.print(buffer)
                    buffer = ""
                
                # Treat normal lines as potential rich text
                # We strip right side but keep indentation? Markdown cares about indentation.
                # For logs, usually indentation is minimal or timestamp based.
                enhance_and_print_text(line.rstrip())
                
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
