import { json, type RequestHandler } from '@sveltejs/kit'
import { reviewWorkshopItem } from '$lib/server/workshop-db'
import { noStoreHeaders, requireAdmin, requireSameOrigin } from '$lib/server/ygkit-http'

export const POST: RequestHandler = async (event) => {
    requireSameOrigin(event)
    const admin = requireAdmin(event.cookies)
    const body = (await event.request.json()) as { decision?: unknown; note?: unknown }
    const status = body.decision === 'approve' ? 'published' : body.decision === 'reject' ? 'rejected' : null
    if (!status) return json({ message: '无效的审核操作' }, { status: 400, headers: noStoreHeaders })
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
    if (status === 'rejected' && !note) {
        return json({ message: '驳回时请填写原因' }, { status: 400, headers: noStoreHeaders })
    }

    const item = reviewWorkshopItem(event.params.id, admin.id, status, note)
    return item
        ? json(item, { headers: noStoreHeaders })
        : json({ message: '投稿不存在或已完成审核' }, { status: 409, headers: noStoreHeaders })
}
