import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Task } from "../api/client";
import TaskCard from "../components/TaskCard";
import { effectiveDueDate } from "../lib/date";

type Bucket = "Overdue" | "Today" | "This week" | "Later" | "No due date" | "Done" | "Dismissed";

const BUCKET_ORDER: Bucket[] = ["Overdue", "Today", "This week", "Later", "No due date", "Done", "Dismissed"];

/** Buckets by the effective deadline (the regular due date, or the
 * late-submission cutoff once that's passed - see effectiveDueDate), so a
 * Gradescope task with a late option isn't dropped into "Overdue" the moment
 * its regular due date passes if it can still be submitted late. */
function bucketOf(task: Task): Bucket {
  if (task.status === "done") return "Done";
  if (task.status === "dismissed") return "Dismissed";
  const due = effectiveDueDate(task);
  if (!due) return "No due date";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = (due.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "Overdue";
  if (diffDays < 1) return "Today";
  if (diffDays < 7) return "This week";
  return "Later";
}

export default function Dashboard() {
  const tasksQuery = useQuery({ queryKey: ["tasks"], queryFn: () => api.listTasks() });
  const [activeTab, setActiveTab] = useState<Bucket | null>(null);

  if (tasksQuery.isLoading) return <p className="text-slate-500">Loading…</p>;
  if (tasksQuery.isError) return <p className="text-red-600">{(tasksQuery.error as Error).message}</p>;

  const tasks = tasksQuery.data ?? [];

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <p className="text-slate-600 font-medium">No tasks yet.</p>
        <p className="text-sm text-slate-500 mt-1">
          Head to Settings to connect Canvas and sync your assignments.
        </p>
      </div>
    );
  }

  const grouped = new Map<Bucket, Task[]>();
  for (const bucket of BUCKET_ORDER) grouped.set(bucket, []);
  for (const task of tasks) grouped.get(bucketOf(task))!.push(task);

  // Default to whichever bucket has something in it first, in priority order,
  // rather than always landing on an empty "Overdue" tab.
  const defaultTab = BUCKET_ORDER.find((b) => grouped.get(b)!.length > 0) ?? BUCKET_ORDER[0];
  const selectedTab = activeTab ?? defaultTab;
  const selectedTasks = grouped.get(selectedTab) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {BUCKET_ORDER.map((bucket) => (
          <button
            key={bucket}
            onClick={() => setActiveTab(bucket)}
            className={`shrink-0 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 ${
              bucket === selectedTab
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {bucket} ({grouped.get(bucket)!.length})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {selectedTasks.length === 0 && (
          <p className="text-sm text-slate-400">Nothing here.</p>
        )}
        {selectedTasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
