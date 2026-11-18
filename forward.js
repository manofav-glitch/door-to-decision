// The old address (https://manofav-glitch.github.io/door-to-decision/) is served from a small public repo
// that holds only this folder (docs/plans/paid-access-plan.md step 4c). It sends visitors to the new
// address, carrying their on-device progress and settings in the URL fragment, which browsers never send
// to any server. The app reads it in src/lib/migrate.ts.
export const NEW_HOME = 'https://app.door-to-decision.workers.dev/';
export const OLD_BASE = '/door-to-decision/';
export const KEYS = ['d2d.progress', 'd2d.settings'];

/** {key: stored string} → gzip → base64url */
export async function pack(entries) {
  const bytes = new TextEncoder().encode(JSON.stringify(entries));
  const gz = new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),
    ).arrayBuffer(),
  );
  let bin = '';
  for (const b of gz) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** where to send this visitor: same page on the new address, plus their saved data for the home page */
export async function forwardUrl(storage, pathname) {
  const rest = pathname.startsWith(OLD_BASE) ? pathname.slice(OLD_BASE.length) : '';
  const entries = {};
  try {
    for (const k of KEYS) {
      const v = storage.getItem(k);
      if (v !== null) entries[k] = v;
    }
  } catch {
    // storage blocked: forward without it
  }
  if (rest !== '' && rest !== 'index.html') return NEW_HOME + rest; // e.g. legal/terms.html
  if (Object.keys(entries).length === 0 || typeof CompressionStream === 'undefined')
    return NEW_HOME;
  return `${NEW_HOME}#import=${await pack(entries)}`;
}

if (typeof document !== 'undefined') {
  forwardUrl(localStorage, location.pathname)
    .catch(() => NEW_HOME)
    .then((url) => location.replace(url));
}
