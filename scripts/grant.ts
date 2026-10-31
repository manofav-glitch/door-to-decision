// Grants (or extends) a paid year by hand, for testing or a manual payment:
//   node scripts/grant.ts someone@gmail.com [days=365]
//   node scripts/grant.ts someone@gmail.com 0      ← removes access (expires now)
// The person must have signed in to the app once, so Firebase knows their account.
import { accessToken, CLOUD, DATASTORE, google, serviceAccount } from './lib/google.ts';

const [email, daysArg = '365'] = process.argv.slice(2);
if (!email) throw new Error('usage: node scripts/grant.ts <email> [days]');
const days = Number(daysArg);
const project = serviceAccount().project_id;
const token = await accessToken([CLOUD, DATASTORE]);

const lookup = (await google(
  token,
  `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
  { method: 'POST', body: JSON.stringify({ email: [email] }) },
)) as { users?: { localId: string }[] };
const uid = lookup.users?.[0]?.localId;
if (!uid) throw new Error(`No account for ${email}: they need to sign in to the app once first.`);

const doc = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/entitlements/${uid}`;
let from = Date.now();
try {
  const current = (await google(token, doc)) as {
    fields?: { expiresAt?: { timestampValue?: string } };
  };
  const ts = current.fields?.expiresAt?.timestampValue;
  if (ts && days > 0) from = Math.max(from, Date.parse(ts)); // renewing adds to a running year
} catch {
  // no record yet
}
const expiresAt = new Date(from + days * 86_400_000).toISOString();
await google(token, doc, {
  method: 'PATCH',
  body: JSON.stringify({
    fields: {
      expiresAt: { timestampValue: expiresAt },
      email: { stringValue: email },
      source: { stringValue: 'manual' },
    },
  }),
});
console.log(`✓ ${email} (${uid}) has access until ${expiresAt}`);
