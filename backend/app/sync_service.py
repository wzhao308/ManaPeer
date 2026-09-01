"""Runs every connected integration's adapter and upserts the results.

Upsert key is (source, external_id) for both Course and Task, so re-syncing
updates an existing row (e.g. a changed due date) instead of duplicating it.
"""
import logging
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app import reminders, security
from app.adapters.base import Adapter
from app.adapters.canvas import CanvasAdapter
from app.adapters.gradescope import GradescopeAdapter
from app.adapters.prairielearn import PrairieLearnAdapter
from app.models import Course, Integration, Task
from app.schemas import SyncResult

logger = logging.getLogger("manapeer.sync")

# "Over 1 month" past due, approximated as a flat 30 days (matches the rest
# of the app's lead-time/interval conventions, which are all plain day/minute
# counts rather than calendar-aware).
STALE_TASK_CUTOFF_DAYS = 30


def build_adapter(integration: Integration) -> Adapter:
    if integration.type == "canvas":
        token = security.decrypt(integration.encrypted_credentials)
        return CanvasAdapter(base_url=integration.base_url, token=token)
    if integration.type == "gradescope":
        profile_dir = security.decrypt(integration.encrypted_credentials)
        return GradescopeAdapter(profile_dir=profile_dir)
    if integration.type == "prairielearn":
        profile_dir = security.decrypt(integration.encrypted_credentials)
        return PrairieLearnAdapter(profile_dir=profile_dir)
    raise NotImplementedError(f"No adapter implemented yet for '{integration.type}'")


def _dismiss_stale_tasks(session: Session) -> int:
    """Auto-dismisses any task that's still "pending" but more than
    STALE_TASK_CUTOFF_DAYS past its due date - old, already-irrelevant work
    (e.g. importing a past semester's courses) that would otherwise sit in the
    Dashboard/Calendar/Tabs forever. Only touches "pending" tasks - "done" and
    already-"dismissed" ones are left alone. Applied as a continuous sweep
    over every task each sync, not just newly-discovered ones, so it also
    cleans up anything that crosses the threshold while already being tracked.
    """
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=STALE_TASK_CUTOFF_DAYS)
    stale = session.exec(
        select(Task).where(Task.status == "pending", Task.due_at.is_not(None), Task.due_at < cutoff)
    ).all()
    for task in stale:
        task.status = "dismissed"
        task.updated_at = datetime.now(timezone.utc)
        session.add(task)
    return len(stale)


def run_sync(session: Session) -> SyncResult:
    integrations = session.exec(select(Integration)).all()
    integrations_synced = 0
    courses_upserted = 0
    tasks_upserted = 0
    errors: list[str] = []
    lead_minutes = reminders.get_settings(session).reminder_lead_minutes

    for integration in integrations:
        adapter = None
        try:
            adapter = build_adapter(integration)
            adapter.test_connection()

            synced_courses = adapter.fetch_courses()
            course_id_by_external: dict[str, int] = {}
            for sc in synced_courses:
                existing = session.exec(
                    select(Course).where(Course.source == adapter.source, Course.external_id == sc.external_id)
                ).first()
                if existing:
                    existing.name = sc.name
                    existing.term = sc.term
                    existing.code = sc.code
                    session.add(existing)
                    course_id_by_external[sc.external_id] = existing.id
                else:
                    new_course = Course(
                        source=adapter.source, external_id=sc.external_id, name=sc.name, term=sc.term, code=sc.code
                    )
                    session.add(new_course)
                    session.flush()  # populate new_course.id
                    course_id_by_external[sc.external_id] = new_course.id
                courses_upserted += 1

            synced_tasks = adapter.fetch_tasks(synced_courses)
            for st in synced_tasks:
                existing_task = session.exec(
                    select(Task).where(Task.source == adapter.source, Task.external_id == st.external_id)
                ).first()
                course_id = course_id_by_external.get(st.course_external_id)
                if existing_task:
                    existing_task.title = st.title
                    existing_task.type = st.type
                    existing_task.due_at = st.due_at
                    existing_task.late_due_at = st.late_due_at
                    existing_task.url = st.url
                    existing_task.course_id = course_id
                    existing_task.updated_at = datetime.now(timezone.utc)
                    session.add(existing_task)
                    task_row = existing_task
                else:
                    task_row = Task(
                        source=adapter.source,
                        external_id=st.external_id,
                        course_id=course_id,
                        title=st.title,
                        type=st.type,
                        due_at=st.due_at,
                        late_due_at=st.late_due_at,
                        url=st.url,
                    )
                    session.add(task_row)
                    session.flush()  # populate task_row.id
                tasks_upserted += 1
                reminders.sync_reminders_for_task(session, task_row, lead_minutes)

            integration.status = "connected"
            integration.last_error = None
            integration.last_synced_at = datetime.now(timezone.utc)
            session.add(integration)
            integrations_synced += 1
        except NotImplementedError as exc:
            # Not an error worth surfacing loudly - just not built yet.
            integration.status = "pending"
            integration.last_error = str(exc)
            session.add(integration)
        except Exception as exc:  # noqa: BLE001 - surface any adapter failure to the UI
            integration.status = "error"
            integration.last_error = str(exc)
            session.add(integration)
            errors.append(f"{integration.type}: {exc}")
        finally:
            if adapter is not None:
                try:
                    adapter.close()
                except Exception:  # noqa: BLE001 - never let cleanup break the sync loop
                    logger.exception("Failed to close adapter for integration %s", integration.type)

    tasks_auto_dismissed = _dismiss_stale_tasks(session)

    session.commit()
    return SyncResult(
        integrations_synced=integrations_synced,
        courses_upserted=courses_upserted,
        tasks_upserted=tasks_upserted,
        tasks_auto_dismissed=tasks_auto_dismissed,
        errors=errors,
    )
