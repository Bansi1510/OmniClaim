from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "OmniClaim AI Perception Engine"
    API_V1_STR: str = "/v1"
    PORT: int = 8000
    HMAC_SECRET: str = "omniclaim_production_hmac_secret_key_2026"
    YOLO_MODEL_PATH: str = "models/yolov8_car_damage.pt"
    NESTJS_WEBHOOK_URL: str = "http://localhost:4000/api/v1/webhooks/ai-completion"

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
