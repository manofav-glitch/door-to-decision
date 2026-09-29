import { useRef } from 'react';

/** ECG image with a full-screen view (scroll and pinch-zoom). Hotspots come in Phase 3. */
export function EcgFigure({ src, alt, unverified }: { src: string; alt: string; unverified?: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <figure className="panel col-span-full p-2">
      <button
        type="button"
        className="block w-full cursor-zoom-in"
        onClick={() => dialog.current?.showModal()}
        aria-label="Open the ECG full screen"
      >
        <img src={src} alt={alt} className="w-full" />
      </button>
      <figcaption className="flex items-center justify-between gap-2 pt-2 text-sm text-grey-1">
        <span>Tap to enlarge</span>
        {unverified}
      </figcaption>
      <dialog
        ref={dialog}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-paper p-0 backdrop:bg-ink/60"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b-[3px] border-ink bg-paper px-4 py-2">
          <span className="font-semibold">ECG</span>
          <button type="button" className="btn" onClick={() => dialog.current?.close()} autoFocus>
            Close
          </button>
        </div>
        <div className="overflow-auto p-2">
          <img src={src} alt={alt} className="max-w-none" style={{ width: 'max(100%, 1056px)' }} />
        </div>
      </dialog>
    </figure>
  );
}
