import type { ServerCapabilities, ServerHealth } from '@northshore/desktop-protocol'

export interface DesktopApiClientOptions {
    origin: string
    timeoutMs?: number
    fetchImpl?: typeof fetch
}

export class DesktopApiError extends Error {
    constructor(
        message: string,
        readonly status: number | null,
        readonly path: string
    ) {
        super(message)
        this.name = 'DesktopApiError'
    }
}

function normalizeOrigin(value: string): string {
    const url = new URL(value)
    if (url.username || url.password) throw new Error('Server origin must not contain credentials.')
    const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
        throw new Error('Server origin must use HTTPS outside local development.')
    }
    url.pathname = '/'
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
}
export function createDesktopApiClient(options: DesktopApiClientOptions) {
    const origin = normalizeOrigin(options.origin)
    const timeoutMs = options.timeoutMs ?? 8_000
    const fetchImpl = options.fetchImpl ?? fetch

    async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        const headers = new Headers(init.headers)
        if (!headers.has('accept')) headers.set('accept', 'application/json')
        try {
            const response = await fetchImpl(new URL(path, `${origin}/`), {
                ...init,
                credentials: 'include',
                headers,
                signal: controller.signal
            })
            if (!response.ok) {
                throw new DesktopApiError(`Request failed with HTTP ${response.status}.`, response.status, path)
            }
            return (await response.json()) as T
        } catch (error) {
            if (error instanceof DesktopApiError) throw error
            const message = error instanceof Error ? error.message : String(error)
            throw new DesktopApiError(message, null, path)
        } finally {
            clearTimeout(timeout)
        }
    }

    return {
        origin,
        getCapabilities: () => request<ServerCapabilities>('/api/client/v1/capabilities'),
        getHealth: () => request<ServerHealth>('/api/ygkit/health'),
        getSession: () => request<unknown>('/api/ygkit/auth/me'),
        listWorkshopItems: () => request<unknown>('/api/workshop/items'),
        getWorkshopItem: (id: string) => request<unknown>(`/api/workshop/items/${encodeURIComponent(id)}`),
        getWorkshopBundle: (id: string) => request<unknown>(`/api/workshop/items/${encodeURIComponent(id)}/bundle`)
    }
}

export type DesktopApiClient = ReturnType<typeof createDesktopApiClient>
