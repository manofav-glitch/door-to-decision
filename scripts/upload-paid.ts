// Uploads paid content (written to paid-content/ by a build with VITE_ACCOUNTS_LIVE=true) to Firestore
// paid/{docId}, each as one JSON string. Run after the split build:
//   VITE_ACCOUNTS_LIVE=true npm run build && node scripts/upload-paid.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accessToken, DATASTORE, google, serviceAccount } from './lib/google.ts';

const dir = join(import.meta.dirname, '..', 'paid-content');
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as {
  version: string;
  docs: string[];
};
const project = serviceAccount().project_id;
const base = `projects/${project}/databases/(default)/documents`;
const token = await accessToken([DATASTORE]);

// commit in small batches to stay well under the request size limit
const BATCH = 10;
for (let i = 0; i < manifest.docs.length; i += BATCH) {
  const writes = manifest.docs.slice(i, i + BATCH).map((docId) => ({
    update: {
      name: `${base}/paid/${docId}`,
      fields: {
        json: { stringValue: readFileSync(join(dir, `${docId}.json`), 'utf8') },
        version: { stringValue: manifest.version },
      },
    },
  }));
  await google(token, `https://firestore.googleapis.com/v1/${base}:commit`, {
    method: 'POST',
    body: JSON.stringify({ writes }),
  });
  console.log(`uploaded ${Math.min(i + BATCH, manifest.docs.length)}/${manifest.docs.length}`);
}
console.log(`✓ paid content version ${manifest.version} is in Firestore (${project})`);
