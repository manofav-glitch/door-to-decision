import { Link, useParams } from 'react-router-dom';
import { index, isPlayable } from '../content/client';
import { BackLink, Difficulty, NotFound, Stars, UnverifiedBadge } from '../components/ui';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';

export function Module() {
  const { systemId, moduleId } = useParams();
  const showDrafts = useSettings((s) => s.showDrafts);
  const { bestStars, active } = useProgress();
  const system = index.systems.find((s) => s.id === systemId);
  const mod = system?.modules.find((m) => m.id === moduleId);
  if (!system || !mod) return <NotFound what="Module" />;
  const cases = mod.cases.filter((c) => isPlayable(c, showDrafts));
  const hidden = mod.cases.length - cases.length;

  return (
    <main>
      <BackLink to={`/s/${system.id}`}>{system.name}</BackLink>
      <h1 className="mb-1 text-2xl font-bold">{mod.title}</h1>
      {mod.blurb && <p className="mb-6 text-grey-1">{mod.blurb}</p>}
      <ul className="flex flex-col gap-3">
        {cases.map((c, i) => (
          <li key={c.id}>
            <Link
              to={`/case/${c.id}`}
              className="panel flex min-h-20 items-center gap-4 p-4 hover:bg-paper-2"
            >
              <span className="text-2xl font-bold text-grey-1 tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-lg font-semibold">{c.title}</span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-grey-1">
                  <Difficulty n={c.difficulty} />
                  <span>~{c.minutes} min</span>
                  {active[c.id] && <span className="font-semibold text-ink">In progress</span>}
                  {c.draft && <UnverifiedBadge />}
                </span>
              </span>
              <Stars n={bestStars[c.id] ?? 0} />
            </Link>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="panel mt-6 border-dashed p-4 text-grey-1">
          {hidden} draft case{hidden === 1 ? ' is' : 's are'} hidden because{' '}
          {hidden === 1 ? 'it contains' : 'they contain'} clinical content that hasn't been verified
          yet. To play drafts, turn on{' '}
          <Link to="/settings" className="font-semibold text-ink underline">
            Show draft cases
          </Link>{' '}
          in Settings.
        </p>
      )}
    </main>
  );
}
