import { createJsonResponse } from '$lib/api/fetch'
import { installLatestAppVersion } from '$lib/desktop-extension/app-updater'

export const POST = async () => {
    try {
        return createJsonResponse(await installLatestAppVersion())
    } catch (error) {
        return createJsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
    }
}