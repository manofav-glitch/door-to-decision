// The one place the price lives (docs/plans/paid-access-plan.md). The app shows it and the payment Worker
// charges it, so after changing it redeploy both (the site, and `npm run worker:deploy`).
export const PRICE_RUPEES = 151;
export const PRICE = `₹${PRICE_RUPEES}`;
/** how long one payment unlocks every unit for */
export const PAID_DAYS = 365;
