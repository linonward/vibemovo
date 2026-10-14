// A path on this site: one leading slash, and no second slash, backslash or
// control character that a browser could turn into another host
// ("//evil.example", "/\evil.example", "/\t/evil.example").
const SITE_PATH = /^\/(?![/\\])[^\\\u0000-\u001f]*$/;

// Where sign-in returns to: the `next` page the proxy passed along, if it is
// a path on this site, else the dashboard.
export function signInReturnPath(next: string | null, locale: string): string {
  return next && SITE_PATH.test(next) ? next : `/${locale}/dashboard`;
}
