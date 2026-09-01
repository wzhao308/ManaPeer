import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Task } from "../api/client";
import { parseApiDate } from "../lib/date";
import { sourceColorClasses } from "../lib/sourceColors";

const fmt = (d: Date) =>
  d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Accounts for Gradescope's late-submission cutoff: before the regular due
 * date, shows that (with a note that a late option exists); once it's
 * passed but the late cutoff hasn't, shows the late cutoff as the now-relevant
 * deadline instead of just saying "overdue". */
function formatDue(task: Pick<Task, "due_at" | "late_due_at">): { label: string; tone: string } {
  if (!task.due_at) return { label: "No due date", tone: "text-slate-400" };
  const due = parseApiDate(task.due_at);
  const late = parseApiDate(task.late_due_at);
  const now = new Date();

  if (late && now >= due) {
    const diffHrs = (late.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHrs < 0) return { label: `Overdue • late cutoff was ${fmt(late)}`, tone: "text-red-600" };
    return { label: `Due date passed • late submission until ${fmt(late)}`, tone: "text-amber-600" };
  }

  const diffHrs = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  const lateNote = late ? ` (late until ${fmt(late)})` : "";
  if (diffHrs < 0) return { label: `Overdue • was ${fmt(due)}${lateNote}`, tone: "text-red-600" };
  if (diffHrs < 24) return { label: `Due soon • ${fmt(due)}${lateNote}`, tone: "text-amber-600" };
  return { label: `Due ${fmt(due)}${lateNote}`, tone: "text-slate-500" };
}

export default function TaskCard({ task }: { task: Task }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (status: Task["status"]) => api.updateTaskStatus(task.id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const due = formatDue(task);
  const isDone = task.status === "done";
  const isDismissed = task.status === "dismissed";

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 ${
        isDone || isDismissed ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] uppercase tracking-wide font-semibold rounded px-1.5 py-0.5 ${sourceColorClasses(task.source).badge}`}
          >
            {task.source}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">{task.type}</span>
        </div>
        {task.url ? (
          <a
            href={task.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-slate-800 hover:text-indigo-600 hover:underline truncate block"
          >
            {task.title}
          </a>
        ) : (
          <p className="font-medium text-slate-800 truncate">{task.title}</p>
        )}
        <p className={`text-sm ${due.tone}`}>{due.label}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        {!isDone && (
          <button
            onClick={() => mutation.mutate("done")}
            className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            Done
          </button>
        )}
        {!isDismissed && (
          <button
            onClick={() => mutation.mutate("dismissed")}
            className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Dismiss
          </button>
        )}
        {(isDone || isDismissed) && (
          <button
            onClick={() => mutation.mutate("pending")}
            className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
