from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Single declarative base for all SQLAlchemy models.

    Every model file (master.py, transaction.py, quality.py, audit.py)
    imports and inherits from this Base.

    Alembic's env.py also imports this Base so autogenerate can
    discover all models and generate migrations automatically.
    """
    pass
