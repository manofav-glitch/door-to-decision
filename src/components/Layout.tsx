import { Link, Outlet, useLocation } from 'react-router-dom';
import { useDevMode } from '../lib/dev';
import { DevTag } from './ui';

export function Layout() {
  const { pathname } = useLocation();
  const dev = useDevMode();
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <Link to="/" className="flex min-h-11 items-center text-xl font-bold">
          Door to Decision
          {dev && (
            <span className="ml-2">
              <DevTag />
            </span>
          )}
        </Link>
        <nav aria-label="Main" className="flex gap-1">
          {[
            ['/codex', 'Codex'],
            ['/settings', 'Settings'],
          ].map(([to, label]) => (
            <Link
              key={to}
              to={to!}
              aria-current={pathname.startsWith(to!) ? 'page' : undefined}
              className="flex min-h-11 items-center px-3 underline-offset-4 aria-[current=page]:underline"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
