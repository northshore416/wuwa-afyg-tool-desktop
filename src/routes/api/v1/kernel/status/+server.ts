import { createJsonResponse } from '$lib/api/fetch'
import { getKernelStatus } from '$lib/desktop-extension/kernel-updater'

export const GET = async () => {
    try {
        return createJsonResponse(await getKernelStatus())
    } catch (error) {
        return createJsonResponse({ ok: false, error: String(error) }, 500)
    }
}
