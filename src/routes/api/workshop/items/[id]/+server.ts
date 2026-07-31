import { json, type RequestHandler } from '@sveltejs/kit'
import { deleteWorkshopItem, getWorkshopItem } from '$lib/server/workshop-db'
import { noStoreHeaders, requireSameOrigin, requireUser } from '$lib/server/ygkit-http'

export const GET: RequestHandler = ({ params }) => {
    const item = getWorkshopItem(params.id)
    return item
        ? json(item, { headers: noStoreHeaders })
        : json({ message: '方案不存在' }, { status: 404, headers: noStoreHeaders })
}

export const DELETE: RequestHandler = (event) => {
    requireSameOrigin(event)
    const user = requireUser(event.cookies)
    return deleteWorkshopItem(event.params.id, user.id)
        ? json({ ok: true }, { headers: noStoreHeaders })
        : json({ message: '方案不存在或无权删除' }, { status: 404, headers: noStoreHeaders })
}
