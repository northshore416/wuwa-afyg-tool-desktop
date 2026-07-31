import type { RequestHandler } from '@sveltejs/kit'
import { recordWorkshopBundleDownload } from '$lib/server/workshop-db'
import { noStoreHeaders } from '$lib/server/ygkit-http'

export const GET: RequestHandler = ({ params }) => {
    const bundle = recordWorkshopBundleDownload(params.id)
    if (!bundle) {
        return new Response(JSON.stringify({ message: '方案不存在或未绑定练轴预设' }), {
            status: 404,
            headers: { ...noStoreHeaders, 'content-type': 'application/json; charset=utf-8' }
        })
    }

    const fallbackName = 'afyg-workshop-' + params.id + '.json'
    const displayName = encodeURIComponent(bundle.workshop.title + '.afyg-workshop.json')
    return new Response(JSON.stringify(bundle, null, 2), {
        headers: {
            ...noStoreHeaders,
            'content-type': 'application/json; charset=utf-8',
            'content-disposition': 'attachment; filename="' + fallbackName + "\"; filename*=UTF-8''" + displayName
        }
    })
}
