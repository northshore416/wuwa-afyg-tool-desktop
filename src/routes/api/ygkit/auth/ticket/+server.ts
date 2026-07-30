import { json, type RequestHandler } from '@sveltejs/kit'
import { consumeLoginTicket } from '$lib/server/ygkit-db'
import { cookieOptions, noStoreHeaders, requireSameOrigin, sessionCookieName } from '$lib/server/ygkit-http'

const attempts = new Map<string, { count: number; resetAt: number }>()

const allowAttempt = (key: string): boolean => {
    const now = Date.now()
    const record = attempts.get(key)
    if (!record || record.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 })
        return true
    }
    record.count++
    return record.count <= 10
}

export const POST: RequestHandler = async (event) => {
    requireSameOrigin(event)
    const clientKey = event.request.headers.get('cf-connecting-ip') || event.getClientAddress()
    if (!allowAttempt(clientKey)) {
        return json({ message: '请求过于频繁，请稍后再试' }, { status: 429, headers: noStoreHeaders })
    }

    const body = (await event.request.json()) as { ticket?: unknown; rememberMe?: unknown }
    if (typeof body.ticket !== 'string') {
        return json({ message: '请输入 ticket' }, { status: 400, headers: noStoreHeaders })
    }

    try {
        const session = consumeLoginTicket(body.ticket.trim(), body.rememberMe === true)
        event.cookies.set(sessionCookieName(), session.secret, cookieOptions(session.persistent, session.maxAge))
        return json({ ok: true, user: session.user }, { headers: noStoreHeaders })
    } catch {
        return json({ message: 'ticket 无效、已使用或已过期' }, { status: 401, headers: noStoreHeaders })
    }
}
