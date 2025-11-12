"""Tool validation and filtering for OpenAI API calls."""
import logging
from typing import List, Dict, Tuple, Optional

logger = logging.getLogger(__name__)


class ToolValidator:
    """Validates and filters tools for OpenAI API compatibility."""
    
    TOOLS_REQUIRING_CONTAINER = {"code_interpreter", "computer_use_preview"}
    
    @staticmethod
    def requires_container(tool_type: str) -> bool:
        """
        Check if a tool type requires a container parameter.
        
        Args:
            tool_type: The tool type to check
            
        Returns:
            True if container parameter is required
        """
        return tool_type in ToolValidator.TOOLS_REQUIRING_CONTAINER
    
    @staticmethod
    def ensure_container_parameter(tool: Dict) -> Dict:
        """
        Ensure container parameter is present for tools that require it.
        
        Args:
            tool: Tool dictionary
            
        Returns:
            Tool dictionary with container parameter added if needed
        """
        tool_type = tool.get("type")
        
        if not ToolValidator.requires_container(tool_type):
            return tool
        
        if "container" not in tool:
            tool["container"] = {"type": "auto"}
            logger.debug(f"Added container parameter to {tool_type} tool")
        
        return tool
    
    @staticmethod
    def validate_and_filter_tools(
        tools: Optional[List], 
        tool_choice: str = "auto",
        model: Optional[str] = None
    ) -> Tuple[List[Dict], str]:
        """
        Validate and filter tools, ensuring container parameters are added where needed.
        
        Args:
            tools: List of tools (can be strings or dicts)
            tool_choice: Tool choice setting
            model: Optional model name for compatibility checks
            
        Returns:
            Tuple of (validated_tools, normalized_tool_choice)
        """
        if not tools:
            return [], "none"
        
        validated_tools = []
        
        for tool in tools:
            if isinstance(tool, str):
                tool_dict = {"type": tool}
            elif isinstance(tool, dict):
                tool_dict = tool.copy()
            else:
                logger.warning(f"Skipping invalid tool: {tool}")
                continue
            
            tool_dict = ToolValidator.ensure_container_parameter(tool_dict)
            validated_tools.append(tool_dict)
        
        if not validated_tools:
            normalized_tool_choice = "none"
        elif tool_choice == "required":
            normalized_tool_choice = "required"
        elif tool_choice == "auto":
            normalized_tool_choice = "auto"
        else:
            normalized_tool_choice = "auto"
        
        return validated_tools, normalized_tool_choice
    
    @staticmethod
    def has_image_generation(tools: Optional[List[Dict]]) -> bool:
        """Check if image_generation tool is in the tools list."""
        if not tools:
            return False
        return any(
            tool.get("type") == "image_generation" 
            for tool in tools 
            if isinstance(tool, dict)
        )
    
    @staticmethod
    def has_computer_use(tools: Optional[List[Dict]]) -> bool:
        """Check if computer_use_preview tool is in the tools list."""
        if not tools:
            return False
        return any(
            tool.get("type") == "computer_use_preview" 
            for tool in tools 
            if isinstance(tool, dict)
        )
