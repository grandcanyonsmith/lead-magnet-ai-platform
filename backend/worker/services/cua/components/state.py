from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

@dataclass
class AgentState:
    """Manages the state of the CUA Agent."""
    history: List[Dict[str, Any]] = field(default_factory=list)
    screenshots: List[str] = field(default_factory=list)
    context_window: Dict[str, Any] = field(default_factory=dict)
    
    def update_history(self, action: Dict[str, Any], result: Any) -> None:
        """Update agent history with an action and its result."""
        self.history.append({
            "action": action,
            "result": result
        })
        
    def add_screenshot(self, screenshot_path: str) -> None:
        """Add a screenshot path to state."""
        self.screenshots.append(screenshot_path)
