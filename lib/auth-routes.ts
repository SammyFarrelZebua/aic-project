// Central place to extend which pages require a session. Add new product
// routes to PROTECTED_PREFIXES as they're built -- no other file needs to
// change for the redirect to apply.

/** Exact-match protected pages (not prefix-matched). */
const PROTECTED_EXACT = ["/"]

/** Prefix-matched protected sections -- covers all sub-routes underneath. */
const PROTECTED_PREFIXES = ["/dashboard", "/cases", "/entities", "/alerts", "/reviews", "/settings"]

/** Pages an already-authenticated user shouldn't see -- bounced to /dashboard instead. */
const AUTH_ONLY_PAGES = ["/login", "/forgot-password"]

export function isProtectedPath(pathname: string): boolean {
  if (PROTECTED_EXACT.includes(pathname)) return true
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_PAGES.includes(pathname)
}
