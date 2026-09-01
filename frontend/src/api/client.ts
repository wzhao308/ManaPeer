const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export type IntegrationStatus = "pending" | "connecting" | "connected" | "error";

export interface Integration {
  id: number;
  type: string;
  base_url: string | null;
  status: IntegrationStatus;
  last_error: string | null;
  last_synced_at: string | null;
}

export interface Course {
  id: number;
  source: string;
  external_id: string;
  name: string;
  term: string | null;
  code: string | null;
}

export type TaskStatus = "pending" | "done" | "dismissed";

export interface Task {
  id: number;
  source: string;
  course_id: number | null;
  title: string;
  type: string;
  due_at: string | null;
  late_due_at: string | null;
  url: string | null;
  status: TaskStatus;
}

export interface SyncResult {
  integrations_synced: number;
  courses_upserted: number;
  tasks_upserted: number;
  tasks_auto_dismissed: number;
  errors: string[];
}

export type ReminderStatus = "pending" | "dismissed";

export interface Reminder {
  id: number;
  task_id: number;
  lead_minutes: number;
  remind_at: string;
  status: ReminderStatus;
  task_title: string;
  task_url: string | null;
  task_due_at: string | null;
  task_source: string;
}

export interface Settings {
  reminder_lead_minutes: number[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listIntegrations: () => request<Integration[]>("/integrations"),
  connectCanvas: (base_url: string, token: string) =>
    request<Integration>("/integrations/canvas", {
      method: "POST",
      body: JSON.stringify({ base_url, token }),
    }),
  disconnectIntegration: (id: number) =>
    request<void>(`/integrations/${id}`, { method: "DELETE" }),
  startGradescopeLogin: () =>
    request<Integration>("/integrations/gradescope/start-login", { method: "POST" }),
  startPrairieLearnLogin: () =>
    request<Integration>("/integrations/prairielearn/start-login", { method: "POST" }),

  listCourses: () => request<Course[]>("/courses"),

  listTasks: (params?: { course_id?: number; status?: TaskStatus }) => {
    const qs = new URLSearchParams();
    if (params?.course_id != null) qs.set("course_id", String(params.course_id));
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Task[]>(`/tasks${suffix}`);
  },
  updateTaskStatus: (id: number, status: TaskStatus) =>
    request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  syncNow: () => request<SyncResult>("/sync/run", { method: "POST" }),

  listReminders: (activeOnly = true) =>
    request<Reminder[]>(`/reminders?active_only=${activeOnly}`),
  updateReminderStatus: (id: number, status: ReminderStatus) =>
    request<Reminder>(`/reminders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  dismissActiveReminders: () => request<number[]>("/reminders/dismiss-active", { method: "POST" }),

  getSettings: () => request<Settings>("/settings"),
  updateSettings: (reminder_lead_minutes: number[]) =>
    request<Settings>("/settings", { method: "PUT", body: JSON.stringify({ reminder_lead_minutes }) }),
};
