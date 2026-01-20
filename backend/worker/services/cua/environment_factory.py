import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


def _coerce_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _normalize_environment(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = str(value).strip().lower()
    if normalized in ("playwright", "browser"):
        return "playwright"
    if normalized in ("docker", "docker_vm", "dockervm", "container"):
        return "docker_vm"
    return None


def _find_computer_use_tool(tools: List[Dict]) -> Optional[Dict[str, Any]]:
    for tool in tools or []:
        tool_type = tool.get("type") if isinstance(tool, dict) else tool
        if tool_type == "computer_use_preview":
            return tool if isinstance(tool, dict) else {"type": tool_type}
    return None


@dataclass(frozen=True)
class CUAEnvironmentConfig:
    environment: str
    display_width: int
    display_height: int


def resolve_cua_environment_config(
    tools: List[Dict],
    default_env: Optional[str] = None,
) -> CUAEnvironmentConfig:
    tool = _find_computer_use_tool(tools)
    display_width = _coerce_int(tool.get("display_width", 1024), 1024) if tool else 1024
    display_height = _coerce_int(tool.get("display_height", 768), 768) if tool else 768
    tool_env = tool.get("environment") if tool else None

    env_name = _normalize_environment(tool_env)
    if not env_name:
        env_name = _normalize_environment(os.environ.get("CUA_ENVIRONMENT") or default_env)
    if not env_name:
        env_name = "playwright"

    return CUAEnvironmentConfig(
        environment=env_name,
        display_width=display_width,
        display_height=display_height,
    )


def create_async_environment(environment_name: str):
    if environment_name == "docker_vm":
        from services.cua.drivers.docker_vm import DockerVMEnvironment

        return DockerVMEnvironment()

    from services.cua.drivers.playwright import PlaywrightEnvironment

    return PlaywrightEnvironment()


def create_sync_controller(environment_name: str):
    if environment_name == "docker_vm":
        from services.cua.drivers.docker_vm import DockerVMController

        return DockerVMController()

    from services.browser_service import BrowserService

    return BrowserService()
