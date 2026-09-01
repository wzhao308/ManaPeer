import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import CalendarGrid from "../components/CalendarGrid";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const tasksQuery = useQuery({ queryKey: ["tasks"], queryFn: () => api.listTasks() });

  const shift = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">
          {MONTH_NAMES[month]} {year}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => shift(-1)}
            className="px-2 py-1 rounded-md border border-slate-300 text-sm hover:bg-slate-100"
          >
            ← Prev
          </button>
          <button
            onClick={() => {
              setMonth(now.getMonth());
              setYear(now.getFullYear());
            }}
            className="px-2 py-1 rounded-md border border-slate-300 text-sm hover:bg-slate-100"
          >
            Today
          </button>
          <button
            onClick={() => shift(1)}
            className="px-2 py-1 rounded-md border border-slate-300 text-sm hover:bg-slate-100"
          >
            Next →
          </button>
        </div>
      </div>
      {tasksQuery.isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <CalendarGrid year={year} month={month} tasks={tasksQuery.data ?? []} />
      )}
    </div>
  );
}
