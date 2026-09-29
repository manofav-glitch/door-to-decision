import { Link, useSearchParams } from 'react-router-dom';
import { useCodex } from '../content/client';
import { CODEX_KINDS, type CodexEntry, type CodexKind } from '../content/types';
import { Loading, UnverifiedBadge } from '../components/ui';
import { useProgress } from '../store/progress';

export const kindLabel: Record<CodexKind, string> = {
  anatomy: 'Anatomy',
  pathology: 'Pathology',
  drugs: 'Drugs',
  scores: 'Scores',
  ecg: 'ECG',
};

/** All searchable text of a card, lower-cased. */
function haystack(c: CodexEntry): string {
  return [
    c.title,
    c.summary,
    c.india,
    ...c.sections.flatMap((s) => [s.heading, s.body]),
    ...c.doses.flatMap((d) => [d.label, d.text]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function Codex() {
  const codex = useCodex();
  const unlocked = useProgress((s) => s.unlocked);
  const [params, setParams] = useSearchParams();
  const tab = (CODEX_KINDS as string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as CodexKind)
    : 'anatomy';
  const q = params.get('q') ?? '';
  const update = (next: { tab?: CodexKind; q?: string }) => {
    const p = new URLSearchParams(params);
    if (next.tab) p.set('tab', next.tab);
    if (next.q !== undefined) {
      if (next.q) p.set('q', next.q);
      else p.delete('q');
    }
    setParams(p, { replace: true });
  };

  if (codex.status === 'loading') return <Loading />;
  const cards = codex.status === 'ready' ? codex.value : [];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const searching = words.length > 0;
  const shown = searching
    ? cards.filter((c) => {
        const h = haystack(c);
        return words.every((w) => h.includes(w));
      })
    : cards.filter((c) => c.kind === tab);

  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold">Codex</h1>
      <p className="mb-4 text-grey-1">
        Anatomy, pathology, drugs, scores and ECG patterns. Cases unlock cards; everything is open
        to browse.
      </p>

      <label className="mb-4 flex flex-col gap-1">
        <span className="sr-only">Search the Codex</span>
        <input
          type="search"
          className="panel min-h-11 px-3"
          placeholder="Search, e.g. heparin, V4R, Killip…"
          value={q}
          onChange={(e) => update({ q: e.target.value })}
        />
      </label>

      {!searching && (
        <div role="tablist" aria-label="Codex sections" className="mb-4 flex flex-wrap gap-2">
          {CODEX_KINDS.map((k) => {
            const n = cards.filter((c) => c.kind === k).length;
            return (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                className={`btn shrink-0 px-3 font-normal ${tab === k ? 'btn-primary' : ''}`}
                onClick={() => update({ tab: k })}
              >
                {kindLabel[k]} <span className="text-sm opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {searching && (
        <p className="mb-3 text-sm text-grey-1" aria-live="polite">
          {shown.length} card{shown.length === 1 ? '' : 's'} match “{q}”
        </p>
      )}

      {shown.length === 0 && !searching && (
        <p className="panel border-dashed p-4 text-grey-1">No {kindLabel[tab]} cards yet.</p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((c) => (
          <li key={c.id}>
            <Link
              to={`/codex/${c.id}`}
              className="panel flex h-full flex-col gap-1 p-4 hover:bg-paper-2"
            >
              <span className="flex flex-wrap items-center gap-2">
                {searching && (
                  <span className="text-xs font-semibold tracking-wider text-grey-1 uppercase">
                    {kindLabel[c.kind]}
                  </span>
                )}
                <span className="font-semibold">{c.title}</span>
              </span>
              <span className="line-clamp-2 text-sm text-grey-1">{c.summary}</span>
              <span className="mt-1 flex flex-wrap gap-2 text-xs">
                {unlocked.includes(c.id) && <span className="font-semibold">✓ Unlocked</span>}
                {c.score && <span className="font-semibold">Calculator</span>}
                {c.draft && <UnverifiedBadge />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
