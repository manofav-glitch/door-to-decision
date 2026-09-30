import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { findCase, index, isPlayable, useCase } from '../content/client';
import { BackLink, Difficulty, Loading, NotFound, UnverifiedBadge } from '../components/ui';
import { replay } from '../engine/engine';
import { useProgress, type Mode } from '../store/progress';
import { useSettings } from '../store/settings';

export function CaseSetup() {
  const { caseId = '' } = useParams();
  const found = findCase(caseId);
  const loaded = useCase(caseId);
  const navigate = useNavigate();
  const showDrafts = useSettings((s) => s.showDrafts);
  const { active, begin } = useProgress();
  const [setting, setSetting] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('learn');

  if (!found) return <NotFound what="Case" />;
  const { system, module, summary } = found;
  const back = <BackLink to={`/s/${system.id}/${module.id}`}>{module.title}</BackLink>;

  if (!isPlayable(summary, showDrafts))
    return (
      <main>
        {back}
        <p className="panel p-4">
          This case is a draft (unverified clinical content). Turn on{' '}
          <Link to="/settings" className="font-semibold underline">
            Show draft cases
          </Link>{' '}
          in Settings to play it.
        </p>
      </main>
    );
  if (loaded.status === 'loading') return <Loading />;
  if (loaded.status !== 'ready') return <NotFound what="Case" />;
  const c = loaded.value.data;

  const saved = active[caseId];
  let resumable = false;
  if (saved) {
    try {
      resumable = !replay(c, saved.setting, saved.inputs).ended;
    } catch {
      resumable = false; // content changed since the run started
    }
  }
  const chosenSetting = setting ?? summary.settings[0]?.id ?? null;
  const start = () => {
    begin({ caseId, setting: chosenSetting, mode, contentVersion: index.version });
    navigate(`/play/${caseId}`);
  };

  return (
    <main className="max-w-2xl">
      {back}
      <h1 className="mb-1 text-2xl font-bold">{summary.title}</h1>
      <p className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-grey-1">
        <Difficulty n={summary.difficulty} /> <span>~{summary.minutes} min</span>
        {summary.draft && <UnverifiedBadge />}
      </p>

      {resumable && saved && (
        <div className="panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <span>
            You have a case in progress ({saved.mode === 'learn' ? 'Learn' : 'Exam'} mode
            {saved.setting
              ? `, ${summary.settings.find((s) => s.id === saved.setting)?.label}`
              : ''}
            ).
          </span>
          <Link to={`/play/${caseId}`} className="btn btn-primary">
            Resume
          </Link>
        </div>
      )}

      {summary.settings.length > 0 && (
        <fieldset className="mb-6">
          <legend className="mb-2 text-lg font-bold">Where are you working?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {summary.settings.map((s) => (
              <label
                key={s.id}
                className={`panel flex cursor-pointer gap-3 p-4 ${chosenSetting === s.id ? 'bg-paper-2 ring-2 ring-ink' : ''}`}
              >
                <input
                  type="radio"
                  name="setting"
                  className="mt-1 size-5 shrink-0"
                  checked={chosenSetting === s.id}
                  onChange={() => setSetting(s.id)}
                />
                <span>
                  <span className="block font-semibold">
                    {s.label}
                    <span className="sr-only">. </span>
                  </span>
                  <span className="text-sm text-grey-1">{s.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="mb-8">
        <legend className="mb-2 text-lg font-bold">Mode</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['learn', 'Learn', 'Feedback after every decision.'],
              ['exam', 'Exam', 'No feedback until the debrief.'],
            ] as const
          ).map(([id, label, desc]) => (
            <label
              key={id}
              className={`panel flex cursor-pointer gap-3 p-4 ${mode === id ? 'bg-paper-2 ring-2 ring-ink' : ''}`}
            >
              <input
                type="radio"
                name="mode"
                className="mt-1 size-5 shrink-0"
                checked={mode === id}
                onChange={() => setMode(id)}
              />
              <span>
                <span className="block font-semibold">
                  {label}
                  <span className="sr-only">. </span>
                </span>
                <span className="text-sm text-grey-1">{desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button className="btn btn-primary w-full text-lg sm:w-auto" onClick={start}>
        {resumable ? 'Start again' : 'Start case'}
      </button>
      <p className="mt-3 text-sm text-grey-1">
        Decisions are final within a run. You can replay after the debrief.
      </p>
    </main>
  );
}
