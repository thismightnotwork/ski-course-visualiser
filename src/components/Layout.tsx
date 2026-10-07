import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    document.documentElement.classList.toggle('dark', !dark);
    setDark(!dark);
  };
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded px-3 py-1 ${isActive ? 'bg-sky-700 text-white' : 'hover:underline'}`;
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-300 px-4 py-3 dark:border-slate-700">
        <Link to="/" className="text-lg font-bold">
          SkiCourse Visualiser
        </Link>
        <nav aria-label="Main" className="flex gap-1 text-sm">
          <NavLink to="/" end className={link}>
            Dashboard
          </NavLink>
          <NavLink to="/projects/new" className={link}>
            New project
          </NavLink>
          <NavLink to="/privacy" className={link}>
            Privacy
          </NavLink>
        </nav>
        <button
          type="button"
          onClick={toggle}
          className="ml-auto rounded border border-slate-400 px-3 py-1 text-sm"
        >
          {dark ? 'Light theme' : 'Dark theme'}
        </button>
      </header>
      <main className="mx-auto max-w-5xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
