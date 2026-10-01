import { formatBytes, offlineSupported, useOfflineArt } from '../lib/offline';

/** "Save pictures for offline" button with progress; renders nothing when there are no pictures. */
export function OfflineArt({
  caseIds,
  bytes,
  label,
  allowRemove,
}: {
  caseIds: string[];
  bytes: number;
  label: string;
  allowRemove?: boolean;
}) {
  const { status, saveAll, removeAll } = useOfflineArt(caseIds);
  if (!offlineSupported() || status.state === 'checking' || status.total === 0) return null;
  const done = status.state === 'ready' && status.saved === status.total;
  return (
    <div className="flex flex-wrap items-center gap-3" aria-live="polite">
      {status.state === 'saving' ? (
        <span>
          Saving pictures… {status.saved} of {status.total}
        </span>
      ) : done ? (
        <span>✓ Pictures saved for offline</span>
      ) : (
        <button className="btn" onClick={() => void saveAll()}>
          {label} ({formatBytes(bytes)})
        </button>
      )}
      {allowRemove && status.state === 'ready' && status.saved > 0 && (
        <button
          className="btn"
          onClick={() => {
            if (
              window.confirm(
                'Remove the saved pictures from this device? They download again when needed.',
              )
            )
              void removeAll();
          }}
        >
          Remove saved pictures
        </button>
      )}
      {status.state === 'ready' && status.error && (
        <span className="w-full text-sm">
          Some pictures couldn't be saved. Check your connection and try again.
        </span>
      )}
    </div>
  );
}
