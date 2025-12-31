from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union

@dataclass
class CUAEvent:
    type: str
    timestamp: float

@dataclass
class LogEvent(CUAEvent):
    level: str
    message: str
    extra: Optional[Dict[str, Any]] = None

@dataclass
class ActionCallEvent(CUAEvent):
    call_id: str
    action: Dict[str, Any]
    thought: Optional[str] = None

@dataclass
class ScreenshotEvent(CUAEvent):
    url: str
    base64: Optional[str] = None # Optional, maybe we don't stream base64 if url is present
    current_url: Optional[str] = None

@dataclass
class LoopCompleteEvent(CUAEvent):
    final_text: str
    screenshots: List[str]
    usage: Dict[str, Any]
    reason: str # 'completed' | 'max_iterations' | 'timeout' | 'error'

@dataclass
class SafetyCheckEvent(CUAEvent):
    checks: List[Dict[str, Any]]
    action_call_id: str
    action: Dict[str, Any]

@dataclass
class ActionExecutedEvent(CUAEvent):
    action_type: str
    success: bool
    error: Optional[str] = None

