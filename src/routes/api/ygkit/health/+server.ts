import { json, type RequestHandler } from '@sveltejs/kit'
import { noStoreHeaders } from '$lib/server/ygkit-http'

export const GET: RequestHandler = () =>
    json(
        {
            ok: true,
            service: 'YGKIT',
            auth: 'ticket-session',
            port: 39818
        },
        { headers: noStoreHeaders }
    )
