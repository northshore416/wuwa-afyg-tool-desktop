import { NANOKA_BASE, ZH_DATA_BASE, ensureVersion, getWWVersion } from './consts'
import { fetchCachedNanokaJson, getPreferredVersion } from '$lib/server/local-data'

export const fetchData = async <T>(path: string): Promise<T> => {
    await ensureVersion()
    const version = await getPreferredVersion(getWWVersion())
    return fetchCachedNanokaJson<T>('base', version, path, `${NANOKA_BASE}/ww/${version}${path}`)
}

export const fetchZhData = async <T>(path: string, version: string): Promise<T> => {
    const preferredVersion = await getPreferredVersion(version)
    return fetchCachedNanokaJson<T>('zh', preferredVersion, path, `${ZH_DATA_BASE}/${preferredVersion}/zh${path}`)
}

export const createJsonResponse = (data: unknown, status = 200, extraHeaders?: Record<string, string>) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...extraHeaders }
    })
