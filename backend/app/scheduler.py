import logging

from apscheduler.schedulers.background import BackgroundScheduler
from sqlmodel import Session

from app.config import get_settings
from app.db import engine
from app.sync_service import run_sync

logger = logging.getLogger("manapeer.scheduler")

scheduler = BackgroundScheduler()


def _scheduled_sync() -> None:
    with Session(engine) as session:
        try:
            result = run_sync(session)
            logger.info("Background sync complete: %s", result)
        except Exception:  # noqa: BLE001
            logger.exception("Background sync failed")


def start_scheduler() -> None:
    settings = get_settings()
    if scheduler.running:
        return
    scheduler.add_job(
        _scheduled_sync,
        "interval",
        minutes=settings.sync_interval_minutes,
        id="sync_all_integrations",
        replace_existing=True,
        next_run_time=None,  # first sync happens on the manual trigger / after one interval
    )
    scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
