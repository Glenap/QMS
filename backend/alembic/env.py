import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, text
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

from app.database.base import Base
from app.config import settings

# Import ALL model files — Alembic autogenerate only sees tables
# whose models have been imported. Never skip any of these.
import app.models.auth        # noqa: F401
import app.models.master      # noqa: F401
import app.models.transaction # noqa: F401
import app.models.quality     # noqa: F401
import app.models.audit       # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# All 5 schemas in this system
SCHEMAS = ["master", "transaction", "quality", "audit", "auth"]


def include_object(object, name, type_, reflected, compare_to):
    """Only track tables in our 5 schemas. Ignore system tables."""
    if type_ == "table":
        schema = getattr(object, "schema", None)
        return schema in SCHEMAS or schema is None
    return True


def run_migrations_offline() -> None:
    """Generate SQL script without a live DB connection.
    Run with: alembic upgrade head --sql
    """
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Connect to DB and run migrations directly."""
    connectable = create_async_engine(
        settings.DATABASE_URL,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        # Create all 5 schemas if they don't exist yet
        for schema in SCHEMAS:
            await connection.execute(
                text(f"CREATE SCHEMA IF NOT EXISTS {schema}")
            )
        await connection.commit()
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()