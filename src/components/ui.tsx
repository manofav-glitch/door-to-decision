import { Link } from 'react-router-dom';
import type { Grade } from '../content/schema';

export function UnverifiedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block border-2 border-dashed border-grey-1 px-1.5 text-xs font-bold tracking-wider text-grey-1 ${className}`}
      title="Contains clinical content not yet verified by the content owner"
    >
      UNVERIFIED
    </span>
  );
}

const gradeStyle: Record<Grade, string> = {
  best: 'bg-ink text-paper border-ink',
  acceptable: 'border-ink text-ink',
  suboptimal: 'border-grey-1 text-grey-1 border-dashed',
  harmful: 'bg-alarm text-paper border-alarm',
};
const gradeText: Record<Grade, string> = {
  best: 'Best',
  acceptable: 'Acceptable',
  suboptimal: 'Suboptimal',
  harmful: 'Harmful',
};

export function GradeChip({ grade, missed }: { grade: Grade; missed?: boolean }) {
  return (
    <span
      className={`inline-block shrink-0 border-2 px-1.5 text-xs font-bold tracking-wider uppercase ${gradeStyle[grade]}`}
    >
      {missed ? 'Missed' : gradeText[grade]}
    </span>
  );
}

export function Stars({ n, of = 3, label }: { n: number; of?: number; label?: string }) {
  return (
    <span
      role="img"
      aria-label={label ?? `${n} of ${of} stars`}
      className="tracking-widest whitespace-nowrap"
    >
      {Array.from({ length: of }, (_, i) => (i < n ? '★' : '☆')).join('')}
    </span>
  );
}

export function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="mb-3 inline-flex min-h-11 items-center text-grey-1 underline-offset-4 hover:underline"
    >
      ← {children}
    </Link>
  );
}

export function Loading() {
  return <p className="py-8 text-grey-1">Loading…</p>;
}

export function NotFound({ what }: { what: string }) {
  return (
    <main className="py-8">
      <p className="mb-4">{what} not found.</p>
      <Link to="/" className="btn">
        Home
      </Link>
    </main>
  );
}

export function Difficulty({ n }: { n: number }) {
  return <span aria-label={`Difficulty ${n} of 3`}>{'●'.repeat(n) + '○'.repeat(3 - n)}</span>;
}
