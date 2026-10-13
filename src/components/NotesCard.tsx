// The unit's notes on the module screen: locked (with progress towards unlocking) or open.
import { Link } from 'react-router-dom';
import type { ModuleSummary } from '../content/types';
import { NOTES_STARS, useUnitNotes, type NotesProgress } from '../lib/notes';
import { Stars, UnverifiedBadge } from './ui';

export function NotesProgressBar({ progress, label }: { progress: NotesProgress; label: string }) {
  return (
    <div
      className="h-3 w-full border-2 border-ink"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.done}
      aria-valuetext={`${progress.done} of ${progress.total} cases`}
    >
      <div
        className="h-full bg-ink"
        style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
      />
    </div>
  );
}

export function NotesCard({ systemId, mod }: { systemId: string; mod: ModuleSummary }) {
  const { access } = useUnitNotes(systemId, mod);
  if (access.state === 'none' || !mod.notes) return null;
  const { title, headings, draft } = mod.notes;
  const inside = (
    <p className="text-sm text-grey-1">
      <span className="font-semibold">Inside:</span> {headings.join(' · ')}
    </p>
  );

  if (access.state === 'open')
    return (
      <Link
        to={`/s/${systemId}/${mod.id}/notes`}
        className="panel mt-6 flex flex-col gap-2 p-4 hover:bg-paper-2"
      >
        <span className="text-sm font-bold tracking-wider text-grey-1 uppercase">
          Unit notes {access.how === 'preview' ? '· preview' : '· unlocked'}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          {title} {draft && <UnverifiedBadge />}
        </span>
        {inside}
        <span className="font-semibold underline underline-offset-4">Read the notes →</span>
      </Link>
    );

  const { progress } = access;
  return (
    <section
      className="panel mt-6 flex flex-col gap-3 border-dashed p-4"
      aria-labelledby="notes-locked"
    >
      <p className="text-sm font-bold tracking-wider text-grey-1 uppercase">Unit notes · locked</p>
      <h2 id="notes-locked" className="text-lg font-semibold">
        {title}
      </h2>
      <p>
        Get <Stars n={NOTES_STARS} label={`${NOTES_STARS} stars`} /> or more on every case in this
        unit to unlock its notes: a summary of the whole unit to revise from.
      </p>
      <NotesProgressBar progress={progress} label="Cases towards the notes" />
      <p className="text-sm font-semibold">
        {progress.done} of {progress.total} cases done
      </p>
      {inside}
    </section>
  );
}

/** On a debrief: celebrates the case that unlocked the notes, or shows progress towards them. */
export function DebriefNotes({ systemId, mod }: { systemId: string; mod: ModuleSummary }) {
  const { access, fresh } = useUnitNotes(systemId, mod);
  if (access.state === 'none' || !mod.notes) return null;
  const to = `/s/${systemId}/${mod.id}/notes`;
  if (fresh)
    return (
      <section className="panel mb-8 flex flex-col gap-3 p-4" aria-labelledby="notes-earned">
        <h2 id="notes-earned" className="text-xl font-bold">
          Unit complete: notes unlocked
        </h2>
        <p>
          You have <Stars n={NOTES_STARS} label={`${NOTES_STARS} stars`} /> or more on every{' '}
          {mod.title} case. Your reward is <strong>{mod.notes.title}</strong>, a summary of the
          whole unit to revise from.
        </p>
        <Link to={to} className="btn btn-primary self-start">
          Read the notes
        </Link>
      </section>
    );
  if (access.state === 'open')
    return (
      <p className="mb-8">
        <Link to={to} className="font-semibold underline underline-offset-4">
          Read the {mod.notes.title} →
        </Link>
      </p>
    );
  const { progress } = access;
  return (
    <section className="mb-8 flex flex-col gap-2" aria-label="Progress towards the unit notes">
      <p className="text-sm">
        <span className="font-semibold">Unit notes:</span> {progress.done} of {progress.total} cases
        have <Stars n={NOTES_STARS} label={`${NOTES_STARS} stars`} /> or more. Get there on every
        case to unlock them.
      </p>
      <NotesProgressBar progress={progress} label="Cases towards the unit notes" />
    </section>
  );
}
