from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple

class Environment(ABC):
    """Abstract base class for CUA environments."""

    @abstractmethod
    def initialize(self, display_width: int = 1024, display_height: int = 768) -> None:
        """Initialize the environment."""
        pass

    @abstractmethod
    def execute_action(self, action: Dict[str, Any]) -> None:
        """Execute a computer action."""
        pass

    @abstractmethod
    def capture_screenshot(self) -> str:
        """Capture screenshot and return base64 string."""
        pass

    @abstractmethod
    def get_current_url(self) -> Optional[str]:
        """Get the current URL (if applicable)."""
        pass

    @abstractmethod
    def cleanup(self) -> None:
        """Cleanup resources."""
        pass

    @abstractmethod
    def is_healthy(self) -> bool:
        """Check if environment is healthy."""
        pass

