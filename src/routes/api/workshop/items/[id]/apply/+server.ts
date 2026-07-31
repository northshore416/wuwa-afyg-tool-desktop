import { json, type RequestHandler } from '@sveltejs/kit'
import { recordWorkshopDownload } from '$lib/server/workshop-db'
import { noStoreHeaders, requireSameOrigin, requireUser } from '$lib/server/ygkit-http'

export const POST: RequestHandler = (event) => {
    requireSameOrigin(event)
    requireUser(event.cookies)
    const item = recordWorkshopDownload(event.params.id)
    return item
        ? json(item, { headers: noStoreHeaders })
        : json({ message: '方案不存在' }, { status: 404, headers: noStoreHeaders })
}
