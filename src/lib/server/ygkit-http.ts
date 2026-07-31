import { timingSafeEqual } from 'node:crypto'
import type { Cookies, RequestEvent } from '@sveltejs/kit'
import { error } from '@sveltejs/kit'
import { authenticateSession } from '$lib/server/ygkit-db'

const secureCookies = () => (process.env.YGKIT_PUBLIC_ORIGIN || '').startsWith('https://')

export const sessionCookieName = () => (secureCookies() ? '__Host-ygkit_session' : 'ygkit_session')

export const cookieOptions = (persistent: boolean, maxAge: number) => ({
    path: '/',
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax' as const,
    ...(persistent ? { maxAge } : {})
})

export const noStoreHeaders = {
    'cache-control': 'no-store, private',
    'x-content-type-options': 'nosniff'
}

const equalSecret = (actual: string, expected: string): boolean => {
    const left = Buffer.from(actual)
    const right = Buffer.from(expected)
    return left.length === right.length && timingSafeEqual(left, right)
}

export const requireBearer = (request: Request, envName: 'YGKIT_ISSUER_TOKEN' | 'YGKIT_READER_TOKEN'): void => {
    const expected = process.env[envName] || ''
    const actual = request.headers.get('authorization') || ''
    if (!expected || !equalSecret(actual, `Bearer ${expected}`)) error(401, 'Unauthorized')
}

export const requireSameOrigin = (event: RequestEvent): void => {
    const expected = process.env.YGKIT_PUBLIC_ORIGIN?.replace(/\/$/, '') || event.url.origin
    const origin = event.request.headers.get('origin')
    if (!origin || origin.replace(/\/$/, '') !== expected) error(403, 'Invalid origin')
}

export const requireUser = (cookies: Cookies) => {
    const user = authenticateSession(cookies.get(sessionCookieName()))
    if (!user) error(401, 'Not authenticated')
    return user
}

export const requireAdmin = (cookies: Cookies) => {
    const user = requireUser(cookies)
    if (!user.isAdmin) error(403, 'Administrator required')
    return user
}
