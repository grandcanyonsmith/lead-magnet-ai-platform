"""Tool validation and filtering for OpenAI API calls."""
import logging
from typing import List, Dict, Tuple, Optional

logger = logging.getLogger(__name__)


class ToolValidator:
    """Validates and filters tools for OpenAI API compatibility."""
    
    # NOTE: `computer_use_preview` no longer accepts a `container` param in the Responses API.
    # Keep this list minimal; add only when OpenAI explicitly requires it.
    TOOLS_REQUIRING_CONTAINER = {"code_interpreter"}
    
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
        # Validate that tool has a "type" key
        if not isinstance(tool, dict):
            logger.warning(f"Tool is not a dictionary: {tool}")
            return tool
        
        tool_type = tool.get("type")
        
        # Warn if tool type is missing
        if not tool_type:
            logger.warning(f"Tool missing 'type' key: {tool}")
            return tool

        # `computer_use_preview` must NOT include a `container` param (OpenAI returns unknown_parameter).
        if tool_type == "computer_use_preview":
            if "container" in tool:
                logger.info("Removing unsupported container parameter from computer_use_preview tool")
                tool.pop("container", None)
            return tool
        
        # Check if this tool type requires container parameter
        if not ToolValidator.requires_container(tool_type):
            return tool
        
        # Ensure container parameter is present
        if "container" not in tool:
            tool["container"] = {"type": "auto"}
            logger.debug(f"Added container parameter to {tool_type} tool")
        elif not isinstance(tool.get("container"), dict) or "type" not in tool.get("container", {}):
            # Validate container structure if present
            logger.warning(f"Tool {tool_type} has invalid container structure, fixing it")
            tool["container"] = {"type": "auto"}
        
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
        # Check if this is a deep research model
        is_deep_research_model = (
            model and 
            isinstance(model, str) and 
            ('deep-research' in model.lower() or model == 'o4-mini-deep-research')
        )
        
        # Deep research models require at least one of: web_search_preview, mcp, or file_search
        required_tool_types = {'web_search_preview', 'mcp', 'file_search'}
        
        if not tools:
            # If no tools provided and it's a deep research model, add file_search
            if is_deep_research_model:
                logger.info(
                    f"[ToolValidator] Deep research model '{model}' requires at least one of "
                    "web_search_preview, mcp, or file_search. Adding file_search as default."
                )
                return [{"type": "file_search"}], tool_choice
            return [], "none"
        
        validated_tools = []
        
        for idx, tool in enumerate(tools):
            if isinstance(tool, str):
                tool_dict = {"type": tool}
            elif isinstance(tool, dict):
                tool_dict = tool.copy()
            else:
                logger.warning(f"Skipping invalid tool at index {idx}: {tool}")
                continue
            
            # Track if container was added during validation
            tool_type_before = tool_dict.get("type")
            had_container_before = "container" in tool_dict
            
            tool_dict = ToolValidator.ensure_container_parameter(tool_dict)
            
            # Log if container was added
            tool_type_after = tool_dict.get("type")
            has_container_after = "container" in tool_dict
            
            if tool_type_after and ToolValidator.requires_container(tool_type_after):
                if not had_container_before and has_container_after:
                    logger.info(
                        f"Added container parameter to tool[{idx}] ({tool_type_after}) "
                        "during validation"
                    )
                elif had_container_before and not has_container_after:
                    logger.warning(
                        f"Container parameter was removed from tool[{idx}] ({tool_type_after}) "
                        "during validation - this should not happen"
                    )
            
            validated_tools.append(tool_dict)
        
        # For deep research models, ensure at least one required tool is present
        if is_deep_research_model:
            has_required_tool = any(
                tool.get('type') in required_tool_types
                for tool in validated_tools
                if isinstance(tool, dict)
            )
            
            if not has_required_tool:
                logger.warning(
                    f"[ToolValidator] Deep research model '{model}' requires at least one of "
                    "web_search_preview, mcp, or file_search. Adding file_search.",
                    extra={'model': model, 'validated_tools': [t.get('type') for t in validated_tools]}
                )
                validated_tools.append({"type": "file_search"})
        
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
