from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from app.database.engine import engine


# async_sessionmaker is the async equivalent of sessionmaker.
# expire_on_commit=False is CRITICAL for async SQLAlchemy:
#   In sync SQLAlchemy, after commit() all attributes are expired and
#   re-fetched lazily on next access. In async, lazy loading is not
#   allowed — accessing an expired attribute outside a session raises
#   MissingGreenlet errors. Setting this to False means attributes
#   keep their values after commit, which is safe for our read-after-write
#   patterns (e.g. returning the created object from a POST endpoint).
#
# autoflush=False: prevents SQLAlchemy from automatically flushing
# pending changes before queries. We control flushes explicitly in
# repositories, which makes transaction behaviour predictable.
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a database session per request.

    Usage in a router:
        @router.post("/pours/")
        async def create_pour(db: AsyncSession = Depends(get_db)):
            ...

    Transaction behaviour:
    - If the request handler completes without raising, the session
      is committed automatically here.
    - If any exception propagates out of the handler, the session
      is rolled back, then the exception is re-raised so FastAPI
      can return the appropriate HTTP error.

    This means services and repositories should call session.flush()
    to write to the DB within the transaction, but NEVER session.commit().
    Commit happens exactly once, here, per request.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
