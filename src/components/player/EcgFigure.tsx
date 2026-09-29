// ECG image with a full-screen zoom view (pinch, ctrl+scroll, buttons) and optional lead hotspots
// for "tap the leads" questions. Lead positions come from src/art/ecgLayout.ts.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EcgLayout } from '../../art/ecgLayout';

export interface Hotspots {
  layout: EcgLayout;
  selected: string[];
  onToggle?: (lead: string) => void;
  /** after answering: the correct leads */
  answer?: string[];
}

function HotspotLayer({ h }: { h: Hotspots }) {
  const { width, height } = h.layout;
  return (
    <div className="absolute inset-0">
      {h.layout.leads.map((l) => {
        const on = h.selected.includes(l.label);
        const right = h.answer?.includes(l.label);
        const cls = h.answer
          ? right
            ? 'outline-3 -outline-offset-3 outline-ink bg-ink/10'
            : on
              ? 'outline-2 -outline-offset-2 outline-dashed outline-grey-1'
              : ''
          : on
            ? 'outline-3 -outline-offset-3 outline-ink bg-ink/15'
            : 'hover:bg-ink/5';
        const style = {
          left: `${(l.x / width) * 100}%`,
          top: `${(l.y / height) * 100}%`,
          width: `${(l.w / width) * 100}%`,
          height: `${(l.h / height) * 100}%`,
        };
        const mark = h.answer ? (right ? '✓' : on ? '✗' : '') : '';
        return h.onToggle && !h.answer ? (
          <button
            key={l.label}
            type="button"
            aria-pressed={on}
            aria-label={`Lead ${l.label}`}
            className={`absolute ${cls}`}
            style={style}
            onClick={() => h.onToggle!(l.label)}
          />
        ) : (
          <span key={l.label} className={`absolute ${cls}`} style={style} aria-hidden="true">
            {mark && <span className="absolute top-0.5 right-1 text-sm font-bold">{mark}</span>}
          </span>
        );
      })}
    </div>
  );
}

const MAX_ZOOM = 3;

function ZoomView({
  src,
  alt,
  width,
  hotspots,
}: {
  src: string;
  alt: string;
  width: number;
  hotspots?: Hotspots;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0); // 0 until we know the fit size
  const fit = useRef(1);
  const pending = useRef<{ left: number; top: number } | null>(null);
  const zoomRef = useRef(zoom);
  useLayoutEffect(() => {
    zoomRef.current = zoom;
  });

  useLayoutEffect(() => {
    if (box.current) fit.current = Math.min(1, (box.current.clientWidth - 16) / width); // minus p-2 padding
    setZoom(Math.max(fit.current, Math.min(1.2, MAX_ZOOM))); // start readable, not tiny
  }, [width]);

  useLayoutEffect(() => {
    if (pending.current && box.current) {
      box.current.scrollLeft = pending.current.left;
      box.current.scrollTop = pending.current.top;
      pending.current = null;
    }
  }, [zoom]);

  /** Zoom to z, keeping the point (fx, fy) — relative to the box — still under the finger. */
  const zoomAt = (z: number, fx: number, fy: number) => {
    const el = box.current;
    const old = zoomRef.current;
    const next = Math.max(fit.current, Math.min(MAX_ZOOM, z));
    if (!el || !old || next === old) return;
    const r = next / old;
    pending.current = { left: (el.scrollLeft + fx) * r - fx, top: (el.scrollTop + fy) * r - fy };
    setZoom(next);
  };
  const centre = () => ({
    x: (box.current?.clientWidth ?? 0) / 2,
    y: (box.current?.clientHeight ?? 0) / 2,
  });

  // pinch with two fingers; one finger pans natively (touch-action: pan-x pan-y)
  const points = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const local = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const spread = () => {
    const [a, b] = [...points.current.values()];
    return {
      d: Math.hypot(a!.x - b!.x, a!.y - b!.y),
      mx: (a!.x + b!.x) / 2,
      my: (a!.y + b!.y) / 2,
    };
  };

  // ctrl + wheel (and trackpad pinch on laptops); needs a non-passive listener
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(zoomRef.current * Math.exp(-e.deltaY / 200), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={box}
        className="min-h-0 flex-1 overflow-auto p-2"
        style={{ touchAction: 'pan-x pan-y' }}
        onPointerDown={(e) => {
          if (e.pointerType !== 'touch') return;
          points.current.set(e.pointerId, local(e));
          if (points.current.size === 2) pinch.current = { d: spread().d, z: zoomRef.current };
        }}
        onPointerMove={(e) => {
          if (!points.current.has(e.pointerId)) return;
          points.current.set(e.pointerId, local(e));
          if (pinch.current && points.current.size === 2) {
            const { d, mx, my } = spread();
            zoomAt((pinch.current.z * d) / pinch.current.d, mx, my);
          }
        }}
        onPointerUp={(e) => {
          points.current.delete(e.pointerId);
          if (points.current.size < 2) pinch.current = null;
        }}
        onPointerCancel={(e) => {
          points.current.delete(e.pointerId);
          pinch.current = null;
        }}
      >
        {zoom > 0 && (
          <div className="relative" style={{ width: width * zoom }}>
            <img
              src={src}
              alt={alt}
              className="block w-full max-w-none select-none"
              draggable={false}
            />
            {hotspots && <HotspotLayer h={hotspots} />}
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 border-t-[3px] border-ink bg-paper p-2">
        <button
          type="button"
          className="btn min-w-11"
          aria-label="Zoom out"
          onClick={() => zoomAt(zoom / 1.4, centre().x, centre().y)}
        >
          −
        </button>
        <button type="button" className="btn" onClick={() => zoomAt(fit.current, 0, 0)}>
          Fit
        </button>
        <button
          type="button"
          className="btn min-w-11"
          aria-label="Zoom in"
          onClick={() => zoomAt(zoom * 1.4, centre().x, centre().y)}
        >
          +
        </button>
        <span className="w-14 text-right text-sm text-grey-1 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}

export function EcgFigure({
  src,
  alt,
  unverified,
  hotspots,
  width = 1056,
}: {
  src: string;
  alt: string;
  unverified?: React.ReactNode;
  hotspots?: Hotspots;
  width?: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  // React state is the single source of truth; the <dialog> follows it.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const show = () => setOpen(true);
  return (
    <figure className="panel col-span-full p-2">
      {hotspots ? (
        <div className="relative">
          <img src={src} alt={alt} className="block w-full select-none" draggable={false} />
          <HotspotLayer h={hotspots} />
        </div>
      ) : (
        <button
          type="button"
          className="block w-full cursor-zoom-in"
          onClick={show}
          aria-label="Open the ECG full screen"
        >
          <img src={src} alt={alt} className="w-full" />
        </button>
      )}
      <figcaption className="flex items-center justify-between gap-2 pt-2 text-sm text-grey-1">
        {hotspots ? (
          <button type="button" className="btn min-h-10 px-3 text-sm font-normal" onClick={show}>
            Enlarge
          </button>
        ) : (
          <span>Tap to enlarge</span>
        )}
        {unverified}
      </figcaption>
      <dialog
        ref={dialog}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-paper p-0 text-ink backdrop:bg-ink/60"
        onClose={() => setOpen(false)}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 border-b-[3px] border-ink bg-paper px-4 py-2">
            <span className="font-semibold">ECG</span>
            <span className="hidden text-sm text-grey-1 sm:inline">
              Pinch or Ctrl + scroll to zoom
            </span>
            <button type="button" className="btn" onClick={() => setOpen(false)} autoFocus>
              Close
            </button>
          </div>
          {open && <ZoomView src={src} alt={alt} width={width} hotspots={hotspots} />}
        </div>
      </dialog>
    </figure>
  );
}
