"""Tool building and cleaning utilities for OpenAI API."""
import logging
from typing import Dict, List, Optional

from utils.decimal_utils import convert_decimals_to_int
from services.tool_validator import ToolValidator

logger = logging.getLogger(__name__)


class ToolBuilder:
    """Handles tool cleaning, validation, and container parameter logic."""
    
    @staticmethod
    def clean_tools(tools: List[Dict]) -> List[Dict]:
        """
        Clean tools before sending to OpenAI API.
        
        - Keep container parameter (required by API for code_interpreter and computer_use_preview)
        - Recursively convert all Decimal values to int (for display_width, display_height, etc.)
        
        Args:
            tools: List of tool dictionaries
            
        Returns:
            List of cleaned tool dictionaries
        """
        cleaned_tools = []
        
        for idx, tool in enumerate(tools):
            if isinstance(tool, dict):
                cleaned_tool = tool.copy()
                
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
                
                cleaned_tools.append(cleaned_tool)
            else:
                cleaned_tools.append(tool)
        
        return cleaned_tools

