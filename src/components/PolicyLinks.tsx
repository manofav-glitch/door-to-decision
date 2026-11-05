// The policy pages are plain HTML in public/legal/ (they must open without the app for Razorpay's review).
const PAGES = [
  ['terms', 'Terms'],
  ['privacy', 'Privacy'],
  ['refunds', 'Refunds & cancellation'],
  ['delivery', 'Delivery'],
  ['contact', 'Contact'],
] as const;

export const policy = (page: (typeof PAGES)[number][0]) =>
  `${import.meta.env.BASE_URL}legal/${page}.html`;

export function PolicyLinks() {
  return (
    <nav aria-label="Policies" className="flex flex-wrap gap-x-4 text-sm">
      {PAGES.map(([page, label]) => (
        <a key={page} href={policy(page)} className="inline-flex min-h-11 items-center underline">
          {label}
        </a>
      ))}
    </nav>
  );
}
