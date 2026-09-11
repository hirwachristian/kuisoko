/** The user-facing app URL used to build links in emails (password reset, email-change
 * confirmation, back-in-stock notifications). CORS_ORIGIN can hold multiple comma-separated
 * origins - the Railway-assigned domain alongside the custom domain - so it can't be used as a
 * URL directly. Prefer the custom kuisoko.store domain when it's present, since that's the one
 * customers actually see and trust; otherwise fall back to the first configured origin. */
export function getAppUrl(): string {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  const origins = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return origins.find((o) => o.includes('kuisoko.store')) ?? origins[0] ?? 'http://localhost:3000';
}
