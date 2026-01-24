"""
Computer Use API (CUA) Loop Service
Handles the full CUA loop: execute actions → capture screenshots → send back to model.
"""

import logging
import time
import warnings
from dataclasses import dataclass, field
from typing import Tuple, List, Dict, Any, Optional, Callable

# Suppress Pydantic serialization warnings
warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
warnings.filterwarnings('ignore', message='.*PydanticSerializationUnexpectedValue.*')

from services.cua.environment_factory import (
    resolve_cua_environment_config,
    create_sync_controller,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CUALoopConfig:
    model: str
    instructions: str
    input_text: str
    tools: List[Dict]
    tool_choice: str
    params: Dict[str, Any]
    max_iterations: int
    max_duration_seconds: int
    tenant_id: Optional[str]
    job_id: Optional[str]
    display_width: int
    display_height: int


@dataclass
class CUALoopState:
    iteration: int = 0
    start_time: float = 0.0
    previous_response_id: Optional[str] = None
    last_call_id: Optional[str] = None
    acknowledged_safety_checks: List[Dict[str, Any]] = field(default_factory=list)
    screenshot_urls: List[str] = field(default_factory=list)


class CUALoopRunner:
    def __init__(
        self,
        openai_client: Any,
        browser: Any,
        image_handler: Any,
        time_provider: Callable[[], float],
        sleep_fn: Callable[[float], None],
    ):
        self.openai_client = openai_client
        self.browser = browser
        self.image_handler = image_handler
        self.time_provider = time_provider
        self.sleep_fn = sleep_fn

    def run(self, config: CUALoopConfig) -> Tuple[str, List[str], Dict]:
        state = CUALoopState(start_time=self.time_provider())
        response = None

        try:
            self._initialize_browser(config)

            enhanced_instructions = self._ensure_autonomy_instructions(config.instructions)
            initial_params = self._build_initial_params(config, enhanced_instructions)

            logger.info("[CUALoopService] Making initial CUA request")
            response = self.openai_client.make_api_call(initial_params)
            state.previous_response_id = getattr(response, "id", None)

            while state.iteration < config.max_iterations:
                if self._is_timed_out(state, config):
                    break

                state.iteration += 1
                logger.info(f"[CUALoopService] CUA loop iteration {state.iteration}")

                computer_calls = self._extract_computer_calls(response)
                if not computer_calls:
                    logger.info("[CUALoopService] No more computer calls, CUA loop complete")
                    break

                computer_call = computer_calls[0]
                call_id = getattr(computer_call, "call_id", None)
                action = getattr(computer_call, "action", None)
                pending_safety_checks = getattr(computer_call, "pending_safety_checks", [])

                if not action:
                    logger.warning("[CUALoopService] Computer call has no action, breaking loop")
                    break

                if pending_safety_checks:
                    state.acknowledged_safety_checks = self._acknowledge_safety_checks(
                        pending_safety_checks
                    )

                execution_error = self._execute_action(action)

                self.sleep_fn(1)

                screenshot_b64, screenshot_url, current_url = self._capture_screenshot(
                    config, state
                )
                if not screenshot_b64:
                    logger.error("[CUALoopService] Screenshot capture failed, cannot continue CUA loop")
                    break

                next_input = self._build_next_input(
                    call_id=call_id,
                    screenshot_b64=screenshot_b64,
                    execution_error=execution_error,
                    current_url=current_url,
                    screenshot_url=screenshot_url,
                    acknowledged_safety_checks=state.acknowledged_safety_checks,
                )
                state.acknowledged_safety_checks = []

                next_params = self._build_next_params(
                    initial_params=initial_params,
                    enhanced_instructions=enhanced_instructions,
                    next_input=next_input,
                    previous_response_id=state.previous_response_id,
                )

                logger.info(
                    f"[CUALoopService] Sending screenshot back to model (iteration {state.iteration})"
                )
                response = self.openai_client.make_api_call(next_params)
                state.previous_response_id = getattr(response, "id", None)
                state.last_call_id = call_id

            final_report = response.output_text if hasattr(response, "output_text") else ""
            usage_info = self._extract_usage_info(response)

            logger.info("[CUALoopService] CUA loop complete", extra={
                "iterations": state.iteration,
                "screenshots_captured": len(state.screenshot_urls),
                "final_report_length": len(final_report),
                "total_tokens": usage_info.get("total_tokens", 0),
            })

            return final_report, state.screenshot_urls, usage_info

        except Exception as e:
            logger.error(f"[CUALoopService] Error in CUA loop: {e}", exc_info=True)
            raise
        finally:
            try:
                self.browser.cleanup()
            except Exception as cleanup_error:
                logger.warning(f"[CUALoopService] Error during browser cleanup: {cleanup_error}")

    def _initialize_browser(self, config: CUALoopConfig) -> None:
        self.browser.initialize(display_width=config.display_width, display_height=config.display_height)
        try:
            self.browser.navigate("about:blank")
            logger.info("[CUALoopService] Browser initialized and ready")
        except Exception as nav_error:
            logger.warning(f"[CUALoopService] Failed to navigate to initial page: {nav_error}")

    @staticmethod
    def _ensure_autonomy_instructions(instructions: str) -> str:
        enhanced_instructions = instructions
        if "do not ask for permission" not in enhanced_instructions.lower():
            enhanced_instructions += (
                "\n\n[COMPUTER USE GUIDELINES]\n"
                "1. AUTONOMY: You are an autonomous agent. Do NOT ask for permission to proceed. Do NOT ask 'Should I...?'\n"
                "2. COMPLETION: Execute all necessary steps to achieve the goal fully. Only stop when the request is strictly satisfied.\n"
                "3. IF STUCK: Try alternative paths (e.g. scroll, search, different selectors) before giving up.\n"
                "4. UPLOADS: If the task involves uploading a screenshot, the system automatically uploads it. Use the provided URL.\n"
            )
        return enhanced_instructions

    def _build_initial_params(self, config: CUALoopConfig, enhanced_instructions: str) -> Dict[str, Any]:
        initial_params = (
            dict(config.params)
            if isinstance(config.params, dict) and config.params
            else self.openai_client.build_api_params(
                model=config.model,
                instructions=enhanced_instructions,
                input_text=config.input_text,
                tools=config.tools,
                tool_choice=config.tool_choice,
                has_computer_use=True,
            )
        )
        initial_params["model"] = config.model
        initial_params["instructions"] = enhanced_instructions
        initial_params["input"] = config.input_text
        if "tools" not in initial_params:
            initial_params["tools"] = config.tools
        self._apply_tool_choice(initial_params, config.tool_choice)
        initial_params["truncation"] = "auto"
        return initial_params

    @staticmethod
    def _apply_tool_choice(params: Dict[str, Any], tool_choice: str) -> None:
        if tool_choice and tool_choice != "none":
            if "tools" in params and params["tools"]:
                params["tool_choice"] = tool_choice
            else:
                logger.warning(
                    "[CUALoopService] Not setting tool_choice because tools list is missing or empty in params",
                    extra={"requested_tool_choice": tool_choice},
                )
                params.pop("tool_choice", None)
        else:
            params.pop("tool_choice", None)

    @staticmethod
    def _extract_computer_calls(response: Any) -> List[Any]:
        computer_calls = []
        if hasattr(response, "output") and response.output:
            for item in response.output:
                if hasattr(item, "type") and item.type == "computer_call":
                    computer_calls.append(item)
        return computer_calls

    def _is_timed_out(self, state: CUALoopState, config: CUALoopConfig) -> bool:
        elapsed = self.time_provider() - state.start_time
        if elapsed > config.max_duration_seconds:
            logger.warning(f"[CUALoopService] CUA loop timeout after {elapsed:.1f} seconds")
            return True
        return False

    @staticmethod
    def _acknowledge_safety_checks(pending_safety_checks: List[Any]) -> List[Dict[str, Any]]:
        logger.warning("[CUALoopService] Safety checks triggered: %d", len(pending_safety_checks), extra={
            "safety_checks": [
                {"id": sc.id if hasattr(sc, "id") else None,
                 "code": sc.code if hasattr(sc, "code") else None}
                for sc in pending_safety_checks
            ],
        })
        return [
            {
                "id": sc.id if hasattr(sc, "id") else None,
                "code": sc.code if hasattr(sc, "code") else None,
                "message": sc.message if hasattr(sc, "message") else "",
            }
            for sc in pending_safety_checks
        ]

    def _execute_action(self, action: Any) -> Optional[str]:
        execution_error = None
        try:
            import warnings

            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")
                warnings.filterwarnings("ignore", message=".*PydanticSerializationUnexpectedValue.*")
                action_dict = (
                    action
                    if isinstance(action, dict)
                    else action.model_dump() if hasattr(action, "model_dump") else {}
                )

            action_type = action_dict.get("type", "unknown")
            logger.info("[CUALoopService] Executing action: %s", action_type, extra={"action": action_dict})
            self.browser.execute_action(action_dict)
        except Exception as e:
            logger.error(f"[CUALoopService] Error executing action: {e}", exc_info=True)
            execution_error = str(e)
        return execution_error

    def _capture_screenshot(
        self,
        config: CUALoopConfig,
        state: CUALoopState,
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        screenshot_b64 = None
        current_url = None
        screenshot_url = None
        try:
            screenshot_b64 = self.browser.capture_screenshot()
            current_url = self.browser.get_current_url()

            screenshot_url = self.image_handler.upload_base64_image_to_s3(
                screenshot_b64,
                "image/png",
                tenant_id=config.tenant_id,
                job_id=config.job_id,
            )
            if screenshot_url:
                state.screenshot_urls.append(screenshot_url)
                logger.info(f"[CUALoopService] Screenshot captured and uploaded: {screenshot_url}")
                print(f"🖼️ Object URL: {screenshot_url}", flush=True)
            else:
                logger.warning("[CUALoopService] Failed to upload screenshot")
        except Exception as e:
            logger.error(f"[CUALoopService] Error capturing screenshot: {e}", exc_info=True)
        return screenshot_b64, screenshot_url, current_url

    @staticmethod
    def _build_next_input(
        call_id: Optional[str],
        screenshot_b64: str,
        execution_error: Optional[str],
        current_url: Optional[str],
        screenshot_url: Optional[str],
        acknowledged_safety_checks: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        next_input = [{
            "type": "computer_call_output",
            "call_id": call_id,
            "output": {
                "type": "computer_screenshot",
                "image_url": f"data:image/png;base64,{screenshot_b64}",
            },
        }]

        notes = []
        if execution_error:
            notes.append(f"Computer action failed: {execution_error}")
        if current_url:
            notes.append(f"Current URL: {current_url}")
        if screenshot_url:
            notes.append(f"Screenshot uploaded to: {screenshot_url}")
        if notes:
            next_input.append(
                {
                    "type": "message",
                    "role": "system",
                    "content": [{"type": "input_text", "text": "\n".join(notes)}],
                }
            )

        if acknowledged_safety_checks:
            next_input[0]["acknowledged_safety_checks"] = acknowledged_safety_checks

        return next_input

    @staticmethod
    def _build_next_params(
        initial_params: Dict[str, Any],
        enhanced_instructions: str,
        next_input: List[Dict[str, Any]],
        previous_response_id: Optional[str],
    ) -> Dict[str, Any]:
        next_params = dict(initial_params)
        next_params["instructions"] = enhanced_instructions
        next_params["input"] = next_input
        next_params["truncation"] = "auto"
        if previous_response_id:
            next_params["previous_response_id"] = previous_response_id
        else:
            next_params.pop("previous_response_id", None)
        return next_params

    @staticmethod
    def _extract_usage_info(response: Any) -> Dict[str, Any]:
        usage_info = {}
        if hasattr(response, "usage"):
            usage = response.usage
            usage_info = {
                "input_tokens": usage.input_tokens or 0,
                "output_tokens": usage.output_tokens or 0,
                "total_tokens": usage.total_tokens or 0,
            }
        return usage_info


class CUALoopService:
    """Service for running the Computer Use API loop."""
    
    def __init__(
        self,
        image_handler: Any,
        time_provider: Callable[[], float] = time.time,
        sleep_fn: Callable[[float], None] = time.sleep,
        controller_factory: Callable[[str], Any] = create_sync_controller,
    ):
        """
        Initialize CUA loop service.
        
        Args:
            image_handler: ImageHandler instance for uploading screenshots
        """
        self.image_handler = image_handler
        self._time_provider = time_provider
        self._sleep_fn = sleep_fn
        self._controller_factory = controller_factory
    
    def run_cua_loop(
        self,
        openai_client: Any,
        model: str,
        instructions: str,
        input_text: str,
        tools: List[Dict],
        tool_choice: str,
        params: Dict,
        max_iterations: int = 100,
        max_duration_seconds: int = 900,
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
    ) -> Tuple[str, List[str], Dict]:
        """
        Run the full Computer Use API loop: execute actions → capture screenshots → send back to model.
        
        Args:
            openai_client: OpenAIClient instance
            model: Model name (should be 'computer-use-preview')
            instructions: System instructions
            input_text: Initial input text
            tools: List of tools (should include computer_use_preview)
            tool_choice: Tool choice setting
            params: API parameters dict
            max_iterations: Maximum number of loop iterations
            max_duration_seconds: Maximum duration in seconds
            
        Returns:
            Tuple of (final_report_text, screenshot_urls, usage_info)
        """
        logger.info(f"[CUALoopService] Starting CUA loop", extra={
            'model': model,
            'max_iterations': max_iterations,
            'max_duration_seconds': max_duration_seconds
        })
        
        # Extract computer_use_preview tool config
        computer_use_tool_present = any(
            (isinstance(t, str) and t == "computer_use_preview")
            or (isinstance(t, dict) and t.get("type") == "computer_use_preview")
            for t in tools
        )
        if not computer_use_tool_present:
            raise ValueError("computer_use_preview tool not found in tools list")

        env_config = resolve_cua_environment_config(tools)
        display_width = env_config.display_width
        display_height = env_config.display_height
        environment_name = env_config.environment
        logger.info(
            f"[CUALoopService] Using CUA environment: {environment_name}",
            extra={"display_width": display_width, "display_height": display_height},
        )
        
        browser = self._controller_factory(environment_name)
        config = CUALoopConfig(
            model=model,
            instructions=instructions,
            input_text=input_text,
            tools=tools,
            tool_choice=tool_choice,
            params=params,
            max_iterations=max_iterations,
            max_duration_seconds=max_duration_seconds,
            tenant_id=tenant_id,
            job_id=job_id,
            display_width=display_width,
            display_height=display_height,
        )
        runner = CUALoopRunner(
            openai_client=openai_client,
            browser=browser,
            image_handler=self.image_handler,
            time_provider=self._time_provider,
            sleep_fn=self._sleep_fn,
        )
        return runner.run(config)

