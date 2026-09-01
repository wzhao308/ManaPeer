"""Database models.

Single-user for now (one `User` row), but the shape doesn't preclude adding
multi-user support later.
"""
import json
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel, UniqueConstraint

# Default reminder lead times, in minutes before a task's due date: 3 days, 1 day, 3 hours.
DEFAULT_REMINDER_LEAD_MINUTES = [4320, 1440, 180]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)


class Integration(SQLModel, table=True):
    """One connected platform account (Canvas today; Gradescope/PrairieLearn later)."""

    __table_args__ = (UniqueConstraint("type", name="uq_integration_type"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    type: str  # "canvas" | "gradescope" | "prairielearn"
    base_url: Optional[str] = None
    encrypted_credentials: str
    status: str = "pending"  # pending | connected | error
    last_error: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=_utcnow)


class Course(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("source", "external_id", name="uq_course_source_external_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    source: str
    external_id: str
    name: str
    term: Optional[str] = None
    # Best-effort "subject + number" course code (e.g. "PHYS 213"), used by the
    # frontend to recognize the same real class tracked on two different
    # platforms and merge them into one tab - see
    # app.adapters.base.extract_course_code and frontend/src/lib/courseGroups.ts.
    # Deliberately NOT used to deduplicate within a single source: two
    # Gradescope rows sharing a code (e.g. different lab sections) are
    # legitimately separate, only cross-source matches get merged.
    code: Optional[str] = None


class Task(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("source", "external_id", name="uq_task_source_external_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    source: str
    external_id: str
    course_id: Optional[int] = Field(default=None, foreign_key="course.id")
    title: str
    type: str = "assignment"  # assignment | quiz | exam | project
    due_at: Optional[datetime] = None
    # Hard late-submission cutoff, if the platform offers one beyond due_at
    # (Gradescope's "Late Due Date:"). None everywhere it doesn't apply.
    late_due_at: Optional[datetime] = None
    url: Optional[str] = None
    status: str = "pending"  # pending | done | dismissed
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class Reminder(SQLModel, table=True):
    """One lead-time alert for a task (e.g. '3 hours before Homework 2 is due').

    Regenerated on every sync from the task's current due_at and the current
    reminder-lead-time settings - see `app.reminders.sync_reminders_for_task`.
    """

    __table_args__ = (UniqueConstraint("task_id", "lead_minutes", name="uq_reminder_task_lead"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(foreign_key="task.id")
    lead_minutes: int
    remind_at: datetime
    status: str = "pending"  # pending | dismissed
    created_at: datetime = Field(default_factory=_utcnow)


class AppSettings(SQLModel, table=True):
    """Single-row table of app-wide settings (single-user app)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    reminder_lead_minutes_json: str = Field(
        default_factory=lambda: json.dumps(DEFAULT_REMINDER_LEAD_MINUTES)
    )

    @property
    def reminder_lead_minutes(self) -> list[int]:
        return json.loads(self.reminder_lead_minutes_json)

    @reminder_lead_minutes.setter
    def reminder_lead_minutes(self, value: list[int]) -> None:
        self.reminder_lead_minutes_json = json.dumps(value)
