import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import TaskCard from "../components/TaskCard";
import { groupCourses } from "../lib/courseGroups";
import type { CourseGroup } from "../lib/courseGroups";
import { compareTermRank, parseTermRank } from "../lib/term";

/** Splits course groups into "current semester" and "archived", based on the
 * most recent (season, year) found across ALL groups - not the most recent by
 * id or sync order. A group whose term text doesn't parse (no recognizable
 * season+year) is kept active rather than guessed into archived. */
function splitByLatestTerm(groups: CourseGroup[]): { active: CourseGroup[]; archived: CourseGroup[] } {
  const ranks = groups.map((g) => parseTermRank(g.term)).filter((r) => r !== null);
  const latest = ranks.length > 0 ? ranks.reduce((a, b) => (compareTermRank(a, b) >= 0 ? a : b)) : null;

  if (!latest) return { active: groups, archived: [] };

  const active: CourseGroup[] = [];
  const archived: CourseGroup[] = [];
  for (const group of groups) {
    const rank = parseTermRank(group.term);
    if (rank && compareTermRank(rank, latest) < 0) archived.push(group);
    else active.push(group);
  }
  return { active, archived };
}

export default function CourseTabs() {
  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: api.listCourses });
  const tasksQuery = useQuery({ queryKey: ["tasks"], queryFn: () => api.listTasks() });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const courses = coursesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];

  if (courses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <p className="text-slate-600 font-medium">No courses synced yet.</p>
        <p className="text-sm text-slate-500 mt-1">Connect Canvas in Settings to get started.</p>
      </div>
    );
  }

  const groups = groupCourses(courses);
  const { active, archived } = splitByLatestTerm(groups);
  // Prefer the current semester's groups; only fall back to an archived one
  // if there somehow aren't any current ones yet (e.g. before a first sync).
  const defaultGroup = active[0] ?? archived[0];
  const selectedGroup = groups.find((g) => g.key === selectedKey) ?? defaultGroup;
  const courseIds = new Set(selectedGroup.courses.map((c) => c.id));
  const groupTasks = tasks.filter((t) => t.course_id !== null && courseIds.has(t.course_id));
  const todo = groupTasks.filter((t) => t.status === "pending");
  const done = groupTasks.filter((t) => t.status !== "pending");
  const sources = [...new Set(selectedGroup.courses.map((c) => c.source))];

  const tabClass = (group: CourseGroup) =>
    `shrink-0 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 ${
      group.key === selectedGroup.key
        ? "border-indigo-600 text-indigo-600"
        : "border-transparent text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {active.map((group) => (
          <button key={group.key} onClick={() => setSelectedKey(group.key)} className={tabClass(group)}>
            {group.displayName}
          </button>
        ))}
      </div>

      {archived.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <span>
              Archived / past classes ({archived.length}) {showArchived ? "▲" : "▼"}
            </span>
          </button>
          {showArchived && (
            <div className="flex flex-wrap gap-1 border-t border-slate-200 px-3 py-2">
              {archived.map((group) => (
                <button
                  key={group.key}
                  onClick={() => setSelectedKey(group.key)}
                  className={`rounded-md px-2 py-1 text-xs ${
                    group.key === selectedGroup.key
                      ? "bg-indigo-100 text-indigo-700 font-medium"
                      : "bg-white text-slate-500 hover:bg-slate-100"
                  }`}
                  title={group.term ?? undefined}
                >
                  {group.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedGroup.courses.length > 1 && (
        <p className="text-xs text-slate-400">
          Combining {selectedGroup.courses.length} synced courses across {sources.join(" + ")} - same real class,
          tracked on more than one platform.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
            To do ({todo.length})
          </h2>
          <div className="space-y-2">
            {todo.length === 0 && <p className="text-sm text-slate-400">Nothing pending 🎉</p>}
            {todo.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Done / dismissed ({done.length})
          </h2>
          <div className="space-y-2">
            {done.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
