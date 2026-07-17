from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    DB_ECHO: bool = False

    # App
    SECRET_KEY: str
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"

    # File uploads (document store). UPLOAD_DIR is the local storage root today;
    # the storage layer is object-store-swappable later (see core/storage.py).
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_BYTES: int = 26_214_400  # 25 MB

    # AI analyst agent (Phase 8) — local Ollama behind a swappable LLM client.
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"
    AGENT_MAX_ITERATIONS: int = 4
    AGENT_TIMEOUT_SECONDS: int = 120

    # AISuggestion / RAG (Phase 9) — retrieve similar past CLOSED NCRs and ask
    # the LLM for a probable root cause + corrective actions. Embeddings come
    # from a local Ollama embedding model; similarity is computed in Python over
    # cached vectors (no pgvector — the corpus per project is small, and the
    # retrieval layer is swappable to pgvector later).
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"
    RAG_TOP_K: int = 3
    RAG_MIN_SIMILARITY: float = 0.0  # keep all neighbours by default; raise to prune

    # ── Hosted LLM (OpenAI-compatible) ───────────────────────────────────────
    # Local Ollama is the default for dev. When AI_PROVIDER="openai" the analyst
    # agent AND the RAG embedder call an OpenAI-compatible HTTP API instead —
    # e.g. Google Gemini's compatibility endpoint (one key covers chat + embed).
    # Swapping providers (Groq, Cerebras, Mistral, …) = changing these values,
    # no code change. See app/ai/llm.py + app/ai/embeddings.py.
    AI_PROVIDER: str = "ollama"  # "ollama" | "openai"
    LLM_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    LLM_MODEL: str = "gemini-2.5-flash"
    LLM_API_KEY: str = ""
    EMBED_MODEL: str = "gemini-embedding-001"

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"

    # Email
    # MAIL_PROVIDER selects the transport: "smtp" (fastapi-mail → Gmail, good for
    # local dev) or "brevo" (HTTPS API on port 443). Managed hosts like Render's
    # free tier BLOCK outbound SMTP ports, so hosted deploys must use "brevo".
    MAIL_PROVIDER: str = "smtp"  # "smtp" | "brevo"
    BREVO_API_KEY: str = ""      # required when MAIL_PROVIDER=brevo
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_FROM_NAME: str = "Strata"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False

    # Frontend URL — used in invitation and dispatch email links
    FRONTEND_URL: str = "http://localhost:3000"

    # ── OCR / Intelligent Document Processing (Phase 10) ─────────────────────
    # OCR_ENGINE selects the extraction backend:
    #   "pdfplumber"  — digital PDFs only (text layer), zero external deps
    #   "tesseract"   — pdfplumber for digital pages + Tesseract for scanned
    #   "azure_di"    — Azure Document Intelligence (highest accuracy, pay-per-page)
    # TESSERACT_CMD  — full path to the tesseract binary; None = auto-detect.
    # OCR_MAX_PAGES  — cap pages processed per PDF to control latency.
    # AZURE_DI_*     — only used when OCR_ENGINE="azure_di".
    OCR_ENGINE: str = "tesseract"          # "pdfplumber" | "tesseract" | "azure_di"
    TESSERACT_CMD: str = ""                # e.g. "C:/Program Files/Tesseract-OCR/tesseract.exe"
    OCR_MAX_PAGES: int = 20               # hard page cap per job
    AZURE_DI_KEY: str = ""
    AZURE_DI_ENDPOINT: str = ""
    # Enable LLM-vision fallback when Tesseract confidence < threshold
    OCR_LLM_VISION_FALLBACK: bool = True
    OCR_TESSERACT_CONF_THRESHOLD: int = 60  # osd confidence floor (0-100)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()