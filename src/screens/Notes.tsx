// A unit's revision notes (content/<system>/<module>/notes.yaml), opened by playing the unit's cases.
import { Link, useParams } from 'react-router-dom';
import { index, useNotes, type LoadedNotes } from '../content/client';
import type { CompiledNoteBlock, ModuleSummary } from '../content/types';
import { NotesCard } from '../components/NotesCard';
import { EcgFigure } from '../components/player/EcgFigure';
import { BackLink, Loading, NotFound, UnverifiedBadge } from '../components/ui';
import { NOTES_STARS, useUnitNotes } from '../lib/notes';

export function Notes() {
  const { systemId, moduleId } = useParams();
  const system = index.systems.find((s) => s.id === systemId);
  const mod = system?.modules.find((m) => m.id === moduleId);
  if (!system || !mod) return <NotFound what="Module" />;
  return <NotesGate systemId={system.id} mod={mod} />;
}

function NotesGate({ systemId, mod }: { systemId: string; mod: ModuleSummary }) {
  const { key, access } = useUnitNotes(systemId, mod);
  const back = <BackLink to={`/s/${systemId}/${mod.id}`}>{mod.title}</BackLink>;
  if (access.state === 'none') return <NotFound what="Notes" />;
  if (access.state === 'locked')
    return (
      <main className="max-w-3xl">
        {back}
        <NotesCard systemId={systemId} mod={mod} />
      </main>
    );
  return <NotesLoader notesKey={key} back={back} preview={access.how === 'preview'} />;
}

function NotesLoader({
  notesKey,
  back,
  preview,
}: {
  notesKey: string;
  back: React.ReactNode;
  preview: boolean;
}) {
  const loaded = useNotes(notesKey);
  if (loaded.status === 'loading') return <Loading />;
  if (loaded.status !== 'ready') return <NotFound what="Notes" />;
  return <NotesView loaded={loaded.value} back={back} preview={preview} />;
}

function NotesView({
  loaded,
  back,
  preview,
}: {
  loaded: LoadedNotes;
  back: React.ReactNode;
  preview: boolean;
}) {
  const n = loaded.data;
  const jump = (i: number) => {
    const el = document.getElementById(`notes-${i}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  };
  return (
    <main className="max-w-3xl">
      <div className="print:hidden">{back}</div>
      <p className="text-sm font-semibold tracking-wider text-grey-1 uppercase">Unit notes</p>
      <h1 className="mb-2 flex flex-wrap items-center gap-3 text-2xl font-bold">
        {n.title} {n.draft && <UnverifiedBadge />}
      </h1>
      {preview && (
        <p className="mb-3 text-sm text-grey-1 print:hidden">
          Preview. Learners see these notes once they have {NOTES_STARS} or more stars on every case
          in the unit.
        </p>
      )}
      {n.intro && <p className="mb-4 text-lg">{n.intro}</p>}
      <p className="mb-6 print:hidden">
        <button type="button" className="btn" onClick={() => window.print()}>
          Save as PDF or print
        </button>
      </p>

      <nav aria-label="Contents" className="panel mb-8 p-4 print:hidden">
        <h2 className="mb-2 text-sm font-bold tracking-wider text-grey-1 uppercase">Contents</h2>
        <ol className="flex flex-col gap-1">
          {n.sections.map((s, i) => (
            <li key={s.heading}>
              {/* numbers drawn here, not by list-decimal, so they sit on a wrapped heading's first line */}
              <button
                type="button"
                className="flex min-h-8 gap-2 text-left underline-offset-4 hover:underline"
                onClick={() => jump(i)}
              >
                <span className="w-6 shrink-0 text-right tabular-nums">{i + 1}.</span>
                <span>{s.heading}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {n.sections.map((s, i) => (
        <section
          key={s.heading}
          id={`notes-${i}`}
          tabIndex={-1}
          aria-labelledby={`notes-${i}-h`}
          className="mb-8 scroll-mt-4 break-inside-avoid-page focus:outline-none"
        >
          <h2
            id={`notes-${i}-h`}
            className="mb-3 flex flex-wrap items-center gap-2 border-b-2 border-grey-2 pb-1 text-xl font-bold"
          >
            {s.heading} {!s.check.verified && <UnverifiedBadge />}
          </h2>
          <div className="flex flex-col gap-3">
            {s.blocks.map((b, bi) => (
              <Block key={bi} block={b} assets={loaded.assets} />
            ))}
          </div>
        </section>
      ))}

      {n.refs.length > 0 && (
        <section className="mt-8 border-t-2 border-grey-2 pt-3">
          <h2 className="mb-2 text-sm font-bold tracking-wider text-grey-1 uppercase">Sources</h2>
          <ol className="flex list-decimal flex-col gap-1 pl-6 text-sm text-grey-1">
            {n.refs.map((r) => (
              <li key={r.id}>{r.citation}</li>
            ))}
          </ol>
        </section>
      )}
      <p className="mt-6 text-sm text-grey-1">
        For learning only. Follow your local protocols and senior advice when treating patients.
      </p>
    </main>
  );
}

function Block({ block: b, assets }: { block: CompiledNoteBlock; assets: Record<string, string> }) {
  if (b.text) return <p>{b.text}</p>;
  if (b.points)
    return (
      <ul className="flex list-disc flex-col gap-1 pl-6">
        {b.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    );
  if (b.warn)
    return (
      <p className="border-l-4 border-alarm pl-3">
        <strong className="text-alarm">Watch out: </strong>
        {b.warn}
      </p>
    );
  if (b.table)
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {b.table.head.map((h) => (
                <th key={h} scope="col" className="border-2 border-ink bg-paper-2 p-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border-2 border-ink p-2 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if (b.ecg)
    return (
      <div className="break-inside-avoid">
        <EcgFigure src={assets[b.ecg]!} alt={b.alt!} />
        {b.caption && <p className="mt-1 text-sm text-grey-1">{b.caption}</p>}
      </div>
    );
  if (b.cards)
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm print:hidden">
        <span className="font-semibold text-grey-1">In the Codex:</span>
        {b.cards.map((c) => (
          <Link
            key={c.id}
            to={`/codex/${c.id}`}
            className="inline-flex min-h-9 items-center border-2 border-ink px-2 hover:bg-paper-2"
          >
            {c.title}
          </Link>
        ))}
      </p>
    );
  return null;
}
