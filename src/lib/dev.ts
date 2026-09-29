// Dev mode: add ?dev=1 to the address (before or after the #) to turn it on for this browser tab;
// ?dev=0 turns it off. Shows step ids, a jump-to-step picker and the hidden state inspector.
import { useSyncExternalStore } from 'react';

const KEY = 'd2d.dev';

function fromUrl(): boolean | undefined {
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  const v =
    new URLSearchParams(window.location.search).get('dev') ??
    new URLSearchParams(hashQuery).get('dev');
  return v === null ? undefined : v === '1';
}

function read(): boolean {
  const url = fromUrl();
  try {
    if (url !== undefined) sessionStorage.setItem(KEY, url ? '1' : '0');
    return (url ?? sessionStorage.getItem(KEY) === '1') === true;
  } catch {
    return url === true; // storage blocked: honour the URL only
  }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
  };
}

export function useDevMode(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
