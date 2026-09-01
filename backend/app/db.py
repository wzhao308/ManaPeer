from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

_settings = get_settings()
engine = create_engine(f"sqlite:///{_settings.db_path}", connect_args={"check_same_thread": False})


def _add_missing_columns() -> None:
    """`create_all()` only creates tables that don't exist yet - it never adds
    a new column to a table that's already there, which SQLite otherwise has
    no built-in migration story for. Rather than pull in a full migration
    framework for one nullable column at a time, this just checks and adds
    whatever's missing - safe to run on every startup, never touches existing
    data. Extend this list whenever a model gains a new column.
    """
    with engine.connect() as conn:
        course_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(course)"))}
        if "code" not in course_cols:
            conn.execute(text("ALTER TABLE course ADD COLUMN code TEXT"))
            conn.commit()

        task_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(task)"))}
        if "late_due_at" not in task_cols:
            conn.execute(text("ALTER TABLE task ADD COLUMN late_due_at TIMESTAMP"))
            conn.commit()


def init_db() -> None:
    # Import models so their tables are registered on SQLModel.metadata before create_all.
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _add_missing_columns()


def get_session():
    with Session(engine) as session:
        yield session
