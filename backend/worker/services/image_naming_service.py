"""
AI Image Naming Service
Generates descriptive filenames for AI-generated images based on their content.
"""
import logging
import base64
import re
from typing import Optional
from services.api_key_manager import APIKeyManager
from core.prompts import PROMPT_CONFIGS, IMAGE_NAMING_INSTRUCTIONS, IMAGE_NAMING_PROMPT

logger = logging.getLogger(__name__)


class ImageNamingService:
    """Service for generating AI-based filenames for images."""
    
    def __init__(self):
        """Initialize the image naming service with OpenAI client."""
        self.openai_api_key = APIKeyManager.get_openai_key()
        self.client = openai.OpenAI(api_key=self.openai_api_key)
    
    def generate_filename_from_image(
        self,
        image_b64: str,
        context: Optional[str] = None,
        step_name: Optional[str] = None,
        step_instructions: Optional[str] = None,
        image_index: int = 0
    ) -> str:
        """
        Generate a descriptive filename for an image based on its content using AI.
        
        Args:
            image_b64: Base64-encoded image data
            context: Optional context about the workflow/job
            step_name: Optional step name that generated the image
            step_instructions: Optional step instructions that generated the image
            image_index: Index of the image if multiple images were generated
            
        Returns:
            A sanitized filename string (e.g., "sunset_over_mountains.png")
        """
        try:
            # Build context prompt
            context_parts = []
            if step_name:
                context_parts.append(f"Step name: {step_name}")
            if step_instructions:
                # Truncate instructions if too long
                instructions_preview = step_instructions[:200] + "..." if len(step_instructions) > 200 else step_instructions
                context_parts.append(f"Step instructions: {instructions_preview}")
            if context:
                context_preview = context[:200] + "..." if len(context) > 200 else context
                context_parts.append(f"Context: {context_preview}")
            
            context_text = "\n".join(context_parts) if context_parts else None
            
            # Build the prompt for filename generation
            prompt = IMAGE_NAMING_PROMPT
            
            if context_text:
                prompt += f"\n\nAdditional context:\n{context_text}"
            
            config = PROMPT_CONFIGS["image_naming"]
            # Use vision model to analyze the image with Responses API
            response = self.client.responses.create(
                model=config["model"],  # Use vision-capable model
                instructions=IMAGE_NAMING_INSTRUCTIONS,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_text",
                                "text": prompt
                            },
                            {
                                "type": "input_image",
                                "image_url": f"data:image/png;base64,{image_b64}"
                            }
                        ]
                    }
                ],
                max_output_tokens=50,  # Filenames should be short
            )
            
            # Extract filename from response (Responses API uses output_text)
            filename = response.output_text.strip()
            
            # Sanitize filename
            filename = self._sanitize_filename(filename)
            
            # Add index suffix if multiple images
            if image_index > 0:
                filename = f"{filename}_{image_index + 1}"
            
            # Add extension
            filename = f"{filename}.png"
            
            logger.info(f"[ImageNamingService] Generated filename: {filename}", extra={
                'original_suggestion': response.output_text.strip(),
                'sanitized_filename': filename,
                'has_context': context_text is not None,
                'step_name': step_name
            })
            
            return filename
            
        except Exception as e:
            logger.error(f"[ImageNamingService] Failed to generate filename: {e}", exc_info=True, extra={
                'error_type': type(e).__name__,
                'error_message': str(e),
                'step_name': step_name
            })
            # Fallback to generic filename
            import uuid
            import time
            return f"image_{int(time.time())}_{str(uuid.uuid4())[:8]}.png"
    
    def _sanitize_filename(self, filename: str) -> str:
        """
        Sanitize filename to be filesystem-safe.
        
        Args:
            filename: Raw filename from AI
            
        Returns:
            Sanitized filename
        """
        # Remove file extension if present
        filename = re.sub(r'\.(png|jpg|jpeg|gif|webp)$', '', filename, flags=re.IGNORECASE)
        
        # Remove any leading/trailing whitespace
        filename = filename.strip()
        
        # Remove quotes and other problematic characters
        filename = filename.replace('"', '').replace("'", '')
        
        # Replace spaces and other special chars with underscores
        filename = re.sub(r'[^\w\-_]', '_', filename)
        
        # Remove multiple consecutive underscores
        filename = re.sub(r'_+', '_', filename)
        
        # Remove leading/trailing underscores
        filename = filename.strip('_')
        
        # Ensure it's not empty
        if not filename:
            filename = "generated_image"
        
        # Limit length
        if len(filename) > 100:
            filename = filename[:100]
        
        return filename.lower()
