# Paid access with Google sign-in — plan (zero-cost route)

Status: APPROVED by the owner 2026-11-01 (Chest Pain free; ₹356 for one year of every unit; firebase and wrangler OK).

Goal: people sign in with Google and pay ₹356 once to unlock the app. No Play Store for now (it needs a
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
| Payment | Razorpay Payment Links | ₹356 on Razorpay's own page (no script loaded into our app, so the "no runtime CDNs" rule holds) |
| Confirming payment | Cloudflare Worker (free, no card) | Creates the payment link for the signed-in user; receives Razorpay's "paid" webhook, checks its signature, and writes the entitlement |
| Hosting | Cloudflare Pages (free) | Replaces GitHub Pages, because GitHub Pages can't serve a private repo on a free plan |
| Repository | GitHub, made private | Content YAML and owner's notes no longer public |

- **Free part:** the Chest Pain unit (11 cases, codex cards it unlocks) stays free and in the public bundle,
  so people can try before paying. Everything else needs the ₹356 unlock.
- **What ₹356 buys:** one year of every unit (including units added during that year), on any device signed in
  with the same Google account. The entitlement stores `expiresAt`; renewing adds a year from the later of today or
  the current expiry. The app shows a renewal reminder in the last 14 days; after expiry, paid units lock again
  (progress on the device is kept).
- **Offline:** paid content is cached on the device after the first download, so it still works offline.
- **Progress:** stays on the device as now (syncing progress across devices can come later).
- **Pictures:** stay public (they're no use without the cases); only case text, notes and paid codex cards are gated.

## 3. New code (Claude)

1. Build split: `compile` writes the free unit into the app bundle as now, and paid content to a separate output.
2. Upload script: pushes paid content to Firestore on each deploy (service-account key kept as a secret, never in the repo).
3. App: sign-in button, account screen, "Unlock all units — ₹356" button, locked-unit cards, paid content loader
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

## 6. Decisions (2026-11-01)

- Chest Pain free; everything else paid.
- ₹356 buys one year (not lifetime).
- `firebase` and `wrangler` approved.
