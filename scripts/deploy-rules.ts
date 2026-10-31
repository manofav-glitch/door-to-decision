// Deploys firestore.rules to the Firebase project: node scripts/deploy-rules.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accessToken, CLOUD, FIREBASE, google, serviceAccount } from './lib/google.ts';

const project = serviceAccount().project_id;
const token = await accessToken([CLOUD, FIREBASE]);
const api = `https://firebaserules.googleapis.com/v1/projects/${project}`;
const content = readFileSync(join(import.meta.dirname, '..', 'firestore.rules'), 'utf8');

const ruleset = (await google(token, `${api}/rulesets`, {
  method: 'POST',
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content }] } }),
})) as { name: string };

const release = `projects/${project}/releases/cloud.firestore`;
try {
  await google(token, `https://firebaserules.googleapis.com/v1/${release}`, {
    method: 'PATCH',
    body: JSON.stringify({ release: { name: release, rulesetName: ruleset.name } }),
  });
} catch {
  // first deploy: the release doesn't exist yet
  await google(token, `${api}/releases`, {
    method: 'POST',
    body: JSON.stringify({ name: release, rulesetName: ruleset.name }),
  });
}
console.log(`✓ Firestore rules deployed (${ruleset.name})`);
