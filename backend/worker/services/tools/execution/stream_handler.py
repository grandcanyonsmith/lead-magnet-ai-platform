import time
import logging
from typing import Any, Dict, Generator, Optional, Tuple

from services.cua.types import LogEvent
from .agent_utils import get_responses_client, is_incomplete_openai_stream_error

logger = logging.getLogger(__name__)

class StreamHandler:
    """Handles streaming responses from OpenAI with retries and fallbacks."""

    def __init__(self, openai_client: Any):
        self.openai_client = openai_client
        self.responses_client = get_responses_client(openai_client)
        self.last_streamed_output_text = ""
        self.final_response = None

    def stream_response(
        self, 
        api_params: Dict[str, Any], 
        fallback_params: Dict[str, Any],
        max_attempts: int = 2
    ) -> Generator[LogEvent, None, Any]:
        """
        Stream response from OpenAI, yielding LogEvents for output deltas.
        Returns the final response object.
        """
        self.last_streamed_output_text = ""
        self.final_response = None
        
        for attempt in range(1, max_attempts + 1):
            buffer = ""
            last_flush = time.time()
            try:
                stream_fn = getattr(self.responses_client, "stream", None)
                if not callable(stream_fn):
                    raise AttributeError("Responses API stream unavailable")
                
                with stream_fn(**api_params) as stream:
                    for ev in stream:
                        ev_type = getattr(ev, "type", "") or ""
                        if ev_type == "response.output_text.delta":
                            delta = getattr(ev, "delta", "") or ""
                            if not delta:
                                continue
                            self.last_streamed_output_text += delta
                            buffer += delta
                            now = time.time()
                            if "\n" in buffer or len(buffer) >= 80 or (now - last_flush) >= 0.2:
                                yield LogEvent(
                                    type="log", timestamp=time.time(), level="info",
                                    message=f"__OUTPUT_DELTA__{buffer}",
                                )
                                buffer = ""
                                last_flush = now

                    self.final_response = stream.get_final_response()
                
                # Success
                break
                
            except Exception as stream_err:
                # Flush remaining buffer
                if buffer:
                    yield LogEvent(
                        type="log", timestamp=time.time(), level="info",
                        message=f"__OUTPUT_DELTA__{buffer}",
                    )
                    buffer = ""

                # Handle specific errors
                if isinstance(stream_err, AttributeError):
                    yield LogEvent(
                        type="log", timestamp=time.time(), level="warning",
                        message="Responses stream unavailable; falling back to non-streaming call…",
                    )
                    self.final_response = self._fallback_request(fallback_params, api_params)
                    break

                if is_incomplete_openai_stream_error(stream_err):
                    if attempt < max_attempts:
                        yield LogEvent(
                            type="log", timestamp=time.time(), level="warning",
                            message=(
                                "⚠️ OpenAI stream ended early (missing `response.completed`). "
                                f"Retrying… ({attempt}/{max_attempts})"
                            ),
                        )
                        time.sleep(0.75 * attempt)
                        continue
                    else:
                        yield LogEvent(
                            type="log", timestamp=time.time(), level="warning",
                            message=(
                                "⚠️ OpenAI stream ended early (missing `response.completed`). "
                                "Falling back to non-streaming call…"
                            ),
                        )
                        self.final_response = self._fallback_request(fallback_params, api_params)
                        break
                
                # Re-raise other errors
                raise

        # Flush any remaining buffer from successful stream (though logic above handles it inside loop)
        if buffer:
             yield LogEvent(
                type="log", timestamp=time.time(), level="info",
                message=f"__OUTPUT_DELTA__{buffer}",
            )
            
        return self.final_response

    def _fallback_request(self, fallback_params: Dict[str, Any], api_params: Dict[str, Any]) -> Any:
        """Execute non-streaming fallback request."""
        if hasattr(self.openai_client, "make_api_call"):
            return self.openai_client.make_api_call(fallback_params)
        
        if self.responses_client and callable(getattr(self.responses_client, "create", None)):
            return self.responses_client.create(**api_params)
            
        return None
