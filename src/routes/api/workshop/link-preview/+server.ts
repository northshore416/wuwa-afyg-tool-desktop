import { json, type RequestHandler } from '@sveltejs/kit'
import { getWorkshopLinkPreview } from '$lib/server/workshop-link-preview'
import { noStoreHeaders, requireSameOrigin, requireUser } from '$lib/server/ygkit-http'

export const POST: RequestHandler = async (event) => {
    requireSameOrigin(event)
    requireUser(event.cookies)

    try {
        const body = (await event.request.json()) as { url?: unknown }
        const url = typeof body.url === 'string' ? body.url.trim().slice(0, 2048) : ''
        if (!url) return json({ message: '请填写教学地址' }, { status: 400, headers: noStoreHeaders })
        return json(await getWorkshopLinkPreview(url), { headers: noStoreHeaders })
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : '无法读取教学页面'
        return json({ message }, { status: 400, headers: noStoreHeaders })
    }
}
