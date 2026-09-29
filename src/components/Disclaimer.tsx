import { useSettings } from '../store/settings';

export const DISCLAIMER =
  'For education only. Not a clinical decision tool. Verify with current guidelines and local protocols.';

/** Full-screen gate shown until the disclaimer is accepted on first launch. */
export function DisclaimerGate({ children }: { children: React.ReactNode }) {
  const { disclaimerAccepted, set } = useSettings();
  if (disclaimerAccepted) return <>{children}</>;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold">Door to Decision</h1>
      <p className="panel p-4 text-lg" role="note">
        {DISCLAIMER}
      </p>
      <button
        className="panel min-h-11 bg-ink px-4 py-3 font-semibold text-paper"
        onClick={() => set({ disclaimerAccepted: true })}
      >
        I understand
      </button>
    </main>
  );
}
