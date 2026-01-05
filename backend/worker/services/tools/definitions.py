"""
Standard tool definitions and schemas.
"""
from typing import Dict, Any, Optional

def get_shell_tool_definition() -> Dict[str, Any]:
    """Returns the function definition for the shell tool."""
    return {
        "type": "function",
        "function": {
            "name": "execute_shell_command",
            "description": "EXECUTE a shell command on the backend server (e.g. ls, git, curl). Use this function to run commands directly. DO NOT try to find a terminal in the browser UI.",
            "parameters": {
                "type": "object",
                "properties": {
                    "commands": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "List of shell commands to execute."
                    }
                },
                "required": ["commands"]
            }
        }
    }

def get_image_generation_defaults() -> Dict[str, Any]:
    """Returns default configuration for image generation tool."""
    return {
        "type": "image_generation",
        "model": "gpt-image-1.5",
        "size": "auto",
        "quality": "auto",
        "background": "auto"
    }

def get_web_search_tool_definition() -> Dict[str, Any]:
    """Returns the definition for the web search tool."""
    return {"type": "web_search"}

def get_file_search_tool_definition() -> Dict[str, Any]:
    """Returns the definition for the file search tool."""
    return {"type": "file_search"}

def get_code_interpreter_tool_definition() -> Dict[str, Any]:
    """Returns the definition for the code interpreter tool."""
    return {"type": "code_interpreter"}

def get_computer_use_tool_definition(
    display_width: int = 1024,
    display_height: int = 768,
    computer_use_preview: bool = True
) -> Dict[str, Any]:
    """
    Returns the definition for the computer use tool.
    
    Args:
        display_width: Width of the virtual display (default 1024)
        display_height: Height of the virtual display (default 768)
        computer_use_preview: Whether to use the preview type (default True)
    """
    tool_type = "computer_use_preview" if computer_use_preview else "computer_use"
    return {
        "type": tool_type,
        "display_width": display_width,
        "display_height": display_height,
        # Note: 'container' parameter is handled by ToolValidator/Builder depending on API requirements
    }
