import { json, type RequestHandler } from '@sveltejs/kit'
import { listWorkshopReviewItems } from '$lib/server/workshop-db'
import { noStoreHeaders, requireAdmin } from '$lib/server/ygkit-http'
import type { WorkshopStatus } from '$lib/workshop/types'

const reviewStatuses: WorkshopStatus[] = ['pending', 'published', 'rejected']

export const GET: RequestHandler = ({ cookies, url }) => {
    requireAdmin(cookies)
    const requested = url.searchParams.get('status') as WorkshopStatus | null
    const status = requested && reviewStatuses.includes(requested) ? requested : 'pending'
    return json({ items: listWorkshopReviewItems(status), status }, { headers: noStoreHeaders })
}
