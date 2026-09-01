import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from app.config import get_settings
from app.db import engine, init_db
from app.models import Integration
from app.routers import courses, integrations, reminders, settings as settings_router, sync, tasks
from app.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="ManaPeer", version="0.1.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(integrations.router)
app.include_router(courses.router)
app.include_router(tasks.router)
app.include_router(sync.router)
app.include_router(reminders.router)
app.include_router(settings_router.router)


def _recover_stranded_logins() -> None:
    """If the backend restarted mid-way through an interactive login (its
    background thread is gone with it), the DB would otherwise show
    "connecting" forever with no thread left to ever resolve it."""
    with Session(engine) as session:
        stranded = session.exec(select(Integration).where(Integration.status == "connecting")).all()
        for integration in stranded:
            integration.status = "error"
            integration.last_error = "Login was interrupted (server restarted). Reconnect to try again."
            session.add(integration)
        if stranded:
            session.commit()


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    _recover_stranded_logins()
    start_scheduler()


@app.on_event("shutdown")
def on_shutdown() -> None:
    stop_scheduler()


@app.get("/health")
def health():
    return {"status": "ok"}
