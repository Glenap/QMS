from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth


def create_app() -> FastAPI:
    app = FastAPI(
        title="Construction Quality Management System",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json" if not settings.is_production else None,
    )

    # CORS — allow frontend dev server
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check
    @app.get("/health", tags=["health"])
    async def health_check():
        return {"status": "ok", "environment": settings.ENVIRONMENT}

    # Routers
    app.include_router(auth.router, prefix=settings.API_V1_PREFIX)

    # Phase 3 — add remaining routers here as we build them:
    # app.include_router(projects.router, prefix=settings.API_V1_PREFIX)
    # app.include_router(pours.router, prefix=settings.API_V1_PREFIX)
    # app.include_router(cube_tests.router, prefix=settings.API_V1_PREFIX)
    # app.include_router(ncr.router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()