# Paid access with Google sign-in — plan (zero-cost route)

Status: APPROVED by the owner 2026-11-01 (Chest Pain free; one year of every unit; firebase and wrangler OK).
Price: ₹151 (owner, 2026-11-04; was ₹356). It lives only in `src/lib/price.ts`.

Goal: people sign in with Google and pay ₹151 to unlock the app. No Play Store for now (it needs a
US$25 registration); Android users install the website from Chrome ("Add to Home screen"), which already
works offline as a PWA. The owner pays nothing up front; Razorpay keeps a small share of each payment.

## 1. Why the current setup can't charge

- The whole app is public: GitHub Pages serves every case, and the repository (content YAML) is public.
- A paywall in the browser alone is decoration: the paid cases must not be in the public bundle or repo.

## 2. The design

| Piece | Service (free tier) | What it does |
|---|---|---|
| Sign-in | Firebase Authentication (Spark plan) | "Sign in with Google" |
| Who has paid | Firestore (Spark plan) | One record per paying user: `entitlements/{uid}` with `expiresAt` |
| Paid content | Firestore (Spark plan) | Each paid case, unit's notes and codex card stored as a document; security rules let only paid users read them |
| Payment | Razorpay Payment Links | ₹151 on Razorpay's own page (no script loaded into our app, so the "no runtime CDNs" rule holds) |
| Confirming payment | Cloudflare Worker (free, no card) | Creates the payment link for the signed-in user; receives Razorpay's "paid" webhook, checks its signature, and writes the entitlement |
| Hosting | Cloudflare Pages (free) | Replaces GitHub Pages, because GitHub Pages can't serve a private repo on a free plan |
| Repository | GitHub, made private | Content YAML and owner's notes no longer public |

- **Free part:** the Chest Pain unit (11 cases, codex cards it unlocks) stays free and in the public bundle,
  so people can try before paying. Everything else needs the ₹151 unlock.
- **What ₹151 buys:** one year of every unit (including units added during that year), on any device signed in
  with the same Google account. The entitlement stores `expiresAt`; renewing adds a year from the later of today or
  the current expiry. The app shows a renewal reminder in the last 14 days; after expiry, paid units lock again
  (progress on the device is kept).
- **Offline:** paid content is cached on the device after the first download, so it still works offline.
- **Progress:** stays on the device as now (syncing progress across devices can come later).
- **Pictures:** stay public (they're no use without the cases); only case text, notes and paid codex cards are gated.

## 3. New code (Claude)

1. Build split: `compile` writes the free unit into the app bundle as now, and paid content to a separate output.
2. Upload script: pushes paid content to Firestore on each deploy (service-account key kept as a secret, never in the repo).
3. App: sign-in button, account screen, "Unlock all units — ₹151" button, locked-unit cards, paid content loader
   with offline cache.
4. Cloudflare Worker: `POST /pay` (verifies the Firebase sign-in, creates a Razorpay payment link carrying the user id);
   `POST /razorpay-webhook` (verifies Razorpay's signature, records the entitlement in Firestore).
5. Firestore security rules: entitlement records written only by the Worker; paid content readable only by
   signed-in users with an entitlement.
6. Pages: privacy policy, terms of use (including "educational, not a substitute for clinical judgement"),
   refund and cancellation policy, contact page — Razorpay requires these before activating payments.
7. Tests for the split, the rules and the webhook signature check; test mode end to end before going live.

New dependencies (owner to approve): `firebase` (client SDK) and `wrangler` (Cloudflare's deploy tool, dev only).

## 4. Owner's part (accounts only; Claude guides each step)

1. Firebase: create a project, turn on Google sign-in and Firestore (no card needed).
2. Cloudflare: create a free account (no card needed).
3. Razorpay: sign up and complete KYC (PAN, bank account, the website with the policy pages). Start early: activation can
   take several days. Test mode works before activation.
4. GitHub: make the repository private once Cloudflare Pages is deploying it.

## 5. Order of work

1. Accounts (owner) and Firebase sign-in in the app (Claude) — sign-in works, nothing locked yet.
2. Content split, Firestore upload and rules, locked units — tested with a manual entitlement.
3. Worker and Razorpay test-mode payments end to end.
4. Policy pages; move hosting to Cloudflare Pages; repository private; old GitHub Pages address redirects.
5. Razorpay live mode once KYC is approved.

## 6. Progress

- 2026-11-01: step 1 done (Google sign-in; owner signed in).
- 2026-11-04: step 2 done. Rules deployed, paid content uploaded (`VITE_ACCOUNTS_LIVE=true npm run build &&
  node scripts/upload-paid.ts`), owner granted a test year with scripts/grant.ts. Checked locally with the
  switch on (`.env.development.local`): signed-out and unpaid visitors are refused by Firestore (403); the paid
  account opens paid cases, notes and codex cards.
- 2026-11-04: step 3 built. Worker in `worker/` (deployed as door-to-decision-pay on workers.dev), unlock button
  and the "payment received" screen (`#/unlocked`); 8 Worker tests. Details below.
- 2026-11-05: 4a policy pages live (owner approved the text). 4b: site deployed to
  https://app.door-to-decision.workers.dev (from this computer first); address added to Firebase authorized
  domains and the payment Worker. The CI `cloudflare` job takes over once the owner adds the
  `CLOUDFLARE_API_TOKEN` and `FIREBASE_SERVICE_ACCOUNT` GitHub secrets. Note: `wrangler pages ...` inside this
  folder tries to convert the project (it ran `npm install wrangler@latest` and edited vite.config.ts); don't.
- 2026-11-05: step 3 tested end to end in Razorpay test mode. Owner's manual year removed, owner paid ₹151 with
  a test payment in the local app; the webhook wrote `payments/{plinkId}` (15100 paise), extended the
  entitlement to 2027-11-05 (source `razorpay`) and cleared `pending/{uid}`; the app showed "Everything is
  unlocked". Test-mode keys and webhook secret are in the Worker; live ones replace them in step 5.
- Whenever paid content changes after launch, run the split build and upload again (step 4 automates this).

## 6a. How a payment works (step 3)

1. Unlock button → `POST /pay` with the Firebase ID token. The Worker checks the token against Google's keys,
   reuses the person's open payment page if it has 15+ minutes left (`pending/{uid}`), else creates a Razorpay
   Payment Link for the price (2-hour expiry, `notes.uid`), recording `links/{plinkId}` → uid and amount.
2. The app sends the person to Razorpay's page; Razorpay sends them back with `?razorpay_payment_link_status=…`,
   which the app turns into `#/unlocked`. That screen re-reads the entitlement every 3 s until the year appears.
3. Razorpay's `payment_link.paid` webhook → `POST /razorpay-webhook`. The Worker checks the HMAC signature, the
   amount and currency, then in one Firestore transaction writes `payments/{plinkId}` (must not exist yet, so a
   repeated webhook adds nothing), sets `entitlements/{uid}.expiresAt` to max(now, current) + 365 days, and
   clears `pending/{uid}`. Any failure answers 500 so Razorpay retries (for up to 24 hours).
4. Secrets (Cloudflare only, never in the repo): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`, `FIREBASE_SERVICE_ACCOUNT`. Test-mode keys and webhook secret until step 5.
5. If a webhook can't be matched to a person, it is logged and the owner grants by hand (`scripts/grant.ts`).

## 6b. Step 4 plan (owner OK 2026-11-05)

- 4a. Policy pages as plain HTML in `public/legal/` (terms, privacy, refunds, delivery, contact), linked from
  Settings and the unlock box. Operator shown as "Manav, India"; contact by email only (owner: no phone or
  address on the pages; add the minimum only if Razorpay's review insists). Refunds: none once unlocked, except
  failed or duplicate payments (5–7 working days to the original method). Reply promise: 3 working days.
- 4b. Hosting on Cloudflare, deployed from GitHub Actions. Cloudflare has folded Pages into Workers, so the site
  is an assets-only Worker (`site/wrangler.jsonc`, `npm run site:deploy`) at https://app.door-to-decision.workers.dev; the paid-content upload runs
  in the same workflow once the launch switch is on. New address added to Firebase authorized domains and the
  Worker's `ALLOWED_ORIGINS`. Give Razorpay this address for KYC.
- 4c. Repository private and renamed `door-to-decision-app`; a tiny public `door-to-decision` repo keeps the old
  GitHub Pages address, forwarding visitors (and their on-device progress, via the URL fragment) to the new
  site and retiring the old service worker. Deploys are then confirmed through Cloudflare, not the GitHub API.

## 7. Decisions (2026-11-01)

- Chest Pain free; everything else paid.
- ₹151 buys one year (not lifetime).
- `firebase` and `wrangler` approved.
- 2026-11-04: price lowered to ₹151.
- 2026-11-05: refunds only for failed or duplicate payments; policy pages show name and email only.
