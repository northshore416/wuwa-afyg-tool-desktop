import { json, type RequestHandler } from '@sveltejs/kit'
import { authenticateSession } from '$lib/server/ygkit-db'
import { noStoreHeaders, sessionCookieName } from '$lib/server/ygkit-http'

export const GET: RequestHandler = ({ cookies }) => {
    const user = authenticateSession(cookies.get(sessionCookieName()))
    return json(user ? { authenticated: true, user } : { authenticated: false }, {
        headers: noStoreHeaders
    })
}
