import { createJsonResponse } from '$lib/api/fetch'
import { updateKernel } from '$lib/desktop-extension/kernel-updater'

export const POST = async () => {
    try {
        return createJsonResponse(await updateKernel())
    } catch (error) {
        return createJsonResponse({ ok: false, error: String(error) }, 500)
    }
}
