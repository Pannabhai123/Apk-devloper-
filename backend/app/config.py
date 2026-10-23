"""Application configuration. Secrets are read only on the server."""
from pathlib import Path
import os
from dotenv import load_dotenv

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
ROOT_DIR = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")

DATA_DIR = Path(os.getenv("DATA_DIR", BACKEND_DIR / "data")).resolve()
UPLOAD_DIR = DATA_DIR / "uploads"
EXPORT_DIR = DATA_DIR / "exports"
DATABASE_PATH = DATA_DIR / "dream_classes.db"
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", ROOT_DIR / "dist")).resolve()
ASSET_DIR = APP_DIR / "assets"
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))

for directory in (DATA_DIR, UPLOAD_DIR, EXPORT_DIR):
    directory.mkdir(parents=True, exist_ok=True)


def ai_config() -> dict:
    return {
        "api_key": os.getenv("AI_API_KEY", ""),
        "base_url": os.getenv("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        "model": os.getenv("AI_MODEL", "gpt-4o-mini"),
        "extraction_enabled": os.getenv("AI_EXTRACTION_ENABLED", "false").lower() == "true",
    }
