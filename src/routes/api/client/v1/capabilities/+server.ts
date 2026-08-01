import { json, type RequestHandler } from '@sveltejs/kit'
import { DESKTOP_PROTOCOL_VERSION, SERVER_FEATURES, type ServerCapabilities } from '@northshore/desktop-protocol'
import { noStoreHeaders } from '$lib/server/ygkit-http'

export const GET: RequestHandler = () => {
    const payload: ServerCapabilities = {
        ok: true,
        service: 'YGKIT',
        protocolVersion: DESKTOP_PROTOCOL_VERSION,
        minimumClientVersion: '0.0.5',
        serverTime: Date.now(),
        features: SERVER_FEATURES,
        projectSync: false
    }
    return json(payload, { headers: noStoreHeaders })
}
