from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple

class Environment(ABC):
    """Abstract base class for CUA environments."""

    @abstractmethod
    async def initialize(self, display_width: int = 1024, display_height: int = 768) -> None:
        """Initialize the environment."""
        pass

    @abstractmethod
    async def execute_action(self, action: Dict[str, Any]) -> None:
        """Execute a computer action."""
        pass

    @abstractmethod
    async def capture_screenshot(self) -> str:
        """Capture screenshot and return base64 string."""
        pass

    @abstractmethod
    async def get_current_url(self) -> Optional[str]:
        """Get the current URL (if applicable)."""
        pass

    @abstractmethod
    async def cleanup(self) -> None:
        """Cleanup resources."""
        pass

    @abstractmethod
    async def is_healthy(self) -> bool:
        """Check if environment is healthy."""
        pass

