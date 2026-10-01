// Illustrations for offline play. They are not part of the install download: the service worker
// (vite.config.ts, runtimeCaching) serves *.webp from the 'd2d-art' cache and fills it as pictures
// load. These helpers fill the same cache ahead of time: a case's pictures when it is played, or every
// case's from Settings.
import { useCallback, useEffect, useState } from 'react';
import { caseLoaders } from 'virtual:content';

export const ART_CACHE = 'd2d-art';

export const offlineSupported = () => typeof caches !== 'undefined';

/** A case's illustration URLs (from its asset map: keys under panels/). */
export function artUrlsOf(assets: Record<string, string>, base: string): string[] {
  return Object.entries(assets)
    .filter(([key, url]) => key.startsWith('panels/') && !url.startsWith('data:'))
    .map(([, url]) => new URL(url, base).href);
}

async function artUrls(caseIds: string[]): Promise<string[]> {
  const lists = await Promise.all(
    caseIds.map(async (id) => {
      const loader = caseLoaders[id];
      return loader ? artUrlsOf((await loader()).assets, location.href) : [];
    }),
  );
  return lists.flat();
}

async function missing(urls: string[]): Promise<string[]> {
  const cache = await caches.open(ART_CACHE);
  const hits = await Promise.all(urls.map((u) => cache.match(u)));
  return urls.filter((_, i) => !hits[i]);
}

/** Downloads the given pictures into the cache, three at a time. */
async function save(urls: string[], onDone?: () => void) {
  const cache = await caches.open(ART_CACHE);
  const queue = [...urls];
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      await cache.add(url);
      onDone?.();
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

/** Quietly saves a case's pictures while it is being played (installed app, online, no data saver). */
export function prefetchCaseArt(caseId: string) {
  const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
  if (!offlineSupported() || !navigator.serviceWorker?.controller || !navigator.onLine || saveData)
    return;
  artUrls([caseId])
    .then(missing)
    .then((urls) => save(urls))
    .catch(() => {}); // best effort: pictures fall back to line art if they can't load
}

export type OfflineArt =
  | { state: 'checking' }
  | { state: 'ready'; saved: number; total: number; error?: boolean }
  | { state: 'saving'; saved: number; total: number };

/** How many of these cases' pictures are saved, plus actions to save or remove them. */
export function useOfflineArt(caseIds: string[]) {
  const key = caseIds.join(',');
  const [status, setStatus] = useState<OfflineArt>({ state: 'checking' });
  const [urls, setUrls] = useState<string[]>([]);

  const recount = useCallback(async (list: string[], error?: boolean) => {
    const left = await missing(list);
    setStatus({ state: 'ready', saved: list.length - left.length, total: list.length, error });
  }, []);

  useEffect(() => {
    if (!offlineSupported()) return;
    let live = true;
    artUrls(key ? key.split(',') : []).then(async (list) => {
      if (!live) return;
      setUrls(list);
      await recount(list);
    });
    return () => {
      live = false;
    };
  }, [key, recount]);

  const saveAll = useCallback(async () => {
    const left = await missing(urls);
    let saved = urls.length - left.length;
    setStatus({ state: 'saving', saved, total: urls.length });
    void navigator.storage?.persist?.(); // ask the browser not to clear them when space runs low
    try {
      await save(left, () => setStatus({ state: 'saving', saved: ++saved, total: urls.length }));
      await recount(urls);
    } catch {
      await recount(urls, true);
    }
  }, [urls, recount]);

  const removeAll = useCallback(async () => {
    await caches.delete(ART_CACHE);
    await recount(urls);
  }, [urls, recount]);

  return { status, saveAll, removeAll };
}

export function formatBytes(bytes: number): string {
  return bytes < 1e6
    ? `${Math.max(1, Math.round(bytes / 1e3))} KB`
    : `${(bytes / 1e6).toFixed(1)} MB`;
}
