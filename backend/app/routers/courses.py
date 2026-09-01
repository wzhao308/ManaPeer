from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.models import Course
from app.schemas import CourseRead

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[CourseRead])
def list_courses(session: Session = Depends(get_session)):
    return session.exec(select(Course).order_by(Course.name)).all()
