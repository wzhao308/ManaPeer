from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Task
from app.schemas import TaskRead, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])

VALID_STATUSES = {"pending", "done", "dismissed"}


@router.get("", response_model=list[TaskRead])
def list_tasks(
    course_id: Optional[int] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session),
):
    query = select(Task)
    if course_id is not None:
        query = query.where(Task.course_id == course_id)
    if status is not None:
        query = query.where(Task.status == status)
    query = query.order_by(Task.due_at.is_(None), Task.due_at)
    return session.exec(query).all()


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, body: TaskUpdate, session: Session = Depends(get_session)):
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {sorted(VALID_STATUSES)}")
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = body.status
    task.updated_at = datetime.now(timezone.utc)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task
