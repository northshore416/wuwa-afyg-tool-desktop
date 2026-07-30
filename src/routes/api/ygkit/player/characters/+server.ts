import { json, type RequestHandler } from '@sveltejs/kit'
import { noStoreHeaders, requireUser } from '$lib/server/ygkit-http'
import type { YGKitUidCharacters } from '$lib/ygkit/types'

const fetchCharacters = async (uid: string): Promise<YGKitUidCharacters> => {
    const baseUrl = (process.env.YGKIT_PLUGIN_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '')
    const token = process.env.YGKIT_READER_TOKEN
    if (!token) throw new Error('YGKIT_READER_TOKEN is not configured')

    const response = await fetch(`${baseUrl}/api/ygkit/v1/uids/${encodeURIComponent(uid)}/characters`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(12_000)
    })
    if (!response.ok) {
        const detail = await response.text()
        throw new Error(`XWUID ${uid}: HTTP ${response.status} ${detail}`)
    }
    return response.json() as Promise<YGKitUidCharacters>
}

export const GET: RequestHandler = async ({ cookies }) => {
    const user = requireUser(cookies)
    const results = await Promise.allSettled(user.uids.map(fetchCharacters))
    const accounts = results
        .filter((result): result is PromiseFulfilledResult<YGKitUidCharacters> => result.status === 'fulfilled')
        .map((result) => result.value)
    const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)))

    return json({ accounts, errors }, { headers: noStoreHeaders })
}
