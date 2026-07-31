import { json, type RequestHandler } from '@sveltejs/kit'
import { createWorkshopItem, listWorkshopItems } from '$lib/server/workshop-db'
import { getWorkshopLinkPreview } from '$lib/server/workshop-link-preview'
import { noStoreHeaders, requireSameOrigin, requireUser } from '$lib/server/ygkit-http'
import { sanitizeWorkshopProject } from '$lib/workshop/project-template'

const MAX_BODY_BYTES = 1024 * 1024

export const GET: RequestHandler = ({ url }) => {
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(30, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') || '12', 10) || 12))
    const query = (url.searchParams.get('q') || '').trim().slice(0, 80)
    return json(listWorkshopItems(page, pageSize, query), { headers: noStoreHeaders })
}

export const POST: RequestHandler = async (event) => {
    requireSameOrigin(event)
    const user = requireUser(event.cookies)
    const contentLength = Number(event.request.headers.get('content-length') || '0')
    if (contentLength > MAX_BODY_BYTES) {
        return json({ message: '方案数据不能超过 1 MB' }, { status: 413, headers: noStoreHeaders })
    }

    try {
        const body = (await event.request.json()) as Record<string, unknown>
        const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : ''
        const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : ''
        const gameVersion = typeof body.gameVersion === 'string' ? body.gameVersion.trim().slice(0, 32) : ''
        const tutorialUrl = typeof body.tutorialUrl === 'string' ? body.tutorialUrl.trim().slice(0, 2048) : ''
        if (!title) return json({ message: '请填写方案名称' }, { status: 400, headers: noStoreHeaders })

        const project = sanitizeWorkshopProject(body.project)
        const serialized = JSON.stringify(project)
        if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
            return json({ message: '方案数据不能超过 1 MB' }, { status: 413, headers: noStoreHeaders })
        }

        const tutorial = tutorialUrl ? await getWorkshopLinkPreview(tutorialUrl) : undefined
        return json(createWorkshopItem(user, { title, description, gameVersion, tutorialUrl, tutorial, project }), {
            status: 201,
            headers: noStoreHeaders
        })
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : '方案数据无效'
        return json({ message }, { status: 400, headers: noStoreHeaders })
    }
}
