import { describe, it, expect } from 'vitest'
import { isProtectedPath, isAuthOnlyPath } from './auth-routes'

describe('isProtectedPath', () => {
  it('protects root path exactly', () => {
    expect(isProtectedPath('/')).toBe(true)
  })

  it('protects standard protected prefixes', () => {
    expect(isProtectedPath('/dashboard')).toBe(true)
    expect(isProtectedPath('/cases')).toBe(true)
    expect(isProtectedPath('/entities')).toBe(true)
    expect(isProtectedPath('/alerts')).toBe(true)
    expect(isProtectedPath('/reviews')).toBe(true)
    expect(isProtectedPath('/settings')).toBe(true)
  })

  it('protects sub-paths under protected sections', () => {
    expect(isProtectedPath('/dashboard/analytics')).toBe(true)
    expect(isProtectedPath('/cases/case-12345')).toBe(true)
    expect(isProtectedPath('/entities/factories')).toBe(true)
    expect(isProtectedPath('/entities/warehouses/wh-1')).toBe(true)
    expect(isProtectedPath('/settings/profile')).toBe(true)
    expect(isProtectedPath('/settings/security')).toBe(true)
  })

  it('allows public / auth routes', () => {
    expect(isProtectedPath('/login')).toBe(false)
    expect(isProtectedPath('/forgot-password')).toBe(false)
    expect(isProtectedPath('/about')).toBe(false)
  })

  it('no longer protects /products -- the Produk page was removed', () => {
    expect(isProtectedPath('/products')).toBe(false)
  })
})

describe('isAuthOnlyPath', () => {
  it('identifies auth-only routes correctly', () => {
    expect(isAuthOnlyPath('/login')).toBe(true)
    expect(isAuthOnlyPath('/forgot-password')).toBe(true)
  })

  it('returns false for protected and public routes', () => {
    expect(isAuthOnlyPath('/dashboard')).toBe(false)
    expect(isAuthOnlyPath('/settings')).toBe(false)
    expect(isAuthOnlyPath('/')).toBe(false)
  })
})
