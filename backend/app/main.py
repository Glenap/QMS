from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    ai_suggestions,
    alerts,
    analytics,
    auth,
    catalog,
    chatbot,
    confirmations,
    cube_tests,
    directory,
    dispatch_token,
    dispatches,
    documents,
    floors,
    lab_report,
    labs,
    mix_designs,
    mix_submission,
    ncrs,
    pours,
    projects,
    suppliers,
    traceability,
)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Strata — Construction QMS",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json" if not settings.is_production else None,
    )

    # CORS — allow frontend dev server.
    # 3000 is the configured Vite port; 5173 is Vite's default fallback.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            settings.FRONTEND_URL,
            "http://localhost:3000",
            "http://localhost:5173",
        ],
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
    app.include_router(projects.router, prefix=settings.API_V1_PREFIX)
    app.include_router(suppliers.router, prefix=settings.API_V1_PREFIX)
    app.include_router(labs.router, prefix=settings.API_V1_PREFIX)
    app.include_router(directory.router, prefix=settings.API_V1_PREFIX)
    app.include_router(catalog.router, prefix=settings.API_V1_PREFIX)
    app.include_router(floors.router, prefix=settings.API_V1_PREFIX)
    app.include_router(mix_designs.router, prefix=settings.API_V1_PREFIX)
    app.include_router(mix_submission.router, prefix=settings.API_V1_PREFIX)
    app.include_router(confirmations.router, prefix=settings.API_V1_PREFIX)
    app.include_router(pours.router, prefix=settings.API_V1_PREFIX)
    app.include_router(dispatches.router, prefix=settings.API_V1_PREFIX)
    app.include_router(dispatch_token.router, prefix=settings.API_V1_PREFIX)
    app.include_router(cube_tests.router, prefix=settings.API_V1_PREFIX)
    app.include_router(lab_report.router, prefix=settings.API_V1_PREFIX)
    app.include_router(ncrs.router, prefix=settings.API_V1_PREFIX)
    app.include_router(ai_suggestions.router, prefix=settings.API_V1_PREFIX)
    app.include_router(analytics.router, prefix=settings.API_V1_PREFIX)
    app.include_router(alerts.router, prefix=settings.API_V1_PREFIX)
    app.include_router(traceability.router, prefix=settings.API_V1_PREFIX)
    app.include_router(documents.router, prefix=settings.API_V1_PREFIX)
    app.include_router(chatbot.router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()