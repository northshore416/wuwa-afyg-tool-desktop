import { json, type RequestHandler } from '@sveltejs/kit'
import { revokeSession } from '$lib/server/ygkit-db'
import { cookieOptions, noStoreHeaders, requireSameOrigin, sessionCookieName } from '$lib/server/ygkit-http'

export const POST: RequestHandler = (event) => {
    requireSameOrigin(event)
    const cookieName = sessionCookieName()
    revokeSession(event.cookies.get(cookieName))
    event.cookies.delete(cookieName, cookieOptions(false, 0))
    return json({ ok: true }, { headers: noStoreHeaders })
}
