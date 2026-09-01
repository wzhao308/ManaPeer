from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ConnectCanvasRequest(BaseModel):
    base_url: str = Field(description="e.g. https://yourschool.instructure.com")
    token: str = Field(description="Canvas personal access token")


class IntegrationRead(BaseModel):
    id: int
    type: str
    base_url: Optional[str]
    status: str
    last_error: Optional[str]
    last_synced_at: Optional[datetime]


class CourseRead(BaseModel):
    id: int
    source: str
    external_id: str
    name: str
    term: Optional[str]
    code: Optional[str] = None


class TaskRead(BaseModel):
    id: int
    source: str
    course_id: Optional[int]
    title: str
    type: str
    due_at: Optional[datetime]
    late_due_at: Optional[datetime] = None
    url: Optional[str]
    status: str


class TaskUpdate(BaseModel):
    status: str  # pending | done | dismissed


class SyncResult(BaseModel):
    integrations_synced: int
    courses_upserted: int
    tasks_upserted: int
    tasks_auto_dismissed: int = 0
    errors: list[str]


class ReminderRead(BaseModel):
    id: int
    task_id: int
    lead_minutes: int
    remind_at: datetime
    status: str
    task_title: str
    task_url: Optional[str]
    task_due_at: Optional[datetime]
    task_source: str


class ReminderUpdate(BaseModel):
    status: str  # pending | dismissed


class SettingsRead(BaseModel):
    reminder_lead_minutes: list[int]


class SettingsUpdate(BaseModel):
    reminder_lead_minutes: list[int]
