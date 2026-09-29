import { Link, useParams } from 'react-router-dom';
import { index } from '../content/client';
import { BackLink, NotFound } from '../components/ui';

export function System() {
  const { systemId } = useParams();
  const system = index.systems.find((s) => s.id === systemId);
  if (!system) return <NotFound what="System" />;
  return (
    <main>
      <BackLink to="/">All systems</BackLink>
      <h1 className="mb-4 text-2xl font-bold">{system.name}</h1>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {system.modules.map((m) => (
          <li key={m.id}>
            <Link
              to={`/s/${system.id}/${m.id}`}
              className="panel flex min-h-28 flex-col justify-between gap-2 p-4 hover:bg-paper-2"
            >
              <span className="text-xl font-semibold">{m.title}</span>
              {m.blurb && <span className="text-grey-1">{m.blurb}</span>}
              <span className="text-sm text-grey-1">
                {m.cases.length} case{m.cases.length === 1 ? '' : 's'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
