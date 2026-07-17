from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import settings


def normalize_database_url(raw: str) -> tuple[str, dict]:
    """Make a hosted-Postgres URL safe for the asyncpg driver.

    Managed providers (Neon, Supabase, Render, …) hand out a libpq-style URL
    like ``postgresql://user:pass@host/db?sslmode=require&channel_binding=require``.
    Two things break the async stack and we fix them here so the raw URL can be
    pasted straight into ``DATABASE_URL``:

    - **scheme** — ``postgres``/``postgresql`` → ``postgresql+asyncpg`` (the async
      dialect). A URL that already names a driver is left untouched.
    - **libpq-only query params** — asyncpg doesn't understand ``sslmode`` /
      ``channel_binding``; we drop them and, when SSL was requested, pass
      ``ssl=True`` via connect_args instead. The **PgBouncer/pooler-safe**
      settings are set alongside so the same URL also works through a transaction
      pooler (e.g. Neon's ``-pooler`` endpoint):

        * ``statement_cache_size=0`` — disables **asyncpg's** own prepared-
          statement cache;
        * ``prepared_statement_cache_size=0`` — disables **SQLAlchemy's** asyncpg
          dialect prepared-statement cache (the one that raised
          ``InvalidCachedStatementError`` after a schema change through PgBouncer);
        * ``prepared_statement_name_func`` — unique statement names so a pooler
          reusing a server connection never collides on a stale name.

    Returns the rewritten URL and the connect_args dict for create_async_engine.
    """
    parts = urlsplit(raw)
    scheme = parts.scheme
    if scheme in ("postgres", "postgresql"):
        scheme = "postgresql+asyncpg"

    query = dict(parse_qsl(parts.query))
    connect_args: dict = {}
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)  # asyncpg negotiates this itself
    if sslmode and sslmode not in ("disable", "allow", "prefer"):
        connect_args["ssl"] = True
        # Fully pooler-safe: neither driver caches prepared plans, and every
        # statement gets a unique name (PgBouncer transaction pooling reuses
        # server connections, which breaks fixed-name / cached prepared plans).
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_cache_size"] = 0
        connect_args["prepared_statement_name_func"] = lambda: f"__asyncpg_{uuid4()}__"

    url = urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    return url, connect_args


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
    url, connect_args = normalize_database_url(settings.DATABASE_URL)
    return create_async_engine(
        url,
        connect_args=connect_args,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=settings.DB_ECHO,
    )


# Single engine instance for the whole application.
# Imported by session.py and by tests.
engine = build_engine()
