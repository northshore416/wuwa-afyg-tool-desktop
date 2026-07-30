import { json, type RequestHandler } from '@sveltejs/kit'
import { createLoginTicket } from '$lib/server/ygkit-db'
import { noStoreHeaders, requireBearer } from '$lib/server/ygkit-http'

export const POST: RequestHandler = async ({ request, url }) => {
    requireBearer(request, 'YGKIT_ISSUER_TOKEN')
    const body = (await request.json()) as { subject?: unknown; uids?: unknown }
    if (typeof body.subject !== 'string') return json({ message: 'invalid subject' }, { status: 400 })

    try {
        const result = createLoginTicket(body.subject, body.uids)
        const publicOrigin = (process.env.YGKIT_PUBLIC_ORIGIN || url.origin).replace(/\/$/, '')
        return json({ ...result, loginUrl: `${publicOrigin}/?ygkit=login` }, { status: 201, headers: noStoreHeaders })
    } catch (error) {
        return json(
            { message: error instanceof Error ? error.message : 'invalid request' },
            { status: 400, headers: noStoreHeaders }
        )
    }
}
