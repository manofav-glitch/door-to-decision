import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { findCase, index, useCase, type LoadedCase } from '../content/client';
import { DoseWorking } from '../components/player/Sheet';
import { BackLink, GradeChip, Loading, NotFound, Stars, UnverifiedBadge } from '../components/ui';
import { idealRun, replay, result, type LogEntry, type RunState } from '../engine/engine';
import { useProgress, type SavedRun } from '../store/progress';

export function Debrief() {
  const { caseId = '' } = useParams();
  const loaded = useCase(caseId);
  const saved = useProgress((s) => s.finished[caseId]);
  if (!findCase(caseId)) return <NotFound what="Case" />;
  if (!saved) return <Navigate to={`/case/${caseId}`} replace />;
  if (loaded.status === 'loading') return <Loading />;
  if (loaded.status !== 'ready') return <NotFound what="Case" />;
  return <DebriefView loaded={loaded.value} saved={saved} />;
}

const outcomeText = { good: 'Good outcome', fair: 'Fair outcome', critical: 'Critical outcome' };

function DebriefView({ loaded, saved }: { loaded: LoadedCase; saved: SavedRun }) {
  const c = loaded.data;
  const navigate = useNavigate();
  const begin = useProgress((s) => s.begin);
  const [showIdeal, setShowIdeal] = useState(false);
  const found = findCase(c.id)!;

  let run: RunState;
  try {
    run = replay(c, saved.setting, saved.inputs);
  } catch {
    return (
      <main>
        <p className="panel mb-4 p-4">
          This case has changed since you played it, so the debrief can't be rebuilt.
        </p>
        <Link to={`/case/${c.id}`} className="btn btn-primary">
          Play again
        </Link>
      </main>
    );
  }
  const r = result(c, run);
  const ideal = idealRun(c, saved.setting);
  const idealByNode = new Map(ideal.log.map((e) => [e.nodeId, e]));
  const settingLabel = c.settings.find((s) => s.id === saved.setting)?.label;

  const replayRun = () => {
    begin({
      caseId: c.id,
      setting: saved.setting,
      mode: saved.mode,
      contentVersion: index.version,
    });
    navigate(`/play/${c.id}`);
  };

  return (
    <main className="max-w-3xl">
      <BackLink to={`/s/${found.system.id}/${found.module.id}`}>{found.module.title}</BackLink>
      <p className="text-sm font-semibold tracking-wider text-grey-1 uppercase">Debrief</p>
      <h1 className="mb-1 text-2xl font-bold">{c.title}</h1>
      <p className="mb-6 flex flex-wrap items-center gap-x-3 text-grey-1">
        {settingLabel && <span>{settingLabel}</span>}
        <span>{saved.mode === 'learn' ? 'Learn mode' : 'Exam mode'}</span>
        {c.draft && <UnverifiedBadge />}
      </p>

      <section className="panel mb-6 p-4" aria-labelledby="dx">
        <h2 id="dx" className="mb-1 text-sm font-bold tracking-wider text-grey-1 uppercase">
          Diagnosis
        </h2>
        <p className="text-xl font-semibold">{c.debrief.diagnosis}</p>
      </section>

      <section className="mb-8 grid gap-4 sm:grid-cols-3" aria-label="Result">
        <div className="panel p-4 sm:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={`text-lg font-bold ${r.outcome === 'critical' ? 'text-alarm' : ''}`}>
              {outcomeText[r.outcome]}
            </span>
            <span className="text-3xl">
              <Stars n={r.stars} />
            </span>
          </div>
        </div>
        <Meter label="Patient">
          <div
            className="h-3 w-full border-2 border-ink"
            role="meter"
            aria-valuenow={r.patient}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Patient meter"
          >
            <div
              className={`h-full ${r.patient < 40 ? 'bg-alarm' : 'bg-ink'}`}
              style={{ width: `${r.patient}%` }}
            />
          </div>
          <span className="text-sm text-grey-1">{r.patient} / 100</span>
        </Meter>
        <Meter label="Time">
          {r.time.length === 0 && <span className="text-sm text-grey-1">No time targets</span>}
          <ul className="flex flex-col gap-1 text-sm">
            {r.time.map((t) => (
              <li key={t.id}>
                <span className={t.met ? '' : 'font-semibold'}>{t.met ? '✓' : '✗'} </span>
                {t.label}: {t.actualMin === null ? 'not reached' : `${t.actualMin} min`}{' '}
                <span className="text-grey-1">(target ≤ {t.targetMin})</span>
              </li>
            ))}
          </ul>
        </Meter>
        <Meter label="Safety">
          <span className={`text-lg font-bold ${r.safetyEvents ? 'text-alarm' : ''}`}>
            {r.safetyEvents === 0
              ? 'No harmful decisions'
              : `${r.safetyEvents} harmful decision${r.safetyEvents === 1 ? '' : 's'}`}
          </span>
        </Meter>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Your decisions</h2>
          <button className="btn" aria-expanded={showIdeal} onClick={() => setShowIdeal((v) => !v)}>
            {showIdeal ? 'Hide ideal path' : 'Show ideal path'}
          </button>
        </div>
        {showIdeal && (
          <ol className="panel mb-4 flex flex-col gap-2 border-dashed p-4">
            <li className="text-sm font-bold tracking-wider text-grey-1 uppercase">
              Ideal path ({settingLabel ?? 'this case'})
            </li>
            {ideal.log.map((e) => (
              <li key={e.nodeId}>
                <span className="text-grey-1">{e.prompt}</span> →{' '}
                <strong>
                  {e.picks
                    .filter((p) => !p.missed)
                    .map((p) => p.label)
                    .join('; ')}
                </strong>
              </li>
            ))}
          </ol>
        )}
        <ol className="flex flex-col gap-4">
          {run.log.map((e, i) => (
            <Decision key={i} entry={e} ideal={idealByNode.get(e.nodeId)} />
          ))}
        </ol>
      </section>

      <TextList title="Key points" items={c.debrief.keyPoints} />
      {c.debrief.pitfalls.length > 0 && <TextList title="Pitfalls" items={c.debrief.pitfalls} />}

      {c.debrief.unlocks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-bold">Codex cards unlocked</h2>
          <ul className="flex flex-wrap gap-2">
            {c.debrief.unlocks.map((u) => (
              <li key={u.id}>
                <Link to={`/codex/${u.id}`} className="btn font-normal">
                  <span className="text-xs text-grey-1 uppercase">{u.kind}</span> {u.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.debrief.refs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-bold">References</h2>
          <ol className="flex list-decimal flex-col gap-1 pl-6 text-sm">
            {c.debrief.refs.map((ref) => (
              <li key={ref.id}>
                {ref.url ? (
                  <a href={ref.url} className="underline" target="_blank" rel="noreferrer">
                    {ref.citation}
                  </a>
                ) : (
                  ref.citation
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap gap-3 border-t-[3px] border-ink pt-4">
        <button className="btn btn-primary" onClick={replayRun}>
          Replay
        </button>
        <Link to={`/case/${c.id}`} className="btn">
          Change setting or mode
        </Link>
        <Link to={`/s/${found.system.id}/${found.module.id}`} className="btn">
          Back to cases
        </Link>
      </div>
    </main>
  );
}

function Meter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel flex flex-col gap-2 p-4">
      <h3 className="text-sm font-bold tracking-wider text-grey-1 uppercase">{label}</h3>
      {children}
    </div>
  );
}

function Decision({ entry, ideal }: { entry: LogEntry; ideal?: LogEntry }) {
  const allBest = entry.picks.every((p) => p.grade === 'best' && !p.missed);
  const idealLabels = ideal?.picks.filter((p) => !p.missed).map((p) => p.label);
  return (
    <li className="panel p-4">
      <p className="mb-2 text-sm text-grey-1">
        +{entry.atMinutes} min · <span className="font-semibold text-ink">{entry.prompt}</span>
      </p>
      {entry.dose && <DoseWorking dose={entry.dose.expected} />}
      <ul className="mt-2 flex flex-col gap-3">
        {entry.picks.map((p) => (
          <li key={p.optionId}>
            <div className="flex items-start gap-2">
              <GradeChip grade={p.grade} missed={p.missed} />
              <span className="font-semibold">{p.label}</span>
            </div>
            {!p.missed && <p className="mt-1">{p.consequence}</p>}
            <p className="mt-1 text-grey-1">{p.teaching}</p>
          </li>
        ))}
      </ul>
      {!allBest && idealLabels && entry.type !== 'multiselect' && entry.type !== 'dose' && (
        <p className="mt-3 border-t-2 border-dashed border-grey-2 pt-2 text-sm">
          <span className="font-semibold">Ideal:</span> {idealLabels.join('; ')}
        </p>
      )}
    </li>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      <ul className="flex list-disc flex-col gap-2 pl-6">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
