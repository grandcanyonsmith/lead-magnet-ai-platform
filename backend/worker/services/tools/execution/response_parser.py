import logging
from typing import List, Dict, Any, Optional
from .agent_utils import get_attr_or_key

logger = logging.getLogger(__name__)

class ResponseParser:
    """Parses OpenAI API responses to extract tool calls, reasoning, and text."""

    def __init__(self):
        pass

    def parse_response(self, response: Any) -> Dict[str, Any]:
        """
        Parses the response object and returns a dictionary containing:
        - computer_calls: List of computer tool calls
        - shell_calls: List of shell tool calls
        - generic_tool_calls: List of other tool calls
        - reasoning_items: List of reasoning text strings
        - text_outputs: List of text output strings
        """
        computer_calls = []
        shell_calls = []
        generic_tool_calls = []
        reasoning_items = []
        text_outputs = []

        if not hasattr(response, 'output') or not response.output:
            return {
                "computer_calls": computer_calls,
                "shell_calls": shell_calls,
                "generic_tool_calls": generic_tool_calls,
                "reasoning_items": reasoning_items,
                "text_outputs": text_outputs
            }

        for item in response.output:
            item_type = getattr(item, 'type', '')
            
            if item_type == 'computer_call':
                computer_calls.append(item)
            
            elif item_type == 'shell_call':
                shell_calls.append(item)
            
            elif item_type == 'tool_call':
                tool_name = get_attr_or_key(item, 'tool_name')
                # Fallback for standard function calls where name is in 'function' object
                if not tool_name:
                    func = get_attr_or_key(item, 'function')
                    if func:
                        tool_name = get_attr_or_key(func, 'name')
                
                if tool_name == 'shell':
                    shell_calls.append(item)
                else:
                    generic_tool_calls.append(item)
            
            elif item_type == 'function_call':
                generic_tool_calls.append(item)
            
            elif item_type == 'reasoning':
                # Extract reasoning summary
                summary = getattr(item, 'summary', [])
                if summary:
                    for s in summary:
                        if hasattr(s, 'text'):
                            reasoning_text = getattr(s, 'text', '')
                            if reasoning_text:
                                reasoning_items.append(reasoning_text)
                        elif isinstance(s, dict) and 'text' in s:
                            reasoning_items.append(s.get('text', ''))
            
            elif item_type == 'message':
                # Capture assistant narration in "message" items (most common shape: content=[{type:"output_text", text:"..."}])
                content = getattr(item, 'content', None)
                if isinstance(content, list):
                    for c in content:
                        c_type = get_attr_or_key(c, 'type')
                        if str(c_type) in ('output_text', 'text'):
                            txt = get_attr_or_key(c, 'text') or ''
                            if txt:
                                text_outputs.append(str(txt))
            
            elif item_type == 'text' or item_type == 'output_text':
                text_content = getattr(item, 'text', '') or getattr(item, 'content', '')
                if text_content:
                    text_outputs.append(text_content)

        return {
            "computer_calls": computer_calls,
            "shell_calls": shell_calls,
            "generic_tool_calls": generic_tool_calls,
            "reasoning_items": reasoning_items,
            "text_outputs": text_outputs
        }
