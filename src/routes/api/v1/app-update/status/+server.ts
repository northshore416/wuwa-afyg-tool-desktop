import { createJsonResponse } from '$lib/api/fetch'
import { getAppUpdateStatus } from '$lib/desktop-extension/app-updater'

export const GET = async () => {
    try {
        return createJsonResponse(await getAppUpdateStatus())
    } catch (error) {
        return createJsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
    }
}