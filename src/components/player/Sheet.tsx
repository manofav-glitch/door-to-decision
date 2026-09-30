// The decision sheet: bottom sheet on phones, side column on laptops.
// Keys: 1–9 pick/toggle options, Enter or Space continue/confirm.
import { useEffect, useRef, useState } from 'react';
import type { NodeOf, Option } from '../../content/schema';
import { formatNumber, type ActResult, type Input } from '../../engine/engine';
import type { DoseRange } from '../../engine/dose';
import { GradeChip } from '../ui';
import { ScoreBreakdown } from '../ScoreParts';

function useKeys(keys: { digit?: (n: number) => void; confirm?: () => void }) {
  const ref = useRef(keys);
  useEffect(() => {
    ref.current = keys;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : document.body;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.closest('dialog[open]')) return;
      if (/^[1-9]$/.test(e.key) && ref.current.digit) {
        e.preventDefault();
        ref.current.digit(Number(e.key));
      } else if (
        (e.key === 'Enter' || e.key === ' ') &&
        ref.current.confirm &&
        t.tagName !== 'BUTTON'
      ) {
        e.preventDefault();
        ref.current.confirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const keyHint =
  'hidden lg:inline-flex size-6 shrink-0 items-center justify-center border-2 border-grey-2 text-xs font-bold text-grey-1';

export function ContinueButton({
  onClick,
  label = 'Continue',
}: {
  onClick: () => void;
  label?: string;
}) {
  useKeys({ confirm: onClick });
  return (
    <button className="btn btn-primary w-full" onClick={onClick}>
      {label} <span className="hidden text-xs font-normal opacity-70 lg:inline">(Enter)</span>
    </button>
  );
}

export function ChoiceList({
  options,
  onPick,
}: {
  options: Option[];
  onPick: (id: string) => void;
}) {
  useKeys({ digit: (n) => options[n - 1] && onPick(options[n - 1]!.id!) });
  return (
    <ol className="flex flex-col gap-2">
      {options.map((o, i) => (
        <li key={o.id}>
          <button
            className="btn w-full justify-start text-left font-normal"
            onClick={() => onPick(o.id!)}
          >
            <span className={keyHint} aria-hidden="true">
              {i + 1}
            </span>
            <span>{o.label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function MultiSelect({
  node,
  options,
  onSubmit,
}: {
  node: NodeOf<'multiselect'>;
  options: Option[];
  onSubmit: (ids: string[]) => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const ok = chosen.length >= node.min && chosen.length <= node.max;
  const toggle = (id: string) =>
    setChosen((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : c.length < node.max ? [...c, id] : c,
    );
  useKeys({
    digit: (n) => options[n - 1] && toggle(options[n - 1]!.id!),
    confirm: () => ok && onSubmit(chosen),
  });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-grey-1" aria-live="polite">
        {chosen.length} of up to {node.max} chosen
      </p>
      <ul className="flex flex-col gap-2">
        {options.map((o, i) => {
          const on = chosen.includes(o.id!);
          const full = !on && chosen.length >= node.max;
          return (
            <li key={o.id}>
              <button
                className={`btn w-full justify-start text-left font-normal ${on ? 'bg-paper-2 ring-2 ring-ink' : ''}`}
                aria-pressed={on}
                disabled={full}
                onClick={() => toggle(o.id!)}
              >
                <span className={keyHint} aria-hidden="true">
                  {i + 1}
                </span>
                <span aria-hidden="true" className="w-5 shrink-0 text-lg leading-none">
                  {on ? '☑' : '☐'}
                </span>
                <span>{o.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        className="btn btn-primary mt-1 w-full"
        disabled={!ok}
        onClick={() => onSubmit(chosen)}
      >
        Confirm {chosen.length > 0 ? `(${chosen.length})` : ''}
      </button>
    </div>
  );
}

export function DoseForm({ unit, onSubmit }: { unit: string; onSubmit: (value: number) => void }) {
  const [text, setText] = useState('');
  const value = Number(text.replace(/,/g, ''));
  const ok = text.trim() !== '' && Number.isFinite(value) && value >= 0;
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSubmit(value);
      }}
    >
      <label className="flex items-center gap-2">
        <span className="sr-only">Dose</span>
        <input
          className="panel min-h-11 w-full min-w-0 px-3 text-lg tabular-nums"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <span className="shrink-0 font-semibold">{unit}</span>
      </label>
      <button className="btn btn-primary w-full" disabled={!ok}>
        Give
      </button>
    </form>
  );
}

/** Lead toggles in ECG reading order; mirrors the taps on the tracing. */
export function LeadGrid({
  leads,
  selected,
  onToggle,
  onSubmit,
}: {
  leads: string[];
  selected: string[];
  onToggle: (lead: string) => void;
  onSubmit: () => void;
}) {
  useKeys({ confirm: () => selected.length > 0 && onSubmit() });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-grey-1">Tap leads on the ECG, or here.</p>
      <div className="grid grid-cols-4 gap-2">
        {leads.map((l) => {
          const on = selected.includes(l);
          return (
            <button
              key={l}
              type="button"
              aria-pressed={on}
              className={`btn px-1 ${on ? 'btn-primary' : 'font-normal'}`}
              onClick={() => onToggle(l)}
            >
              {l}
            </button>
          );
        })}
      </div>
      <button
        className="btn btn-primary mt-1 w-full"
        disabled={selected.length === 0}
        onClick={onSubmit}
      >
        Confirm {selected.length > 0 ? `(${selected.length})` : ''}
      </button>
    </div>
  );
}

export function LeadsResult({ chosen, answer }: { chosen: string[]; answer: string[] }) {
  const missed = answer.filter((l) => !chosen.includes(l));
  const extra = chosen.filter((l) => !answer.includes(l));
  return (
    <p className="border-2 border-dashed border-grey-2 p-2 text-sm">
      Correct leads: <strong>{answer.join(', ')}</strong>
      {missed.length > 0 && <span className="block">Missed: {missed.join(', ')}</span>}
      {extra.length > 0 && <span className="block">Not affected: {extra.join(', ')}</span>}
    </p>
  );
}

/** Presenter mode: every option with its grade, so the room sees why each was right or wrong. */
export function AllOptions({ options, chosen }: { options: Option[]; chosen: string[] }) {
  return (
    <section className="mt-4 border-t-[3px] border-ink pt-3" aria-label="All options">
      <h3 className="mb-2 text-sm font-bold tracking-wider text-grey-1 uppercase">All options</h3>
      <ul className="flex flex-col gap-3">
        {options.map((o) => (
          <li
            key={o.id}
            className={`border-l-4 pl-3 ${o.grade === 'harmful' ? 'border-alarm' : o.grade === 'best' ? 'border-ink' : 'border-grey-2'}`}
          >
            <div className="flex flex-wrap items-start gap-2">
              <GradeChip grade={o.grade} />
              <span className="font-semibold">{o.label}</span>
              {chosen.includes(o.id!) && (
                <span className="text-xs font-bold tracking-wider uppercase">· chosen</span>
              )}
            </div>
            <p className="mt-1 text-grey-1">{o.teaching}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Feedback({
  res,
  onContinue,
  sources,
}: {
  res: ActResult;
  onContinue: () => void;
  sources?: string[];
}) {
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {res.dose && <DoseWorking dose={res.dose.expected} />}
      {res.leads && <LeadsResult chosen={res.leads.chosen} answer={res.leads.answer} />}
      {res.calc && (
        <ScoreBreakdown
          title={res.calc.title}
          yours={res.calc.yours}
          correct={res.calc.correct}
          sources={sources}
        />
      )}
      <ul className="flex flex-col gap-3">
        {res.picks.map((p) => (
          <li
            key={p.optionId}
            className={`border-l-4 pl-3 ${p.grade === 'harmful' ? 'border-alarm' : p.grade === 'best' ? 'border-ink' : 'border-grey-2'}`}
          >
            <div className="flex items-start gap-2">
              <GradeChip grade={p.grade} missed={p.missed} />
              <span className="font-semibold">{p.label}</span>
            </div>
            {!p.missed && <p className="mt-1">{p.consequence}</p>}
            <p className="mt-1 text-grey-1">{p.teaching}</p>
          </li>
        ))}
      </ul>
      <ContinueButton onClick={onContinue} />
    </div>
  );
}

export function DoseWorking({ dose }: { dose: DoseRange }) {
  return (
    <p className="border-2 border-dashed border-grey-2 p-2 text-sm">
      Expected:{' '}
      <strong>
        {dose.min === dose.max
          ? formatNumber(dose.min)
          : `${formatNumber(dose.min)}–${formatNumber(dose.max)}`}{' '}
        {dose.unit}
      </strong>
      <span className="block text-grey-1">{dose.working}</span>
    </p>
  );
}

export type { Input };
