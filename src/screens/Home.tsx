import { Link } from 'react-router-dom';
import { index } from '../content/client';

export function Home() {
  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold">Choose a system</h1>
      <p className="mb-6 text-grey-1">Decide. See how the patient responds. Learn why.</p>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {index.systems.map((s) => (
          <li key={s.id}>
            {s.status === 'active' ? (
              <Link
                to={`/s/${s.id}`}
                className="panel flex min-h-28 flex-col justify-between p-4 hover:bg-paper-2"
              >
                <span className="text-xl font-semibold">{s.name}</span>
                <span className="text-sm text-grey-1">
                  {s.blurb ?? s.modules.map((m) => m.title).join(' · ')}
                </span>
              </Link>
            ) : (
              <div
                className="panel flex min-h-28 flex-col justify-between border-dashed p-4 text-grey-1"
                aria-disabled="true"
              >
                <span className="text-xl font-semibold">{s.name}</span>
                <span className="text-sm">Coming soon</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
