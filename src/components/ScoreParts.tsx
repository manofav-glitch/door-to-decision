// Shared pieces for risk scores: the in-case calculator form, the item-by-item breakdown,
// and the standalone calculator used on Codex score cards.
import { useState } from 'react';
import type { ScoreAnswer, ScoreDef, ScoreItem } from '../content/schema';
import { scoreResult, toBaseUnit, type ScoreResult } from '../clinical/score';

// ---------- in-case calculator: tap one answer per item ----------

/** Choices for an item as tappable options (number items show their bins). */
function choicesFor(item: ScoreItem): { key: string; label: string; answer: ScoreAnswer }[] {
  switch (item.type) {
    case 'choice':
      return item.options.map((o) => ({ key: o.id, label: o.label, answer: o.id }));
    case 'yesno':
      return [
        { key: 'no', label: 'No', answer: false },
        { key: 'yes', label: 'Yes', answer: true },
      ];
    case 'number':
      return item.bins.map((b, i) => ({
        key: String(i),
        label: `${b.label} ${item.unit}`,
        answer: { bin: i },
      }));
  }
}

export function CalcForm({
  def,
  onSubmit,
}: {
  def: ScoreDef;
  onSubmit: (a: Record<string, ScoreAnswer>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, { key: string; answer: ScoreAnswer }>>({});
  const done = def.items.every((i) => answers[i.id]);
  const plain = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.answer]));
  const total = scoreResult(def, plain).total;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (done) onSubmit(plain);
      }}
    >
      {def.items.map((item) => (
        <fieldset key={item.id}>
          <legend className="mb-1 font-semibold">
            {item.label}
            {item.hint && (
              <span className="block text-sm font-normal text-grey-1">{item.hint}</span>
            )}
          </legend>
          <div className="flex flex-col gap-1.5">
            {choicesFor(item).map((ch) => {
              const on = answers[item.id]?.key === ch.key;
              return (
                <label
                  key={ch.key}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 border-2 px-3 py-1.5 ${on ? 'border-ink bg-paper-2' : 'border-grey-2'}`}
                >
                  <input
                    type="radio"
                    name={item.id}
                    className="size-5 shrink-0"
                    checked={on}
                    onChange={() => setAnswers((a) => ({ ...a, [item.id]: ch }))}
                  />
                  <span>{ch.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <p className="text-sm text-grey-1" aria-live="polite">
        Your total so far: <strong className="text-ink">{total}</strong>
      </p>
      <button className="btn btn-primary w-full" disabled={!done}>
        Check my score
      </button>
    </form>
  );
}

// ---------- breakdown: yours vs correct ----------

export function ScoreBreakdown({
  title,
  yours,
  correct,
  sources,
}: {
  title: string;
  yours?: ScoreResult;
  correct: ScoreResult;
  sources?: string[];
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="font-semibold">{title}</p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-ink text-left text-xs tracking-wider text-grey-1 uppercase">
            <th className="py-1 pr-2 font-semibold">Item</th>
            {yours && <th className="py-1 pr-2 font-semibold">You</th>}
            <th className="py-1 font-semibold">{yours ? 'Correct' : 'Answer'}</th>
          </tr>
        </thead>
        <tbody>
          {correct.items.map((c, i) => {
            const y = yours?.items[i];
            const miss = y && y.points !== c.points;
            return (
              <tr key={c.id} className="border-b border-grey-2 align-top">
                <td className="py-1.5 pr-2 font-semibold">{c.label}</td>
                {yours && (
                  <td className={`py-1.5 pr-2 ${miss ? 'font-semibold' : 'text-grey-1'}`}>
                    {miss ? '✗ ' : '✓ '}
                    {y?.answer} <Pts n={y?.points} />
                  </td>
                )}
                <td className="py-1.5">
                  {c.answer} <Pts n={c.points} />
                </td>
              </tr>
            );
          })}
          <tr className="font-bold">
            <td className="py-1.5 pr-2">Total</td>
            {yours && <td className="py-1.5 pr-2">{yours.total}</td>}
            <td className="py-1.5">{correct.total}</td>
          </tr>
        </tbody>
      </table>
      <ResultLine r={correct} />
      {sources && sources.length > 0 && (
        <p className="text-xs text-grey-1">Source: {sources.join(' · ')}</p>
      )}
    </div>
  );
}

function Pts({ n }: { n: number | undefined }) {
  return n === undefined ? null : <span className="text-grey-1 tabular-nums">({n})</span>;
}

function ResultLine({ r }: { r: ScoreResult }) {
  return (
    <p className="border-2 border-ink p-2">
      {r.band && (
        <span className="block">
          <strong>{r.band.label}</strong>
          {r.band.risk && ` · ${r.band.risk}`}
        </span>
      )}
      {r.risk && (
        <span className="block">
          {r.risk.label}: <strong>{r.risk.value}</strong>
        </span>
      )}
    </p>
  );
}

// ---------- standalone calculator (Codex) ----------

type Entry = { choice?: string; yes?: boolean; text?: string; unit?: string };

export function ScoreCalculator({
  def,
  sources,
  bandsSource,
}: {
  def: ScoreDef;
  sources: string[];
  bandsSource?: string;
}) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const set = (id: string, e: Entry) => setEntries((x) => ({ ...x, [id]: { ...x[id], ...e } }));

  const answers: Record<string, ScoreAnswer> = {};
  for (const item of def.items) {
    const e = entries[item.id];
    if (!e) continue;
    if (item.type === 'choice' && e.choice) answers[item.id] = e.choice;
    if (item.type === 'yesno' && e.yes !== undefined) answers[item.id] = e.yes;
    if (item.type === 'number' && e.text?.trim()) {
      const v = Number(e.text.replace(',', '.'));
      if (Number.isFinite(v)) answers[item.id] = toBaseUnit(item, v, e.unit ?? item.unit);
    }
  }
  const r = scoreResult(def, answers);
  const pointsOf = (id: string) => r.items.find((i) => i.id === id)?.points;

  return (
    <section className="panel mb-6 p-4" aria-label="Calculator">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Calculator</h2>
        <button type="button" className="btn px-3 text-sm" onClick={() => setEntries({})}>
          Reset
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {def.items.map((item) => (
          <fieldset key={item.id} className="border-b border-grey-2 pb-3">
            <legend className="flex w-full items-baseline justify-between gap-2 font-semibold">
              <span>{item.label}</span>
              <span className="text-sm text-grey-1 tabular-nums">
                {pointsOf(item.id) === undefined ? '—' : `${pointsOf(item.id)} pt`}
              </span>
            </legend>
            {item.hint && <p className="text-sm text-grey-1">{item.hint}</p>}
            {item.type === 'choice' && (
              <div className="mt-1 flex flex-col gap-1.5">
                {item.options.map((o) => (
                  <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name={`calc-${item.id}`}
                      className="size-5 shrink-0"
                      checked={entries[item.id]?.choice === o.id}
                      onChange={() => set(item.id, { choice: o.id })}
                    />
                    <span className="flex-1">{o.label}</span>
                    <span className="text-sm text-grey-1 tabular-nums">{o.points}</span>
                  </label>
                ))}
              </div>
            )}
            {item.type === 'yesno' && (
              <div className="mt-1 flex gap-4">
                {[false, true].map((v) => (
                  <label
                    key={String(v)}
                    className="flex min-h-11 cursor-pointer items-center gap-2"
                  >
                    <input
                      type="radio"
                      name={`calc-${item.id}`}
                      className="size-5"
                      checked={entries[item.id]?.yes === v}
                      onChange={() => set(item.id, { yes: v })}
                    />
                    {v ? `Yes (${item.points})` : 'No (0)'}
                  </label>
                ))}
              </div>
            )}
            {item.type === 'number' && (
              <div className="mt-1 flex items-center gap-2">
                <input
                  className="panel min-h-11 w-32 px-3 tabular-nums"
                  inputMode="decimal"
                  aria-label={`${item.label} value`}
                  value={entries[item.id]?.text ?? ''}
                  onChange={(e) => set(item.id, { text: e.target.value })}
                />
                {item.altUnits.length > 0 ? (
                  <select
                    className="panel min-h-11 px-2"
                    aria-label={`${item.label} unit`}
                    value={entries[item.id]?.unit ?? item.unit}
                    onChange={(e) => set(item.id, { unit: e.target.value })}
                  >
                    {[item.unit, ...item.altUnits.map((u) => u.unit)].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold">{item.unit}</span>
                )}
                {answers[item.id] !== undefined && (
                  <span className="text-sm text-grey-1">
                    {r.items.find((i) => i.id === item.id)?.answer.replace(/^.*\(|\)$/g, '')}
                  </span>
                )}
              </div>
            )}
          </fieldset>
        ))}
      </div>
      <div className="mt-4" aria-live="polite">
        <p className="text-2xl font-bold">
          Total {r.total}
          {!r.complete && (
            <span className="ml-2 text-sm font-normal text-grey-1">(answer every item)</span>
          )}
        </p>
        {r.complete && <ResultLine r={r} />}
        <p className="mt-2 text-xs text-grey-1">
          Source: {sources.join(' · ')}
          {bandsSource && ` · Risk categories: ${bandsSource}`}
        </p>
      </div>
    </section>
  );
}
