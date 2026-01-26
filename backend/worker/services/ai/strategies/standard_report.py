from datetime import datetime
import json
import time
from typing import Optional, Dict, Any, Tuple

from core.logger import get_logger
from services.ai.report_context import ReportContext
from services.image_handler import ImageHandler
from services.openai_client import OpenAIClient

logger = get_logger(__name__)

class StandardReportStrategy:
    def __init__(
        self,
        openai_client: OpenAIClient,
        image_handler: ImageHandler,
        db_service: Optional[Any],
    ):
        self.openai_client = openai_client
        self.image_handler = image_handler
        self.db_service = db_service

    def can_handle(self, ctx: ReportContext) -> bool:
        return True

    def execute(self, ctx: ReportContext) -> Tuple[str, Dict, Dict, Dict]:
        try:
            logger.debug("[ReportGenerator] About to build API params", extra={
                "model": ctx.model,
                "normalized_tool_choice": ctx.normalized_tool_choice,
                "validated_tools_count": len(ctx.validated_tools) if ctx.validated_tools else 0,
            })

            params = self.openai_client.build_api_params(
                model=ctx.model,
                instructions=ctx.instructions,
                input_text=ctx.input_text,
                tools=ctx.validated_tools,
                tool_choice=ctx.normalized_tool_choice,
                has_computer_use=ctx.has_computer_use,
                reasoning_level=None,
                previous_image_urls=ctx.previous_image_urls if ctx.has_image_generation else None,
                job_id=ctx.job_id,
                tenant_id=ctx.tenant_id,
                reasoning_effort=ctx.reasoning_effort,
                text_verbosity=ctx.text_verbosity,
                max_output_tokens=ctx.max_output_tokens,
                service_tier=ctx.service_tier,
                output_format=ctx.output_format,
            )

            logger.info("[ReportGenerator] Making OpenAI API call", extra={
                "model": ctx.model,
                "has_tools": "tools" in params,
                "tools_count": len(params.get("tools", [])) if "tools" in params else 0,
                "has_tool_choice": "tool_choice" in params,
                "tool_choice": params.get("tool_choice"),
            })

            step_order = (ctx.step_index + 1) if isinstance(ctx.step_index, int) else None
            should_stream_live = (
                self.db_service is not None
                and isinstance(ctx.job_id, str)
                and ctx.job_id.strip() != ""
                and isinstance(step_order, int)
                and step_order > 0
                and not ctx.has_computer_use
                and not ctx.has_shell
                and self.openai_client.supports_responses()
            )

            if should_stream_live:
                logger.info("[ReportGenerator] Using streamed Responses API call", extra={
                    "job_id": ctx.job_id,
                    "tenant_id": ctx.tenant_id,
                    "step_order": step_order,
                })
                response = self._make_streamed_call(ctx.job_id, step_order, params)
            else:
                response = self.openai_client.make_api_call(params)

            return self.openai_client.process_api_response(
                response=response,
                model=ctx.model,
                instructions=ctx.instructions,
                input_text=ctx.input_text,
                previous_context=ctx.previous_context,
                context=ctx.context,
                tools=ctx.validated_tools,
                tool_choice=ctx.normalized_tool_choice,
                params=params,
                image_handler=self.image_handler,
                tenant_id=ctx.tenant_id,
                job_id=ctx.job_id,
                step_name=ctx.step_name,
                step_instructions=ctx.step_instructions,
            )

        except Exception as e:
            return self.openai_client.handle_openai_error(
                error=e,
                model=ctx.model,
                tools=ctx.validated_tools,
                tool_choice=ctx.normalized_tool_choice,
                instructions=ctx.instructions,
                context=ctx.context,
                full_context=ctx.full_context,
                previous_context=ctx.previous_context,
                image_handler=self.image_handler,
            )

    def _make_streamed_call(self, job_id: str, step_order: int, params: Dict[str, Any]) -> Any:
        logger.info("[ReportGenerator] Streaming Responses API output_text deltas", extra={
            "job_id": job_id,
            "step_order": step_order,
        })

        if not self.openai_client.supports_responses():
            logger.warning("[ReportGenerator] Responses API unavailable; falling back to non-streaming call", extra={
                "job_id": job_id,
                "step_order": step_order,
            })
            response = self.openai_client.make_api_call(params)
            output_text = getattr(response, "output_text", "") or ""
            if not output_text and hasattr(response, "choices") and response.choices:
                output_text = response.choices[0].message.content or ""
            if self.db_service:
                try:
                    self.db_service.update_job(job_id, {"live_step": {
                        "step_order": step_order,
                        "output_text": output_text,
                        "updated_at": datetime.utcnow().isoformat(),
                        "status": "final",
                    }})
                except Exception as persist_err:
                    logger.debug("[ReportGenerator] Failed to persist live_step (fallback)", extra={
                        "job_id": job_id,
                        "step_order": step_order,
                        "error_type": type(persist_err).__name__,
                        "error_message": str(persist_err),
                    })
            return response

        max_chars = 100_000
        output_so_far = ""
        tool_log_so_far = ""
        last_persist_ts = 0.0
        last_persist_len = 0
        has_code_interpreter = False
        code_log_started = False
        code_delta_buffer = ""
        code_delta_flush_at = 0.0
        code_delta_flush_interval = 0.2
        tool_call_seen: set[str] = set()
        tool_output_seen: set[str] = set()

        def _truncate(text: str) -> Tuple[str, bool]:
            if len(text) <= max_chars:
                return text, False
            return text[-max_chars:], True

        def _compose_preview() -> str:
            if tool_log_so_far:
                tool_block = tool_log_so_far
                if output_so_far:
                    if "[tool output]" in tool_log_so_far.lower():
                        return f"{output_so_far}\n\n{tool_block}"
                    return f"{output_so_far}\n\n[Tool output]\n{tool_block}"
                return tool_block
            return output_so_far

        def _get_attr(obj: Any, key: str) -> Any:
            if isinstance(obj, dict):
                return obj.get(key)
            return getattr(obj, key, None)

        def _normalize_type(value: Any) -> str:
            if value is None:
                return ""
            if isinstance(value, str):
                return value
            if hasattr(value, "value"):
                try:
                    return str(value.value)
                except Exception:
                    return str(value)
            return str(value)

        def _stringify_output(value: Any) -> str:
            if value is None:
                return ""
            if isinstance(value, str):
                return value
            try:
                return json.dumps(value, ensure_ascii=True, indent=2)
            except Exception:
                return str(value)

        def _persist(status: str = "streaming", error: Optional[str] = None, force: bool = False) -> None:
            nonlocal last_persist_ts, last_persist_len
            if not self.db_service:
                return
            preview_text = _compose_preview()
            now = time.time()
            if not force:
                if (now - last_persist_ts) < 0.5 and (len(preview_text) - last_persist_len) < 1024:
                    return
            last_persist_ts = now
            last_persist_len = len(preview_text)

            truncated_text, truncated = _truncate(preview_text)
            live_step: Dict[str, Any] = {
                "step_order": step_order,
                "output_text": truncated_text,
                "updated_at": datetime.utcnow().isoformat(),
                "status": status,
            }
            if truncated:
                live_step["truncated"] = True
            if error:
                live_step["error"] = error
            try:
                self.db_service.update_job(job_id, {"live_step": live_step})
            except Exception as persist_err:
                logger.debug("[ReportGenerator] Failed to persist live_step", extra={
                    "job_id": job_id,
                    "step_order": step_order,
                    "error_type": type(persist_err).__name__,
                    "error_message": str(persist_err),
                })

        def _extract_tool_label(item: Any) -> Optional[str]:
            tool_name = (
                _get_attr(item, "tool_name")
                or _get_attr(item, "name")
            )
            if not tool_name:
                func = _get_attr(item, "function")
                tool_name = _get_attr(func, "name") if func else None
            if not tool_name:
                tool_name = _get_attr(item, "server_label") or _get_attr(item, "server")
            if tool_name:
                try:
                    return str(tool_name)
                except Exception:
                    return None
            return None

        def _extract_tool_output_text(item: Any) -> str:
            output = (
                _get_attr(item, "output")
                or _get_attr(item, "result")
                or _get_attr(item, "outputs")
                or _get_attr(item, "content")
            )
            if output is None:
                return ""
            outputs_list = output if isinstance(output, list) else [output]
            parts: list[str] = []
            for entry in outputs_list:
                if isinstance(entry, dict):
                    value = (
                        entry.get("text")
                        or entry.get("content")
                        or entry.get("output")
                        or entry.get("result")
                        or entry.get("logs")
                        or entry.get("error")
                    )
                    if value is None:
                        parts.append(_stringify_output(entry))
                    else:
                        parts.append(_stringify_output(value))
                else:
                    parts.append(_stringify_output(entry))
            return "\n".join([p for p in parts if p])

        def _append_tool_log(message: str, tool_name: Optional[str] = None, call_id: Optional[str] = None) -> None:
            nonlocal tool_log_so_far
            if not message:
                return
            if "[tool output]" not in tool_log_so_far.lower():
                if tool_log_so_far and not tool_log_so_far.endswith("\n"):
                    tool_log_so_far += "\n"
                tool_log_so_far += "[Tool output]\n"
            if tool_name or call_id:
                label = tool_name or "tool"
                if call_id:
                    label = f"{label} ({call_id})"
                tool_log_so_far += f"{label}:\n"
            tool_log_so_far += message
            if not message.endswith("\n"):
                tool_log_so_far += "\n"
            _persist(status="streaming", force=False)

        _persist(status="streaming", force=True)

        def _is_incomplete_openai_stream_error(err: Exception) -> bool:
            try:
                msg = str(err) or ""
            except Exception:
                msg = ""
            lower = msg.lower()
            if "response.completed" in lower and ("didn't receive" in lower or "did not receive" in lower):
                return True
            if type(err).__name__ in ("APIConnectionError", "APITimeoutError", "ReadTimeout", "ConnectTimeout"):
                return True
            return False

        api_params = (
            self.openai_client._sanitize_api_params(params)
            if hasattr(self.openai_client, "_sanitize_api_params")
            else dict(params)
        )

        tools_param = api_params.get("tools")
        if isinstance(tools_param, list):
            for tool in tools_param:
                if isinstance(tool, dict) and tool.get("type") == "code_interpreter":
                    has_code_interpreter = True
                    break

        max_stream_attempts = 2
        for attempt in range(1, max_stream_attempts + 1):
            if attempt > 1:
                output_so_far = ""
                tool_log_so_far = ""
                tool_call_seen.clear()
                tool_output_seen.clear()
                code_log_started = False
                code_delta_buffer = ""
                code_delta_flush_at = 0.0
                _persist(status="retrying", error="Retrying OpenAI stream…", force=True)

            try:
                try:
                    responses_client = self.openai_client.client.responses
                    stream_fn = getattr(responses_client, "stream", None)
                    if not callable(stream_fn):
                        raise AttributeError("Responses API stream unavailable")
                except AttributeError as stream_err:
                    logger.warning("[ReportGenerator] Responses API unavailable during stream; falling back", extra={
                        "job_id": job_id,
                        "step_order": step_order,
                        "error_message": str(stream_err),
                    })
                    response = self.openai_client.make_api_call(params)
                    output_so_far = getattr(response, "output_text", "") or output_so_far
                    _persist(status="final", force=True)
                    return response

                with stream_fn(**api_params) as stream:
                    for ev in stream:
                        ev_type = getattr(ev, "type", "") or ""
                        if ev_type == "response.output_text.delta":
                            delta = getattr(ev, "delta", "") or ""
                            if not delta:
                                continue
                            output_so_far += delta
                            _persist(status="streaming", force=False)
                            continue

                        if ev_type == "response.output_item.added":
                            item = _get_attr(ev, "item")
                            item_type = _normalize_type(_get_attr(item, "type"))
                            if item_type == "code_interpreter_call":
                                if has_code_interpreter:
                                    tool_log_so_far += "\n[Code interpreter] call started.\n"
                                    _persist(status="streaming", force=False)
                                continue
                            if item_type in (
                                "tool_call",
                                "tool_calls",
                                "function_call",
                                "tool_call_output",
                                "function_call_output",
                            ):
                                tool_name = _extract_tool_label(item)
                                call_id = _get_attr(item, "call_id") or _get_attr(item, "id")
                                call_id_key = str(call_id) if call_id else None
                                if call_id_key:
                                    if call_id_key in tool_call_seen:
                                        continue
                                    tool_call_seen.add(call_id_key)
                                _append_tool_log(
                                    f"Calling {tool_name or 'tool'}...",
                                    tool_name=tool_name,
                                    call_id=call_id_key,
                                )
                            continue

                        if ev_type == "response.output_item.done":
                            item = _get_attr(ev, "item")
                            item_type = _normalize_type(_get_attr(item, "type"))
                            if item_type == "code_interpreter_call":
                                if not has_code_interpreter:
                                    continue
                                outputs = _get_attr(item, "outputs") or []
                                if isinstance(outputs, list):
                                    for output in outputs:
                                        output_type = _get_attr(output, "type")
                                        if output_type == "logs":
                                            logs = _get_attr(output, "logs") or ""
                                            if logs:
                                                tool_log_so_far += "\n[Code interpreter logs]\n"
                                                tool_log_so_far += str(logs)
                                                if not str(logs).endswith("\n"):
                                                    tool_log_so_far += "\n"
                                        elif output_type == "error":
                                            error_message = _get_attr(output, "error") or ""
                                            if error_message:
                                                tool_log_so_far += "\n[Code interpreter error]\n"
                                                tool_log_so_far += str(error_message)
                                                if not str(error_message).endswith("\n"):
                                                    tool_log_so_far += "\n"
                                _persist(status="streaming", force=False)
                                continue
                            if item_type in (
                                "tool_call",
                                "tool_calls",
                                "function_call",
                                "tool_call_output",
                                "function_call_output",
                            ):
                                tool_name = _extract_tool_label(item)
                                call_id = _get_attr(item, "call_id") or _get_attr(item, "id")
                                call_id_key = str(call_id) if call_id else None
                                if call_id_key and call_id_key in tool_output_seen:
                                    continue
                                if call_id_key:
                                    tool_output_seen.add(call_id_key)
                                output_text = _extract_tool_output_text(item)
                                if output_text:
                                    _append_tool_log(
                                        output_text,
                                        tool_name=tool_name,
                                        call_id=call_id_key,
                                    )
                                else:
                                    error_message = _get_attr(item, "error") or _get_attr(item, "status")
                                    if error_message:
                                        _append_tool_log(
                                            _stringify_output(error_message),
                                            tool_name=tool_name,
                                            call_id=call_id_key,
                                        )
                            continue

                        if not has_code_interpreter:
                            continue

                        if ev_type == "response.code_interpreter_call_code.delta":
                            delta = getattr(ev, "delta", "") or ""
                            if not delta:
                                continue
                            if not code_log_started:
                                code_log_started = True
                                tool_log_so_far += "[Code interpreter]\n"
                            code_delta_buffer += delta
                            now = time.time()
                            should_flush = (
                                "\n" in code_delta_buffer
                                or len(code_delta_buffer) >= 160
                                or (now - code_delta_flush_at) >= code_delta_flush_interval
                            )
                            if should_flush:
                                tool_log_so_far += code_delta_buffer
                                code_delta_buffer = ""
                                code_delta_flush_at = now
                                _persist(status="streaming", force=False)
                            continue

                        if ev_type == "response.code_interpreter_call_code.done":
                            if code_delta_buffer:
                                tool_log_so_far += code_delta_buffer
                                code_delta_buffer = ""
                            tool_log_so_far += "\n"
                            _persist(status="streaming", force=False)
                            continue

                        if ev_type == "response.code_interpreter_call.in_progress":
                            tool_log_so_far += "\n[Code interpreter] preparing...\n"
                            _persist(status="streaming", force=False)
                            continue

                        if ev_type == "response.code_interpreter_call.interpreting":
                            tool_log_so_far += "\n[Code interpreter] running...\n"
                            _persist(status="streaming", force=False)
                            continue

                        if ev_type == "response.code_interpreter_call.completed":
                            tool_log_so_far += "\n[Code interpreter] completed.\n"
                            _persist(status="streaming", force=False)
                            continue
                    if code_delta_buffer:
                        tool_log_so_far += code_delta_buffer
                        code_delta_buffer = ""
                    response = stream.get_final_response()

                _persist(status="final", force=True)
                logger.info("[ReportGenerator] Stream complete", extra={
                    "job_id": job_id,
                    "step_order": step_order,
                    "output_chars": len(output_so_far),
                })
                return response

            except Exception as stream_err:
                if _is_incomplete_openai_stream_error(stream_err) and attempt < max_stream_attempts:
                    logger.warning("[ReportGenerator] Stream ended early; retrying", extra={
                        "job_id": job_id,
                        "step_order": step_order,
                        "attempt": attempt,
                        "max_attempts": max_stream_attempts,
                        "error_type": type(stream_err).__name__,
                        "error_message": str(stream_err),
                    })
                    _persist(status="retrying", error=str(stream_err), force=True)
                    time.sleep(0.75 * attempt)
                    continue

                if _is_incomplete_openai_stream_error(stream_err):
                    logger.warning("[ReportGenerator] Stream ended early; falling back to non-streaming call", extra={
                        "job_id": job_id,
                        "step_order": step_order,
                        "attempt": attempt,
                        "max_attempts": max_stream_attempts,
                        "error_type": type(stream_err).__name__,
                        "error_message": str(stream_err),
                    })
                    response = self.openai_client.client.responses.create(**api_params)
                    output_so_far = getattr(response, "output_text", "") or output_so_far
                    _persist(status="final", force=True)
                    return response

                _persist(status="error", error=str(stream_err), force=True)
                raise
