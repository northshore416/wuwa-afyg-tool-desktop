import { createJsonResponse } from '$lib/api/fetch'
import { refreshDesktopData } from '$lib/server/local-data'

async function refresh() {
    try {
        const result = await refreshDesktopData()
        return createJsonResponse({ ok: true, ...result })
    } catch (error) {
        return createJsonResponse({ ok: false, error: String(error) }, 500)
    }
}

export const GET = refresh
export const POST = refresh
