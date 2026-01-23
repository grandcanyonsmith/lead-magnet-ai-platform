"""
AI Service
Handles OpenAI API interactions for report generation and HTML rewriting.
"""

from typing import Optional, Dict, Tuple, List, Any

from core.logger import get_logger
from s3_service import S3Service
from services.image_handler import ImageHandler
from services.html_generator import HTMLGenerator
from services.openai_client import OpenAIClient
from services.cua_loop_service import CUALoopService
from services.shell_executor_service import ShellExecutorService
from services.tools.execution import ShellLoopService
from services.ai.image_generator import ImageGenerator
from services.ai.report_generator import ReportGenerator
from services.prompt_overrides import get_prompt_overrides

logger = get_logger(__name__)


class AIService:
    """Facade for AI-powered content generation."""
    
    def __init__(self, db_service: Optional[Any] = None, s3_service: Optional[S3Service] = None):
        """Initialize services."""
        self.db_service = db_service
        self.s3_service = s3_service or S3Service()
        self.openai_client = OpenAIClient()
        self.image_handler = ImageHandler(self.s3_service)
        self.html_generator = HTMLGenerator(self.openai_client)
        self.cua_loop_service = CUALoopService(self.image_handler)
        self.shell_executor_service = ShellExecutorService()
        self.shell_loop_service = ShellLoopService(self.shell_executor_service)
        self.image_generator = ImageGenerator(self.openai_client, self.image_handler)
        
        # Initialize ReportGenerator
        self.report_generator = ReportGenerator(
            openai_client=self.openai_client,
            cua_loop_service=self.cua_loop_service,
            shell_loop_service=self.shell_loop_service,
            image_generator=self.image_generator,
            image_handler=self.image_handler,
            db_service=self.db_service
        )

    def set_step_context(self, step_name: Optional[str], step_instructions: Optional[str]):
        """Set context for current step being processed."""
        logger.debug("[AIService] set_step_context", extra={
            "step_name": step_name,
            "has_step_instructions": bool(step_instructions),
        })
        self.report_generator.set_step_context(step_name, step_instructions)
    
    def generate_report(
        self,
        model: str,
        instructions: str,
        context: str,
        previous_context: str = "",
        tools: Optional[List[Dict]] = None,
        tool_choice: str = "auto",
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
        previous_image_urls: Optional[List[str]] = None,
        reasoning_effort: Optional[str] = None,
        service_tier: Optional[str] = None,
        output_format: Optional[Dict[str, Any]] = None,
        step_index: Optional[int] = None,
        text_verbosity: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        shell_settings: Optional[Dict[str, Any]] = None,
    ) -> Tuple[str, Dict, Dict, Dict]:
        """Delegate report generation to ReportGenerator."""
        return self.report_generator.generate_report(
            model=model,
            instructions=instructions,
            context=context,
            previous_context=previous_context,
            tools=tools,
            tool_choice=tool_choice,
            tenant_id=tenant_id,
            job_id=job_id,
            previous_image_urls=previous_image_urls,
            reasoning_effort=reasoning_effort,
            service_tier=service_tier,
            output_format=output_format,
            step_index=step_index,
            text_verbosity=text_verbosity,
            max_output_tokens=max_output_tokens,
            shell_settings=shell_settings,
        )
    
    def generate_html_from_submission(
        self,
        submission_data: dict,
        template_html: str,
        template_style: str = '',
        model: str = 'gpt-5.2',
        tenant_id: Optional[str] = None,
    ) -> Tuple[str, Dict, Dict, Dict]:
        """Delegate to HTMLGenerator."""
        prompt_overrides = get_prompt_overrides(self.db_service, tenant_id)
        return self.html_generator.generate_html_from_submission(
            submission_data=submission_data,
            template_html=template_html,
            template_style=template_style,
            model=model,
            prompt_overrides=prompt_overrides,
        )

    def generate_styled_html(
        self,
        research_content: str,
        template_html: str,
        template_style: str = '',
        submission_data: dict = None,
        model: str = 'gpt-5.2',
        tenant_id: Optional[str] = None,
    ) -> Tuple[str, Dict, Dict, Dict]:
        """Delegate to HTMLGenerator."""
        prompt_overrides = get_prompt_overrides(self.db_service, tenant_id)
        return self.html_generator.generate_styled_html(
            research_content=research_content,
            template_html=template_html,
            template_style=template_style,
            submission_data=submission_data,
            model=model,
            prompt_overrides=prompt_overrides,
        )

    def rewrite_html(
        self,
        html_content: str,
        model: str = 'gpt-5.2',
    ) -> str:
        """Delegate to HTMLGenerator."""
        return self.html_generator.rewrite_html(html_content, model)
