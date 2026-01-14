"""Tool building and cleaning utilities for OpenAI API."""
import logging
from typing import Dict, List

from utils.decimal_utils import convert_decimals_to_int
from .validator import ToolValidator
from .definitions import (
    get_image_generation_defaults,
    get_file_search_tool_definition,
    get_code_interpreter_tool_definition,
    get_computer_use_tool_definition
)

logger = logging.getLogger(__name__)


class ToolBuilder:
    """Handles tool cleaning, validation, and container parameter logic."""
    
    @staticmethod
    def clean_tools(tools: List[Dict]) -> List[Dict]:
        """
        Clean tools before sending to OpenAI API.
        
        - Keep container parameter ONLY when explicitly required by the API (e.g. code_interpreter)
        - Strip unsupported container parameter from computer_use_preview
        - Recursively convert all Decimal values to int (for display_width, display_height, etc.)
        
        Args:
            tools: List of tool dictionaries
            
        Returns:
            List of cleaned tool dictionaries
        """
        cleaned_tools = []
        
        for idx, tool in enumerate(tools):
            # Convert string tools to dict format first
            if isinstance(tool, str):
                if tool == 'image_generation':
                    # Convert image_generation string to object with defaults
                    tool = get_image_generation_defaults()
                elif tool == 'shell':
                    # Use native Responses API tool type.
                    tool = {"type": "shell"}
                elif tool == 'web_search':
                    # Use native Responses API tool type.
                    tool = {"type": "web_search"}
                elif tool == 'web_search_preview':
                    tool = {"type": "web_search_preview"}
                elif tool == 'file_search':
                    tool = get_file_search_tool_definition()
                elif tool == 'code_interpreter':
                    tool = get_code_interpreter_tool_definition()
                elif tool == 'computer_use_preview':
                    tool = get_computer_use_tool_definition()
                else:
                    tool = {"type": tool}
            
            if isinstance(tool, dict):
                cleaned_tool = tool.copy()
                
                # Also handle if it came in as a dict with type="shell"
                if cleaned_tool.get("type") == "shell":
                    # Keep native Responses API tool type.
                    cleaned_tool = {"type": "shell"}
                
                # Keep native Responses API tool types for web search.
                if cleaned_tool.get("type") == "web_search":
                    cleaned_tool = {"type": "web_search"}
                if cleaned_tool.get("type") == "web_search_preview":
                    cleaned_tool = {"type": "web_search_preview"}

                # OpenAI rejects `container` on `computer_use_preview` (unknown_parameter).
                if cleaned_tool.get("type") == "computer_use_preview" and "container" in cleaned_tool:
                    logger.info(
                        f"Removing unsupported container parameter from tool[{idx}] (computer_use_preview)"
                    )
                    cleaned_tool.pop("container", None)

                # Defensive check: Ensure container parameter is present for tools that require it
                tool_type = cleaned_tool.get("type")
                if tool_type and ToolValidator.requires_container(tool_type):
                    if "container" not in cleaned_tool:
                        logger.warning(
                            f"Missing container parameter for tool[{idx}] ({tool_type}), "
                            "adding it defensively. This should have been caught by validation."
                        )
                        cleaned_tool["container"] = {"type": "auto"}
                    elif not isinstance(cleaned_tool.get("container"), dict) or "type" not in cleaned_tool.get("container", {}):
                        logger.warning(
                            f"Invalid container structure for tool[{idx}] ({tool_type}), "
                            "fixing it defensively."
                        )
                        cleaned_tool["container"] = {"type": "auto"}
                
                # Recursively convert ALL Decimal values to int throughout the tool dictionary
                cleaned_tool = convert_decimals_to_int(cleaned_tool)
                
                # Final verification: Double-check container is still present after conversion
                if tool_type and ToolValidator.requires_container(tool_type):
                    if "container" not in cleaned_tool:
                        logger.error(
                            f"Container parameter lost during conversion for tool[{idx}] ({tool_type}), "
                            "re-adding it."
                        )
                        cleaned_tool["container"] = {"type": "auto"}
                
                # Validate and preserve image_generation tool parameters
                if tool_type == "image_generation":
                    # Default to the latest image model unless explicitly overridden
                    if "model" not in cleaned_tool:
                        cleaned_tool["model"] = "gpt-image-1.5"
                    # Set defaults for image_generation if not provided
                    if "size" not in cleaned_tool:
                        cleaned_tool["size"] = "auto"
                    if "quality" not in cleaned_tool:
                        cleaned_tool["quality"] = "auto"
                    if "background" not in cleaned_tool:
                        cleaned_tool["background"] = "auto"
                    
                    # Validate parameter values
                    valid_sizes = ["1024x1024", "1024x1536", "1536x1024", "auto"]
                    if cleaned_tool.get("size") not in valid_sizes:
                        logger.warning(f"Invalid size '{cleaned_tool.get('size')}' for image_generation tool, using 'auto'")
                        cleaned_tool["size"] = "auto"
                    
                    valid_qualities = ["low", "medium", "high", "auto"]
                    if cleaned_tool.get("quality") not in valid_qualities:
                        logger.warning(f"Invalid quality '{cleaned_tool.get('quality')}' for image_generation tool, using 'auto'")
                        cleaned_tool["quality"] = "auto"
                    
                    valid_backgrounds = ["transparent", "opaque", "auto"]
                    if cleaned_tool.get("background") not in valid_backgrounds:
                        logger.warning(f"Invalid background '{cleaned_tool.get('background')}' for image_generation tool, using 'auto'")
                        cleaned_tool["background"] = "auto"
                    
                    valid_formats = ["png", "jpeg", "webp"]
                    if "format" in cleaned_tool and cleaned_tool.get("format") not in valid_formats:
                        logger.warning(f"Invalid format '{cleaned_tool.get('format')}' for image_generation tool, removing")
                        del cleaned_tool["format"]
                    
                    if "compression" in cleaned_tool:
                        compression = cleaned_tool.get("compression")
                        if not isinstance(compression, (int, float)) or compression < 0 or compression > 100:
                            logger.warning(f"Invalid compression '{compression}' for image_generation tool (must be 0-100), removing")
                            del cleaned_tool["compression"]
                    
                    valid_fidelities = ["low", "high"]
                    if "input_fidelity" in cleaned_tool and cleaned_tool.get("input_fidelity") not in valid_fidelities:
                        logger.warning(f"Invalid input_fidelity '{cleaned_tool.get('input_fidelity')}' for image_generation tool, removing")
                        del cleaned_tool["input_fidelity"]
                    
                    logger.debug("[Tool Builder] Preserved image_generation tool config", extra={
                        'tool_config': cleaned_tool
                    })
                
                cleaned_tools.append(cleaned_tool)
            else:
                cleaned_tools.append(tool)
        
        return cleaned_tools
