from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    """
    Application configuration via environment variables.
    """
    # AWS Configuration
    AWS_REGION: str = Field(default="us-east-1", description="AWS Region")
    
    # Job Configuration
    JOB_ID: Optional[str] = Field(default=None, description="The ID of the job being processed")
    STEP_INDEX: Optional[int] = Field(default=None, description="Index of the step to process (if single step)")
    CONTINUE_AFTER: bool = Field(default=False, description="Whether to continue processing after the single step")
    
    # API Keys & Secrets (usually injected via env vars)
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API Key")
    
    # Environment
    ENVIRONMENT: str = Field(default="dev", description="Deployment environment (dev, staging, prod)")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")

    # Shell Executor Configuration
    SHELL_EXECUTOR_RESULTS_BUCKET: Optional[str] = Field(default=None, description="S3 bucket for shell executor results")
    SHELL_EXECUTOR_CLUSTER_ARN: Optional[str] = Field(default=None, description="ECS Cluster ARN for shell executor")
    SHELL_EXECUTOR_TASK_DEFINITION_ARN: Optional[str] = Field(default=None, description="ECS Task Definition ARN for shell executor")
    SHELL_EXECUTOR_SECURITY_GROUP_ID: Optional[str] = Field(default=None, description="Security Group ID for shell executor")
    SHELL_EXECUTOR_SUBNET_IDS: Optional[str] = Field(default=None, description="Comma-separated subnet IDs for shell executor")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

# Global settings instance
settings = Settings()

