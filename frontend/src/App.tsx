import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/CalendarPage";
import CourseTabs from "./pages/CourseTabs";
import Onboarding from "./pages/Onboarding";
import NotificationBell from "./components/NotificationBell";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-200"
  }`;

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-indigo-600">ManaPeer</span>
            <span className="text-xs text-slate-400">all your due dates, one place</span>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1">
              <NavLink to="/" end className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/calendar" className={navLinkClass}>
                Calendar
              </NavLink>
              <NavLink to="/courses" className={navLinkClass}>
                Courses
              </NavLink>
              <NavLink to="/settings" className={navLinkClass}>
                Settings
              </NavLink>
            </nav>
            <NotificationBell />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/courses" element={<CourseTabs />} />
          <Route path="/settings" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
