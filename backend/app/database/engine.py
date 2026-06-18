from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from app.config import settings


def build_engine() -> AsyncEngine:
    """
    Creates the async SQLAlchemy engine.

    Key decisions explained:
    - pool_size=10: max persistent connections kept alive.
      For a 2-3 person team this is more than enough.
      Raise to 20 if you see connection wait times.

    - max_overflow=20: extra connections allowed above pool_size
      during traffic spikes. They are closed after use.

    - pool_pre_ping=True: before handing a connection from the pool,
      SQLAlchemy sends a lightweight SELECT 1 to verify it is still alive.
      Without this, stale connections after a DB restart cause
      cryptic errors in the middle of requests.

    - echo=settings.DB_ECHO: when True, every SQL statement is printed
      to stdout. Set DB_ECHO=True in .env during development only.
      Never True in production — it floods logs and leaks query structure.
    """
    return create_async_engine(
        settings.DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=settings.DB_ECHO,
    )


# Single engine instance for the whole application.
# Imported by session.py and by tests.
engine = build_engine()
