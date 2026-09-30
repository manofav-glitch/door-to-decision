import { DISCLAIMER } from '../components/Disclaimer';
import { index } from '../content/client';
import { useProgress } from '../store/progress';
import { useSettings, type TextSize, type Theme } from '../store/settings';

function Row({
  label,
  children,
  asLabel,
}: {
  label: string;
  children: React.ReactNode;
  asLabel?: boolean;
}) {
  // asLabel: the whole row is the tap target for a checkbox (≥ 44 px), not just the box
  const Tag = asLabel ? 'label' : 'div';
  return (
    <Tag
      className={`flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-grey-2 py-2 ${asLabel ? 'cursor-pointer' : ''}`}
    >
      <span className="font-semibold">{label}</span>
      {children}
    </Tag>
  );
}

const selectClass = 'panel min-h-11 px-2';

export function Settings() {
  const s = useSettings();
  return (
    <main className="max-w-xl">
      <h1 className="mb-4 text-2xl font-bold">Settings &amp; About</h1>

      <Row label="Theme">
        <select
          className={selectClass}
          value={s.theme}
          aria-label="Theme"
          onChange={(e) => s.set({ theme: e.target.value as Theme })}
        >
          <option value="system">Match device</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </Row>
      <Row label="Text size">
        <select
          className={selectClass}
          value={s.textSize}
          aria-label="Text size"
          onChange={(e) => s.set({ textSize: e.target.value as TextSize })}
        >
          <option value="normal">Normal</option>
          <option value="large">Large</option>
          <option value="xlarge">Extra large</option>
        </select>
      </Row>
      <Row label="Reduce motion" asLabel>
        <input
          type="checkbox"
          className="size-6"
          aria-label="Reduce motion"
          checked={s.reduceMotion}
          onChange={(e) => s.set({ reduceMotion: e.target.checked })}
        />
      </Row>
      <Row label="Show draft cases" asLabel>
        <input
          type="checkbox"
          className="size-6"
          aria-label="Show draft cases"
          checked={s.showDrafts}
          onChange={(e) => s.set({ showDrafts: e.target.checked })}
        />
      </Row>
      <p className="py-2 text-sm text-grey-1">
        Draft cases contain clinical content that has not been verified by the content owner.
      </p>
      <Row label="Clear revise deck">
        <button
          className="panel min-h-11 px-3"
          onClick={() => {
            if (window.confirm('Remove every question from your Revise deck?'))
              useProgress.getState().clearDeck();
          }}
        >
          Clear
        </button>
      </Row>
      <Row label="Reset progress">
        <button
          className="panel min-h-11 px-3"
          onClick={() => {
            if (window.confirm('Reset all settings and progress on this device?')) {
              s.reset();
              localStorage.clear();
              window.location.reload();
            }
          }}
        >
          Reset
        </button>
      </Row>

      <h2 className="mt-8 mb-2 text-xl font-bold">About</h2>
      <p className="panel mb-3 p-4" role="note">
        {DISCLAIMER}
      </p>
      <p className="text-sm text-grey-1">Content version: {index.version}</p>
    </main>
  );
}
