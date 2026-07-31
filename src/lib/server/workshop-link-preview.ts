import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { WorkshopLinkPreview } from '$lib/workshop/types'

const MAX_REDIRECTS = 3
const MAX_HTML_BYTES = 512 * 1024

const isPrivateIpv4 = (address: string) => {
    const parts = address.split('.').map(Number)
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
    const [a, b] = parts
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19))
    )
}

const isPrivateAddress = (address: string) => {
    const normalized = address.toLowerCase()
    if (isIP(normalized) === 4) return isPrivateIpv4(normalized)
    if (isIP(normalized) !== 6) return true
    if (normalized.startsWith('::ffff:')) return isPrivateIpv4(normalized.slice(7))
    return (
        normalized === '::' ||
        normalized === '::1' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        /^fe[89ab]/.test(normalized) ||
        normalized.startsWith('ff')
    )
}

const parsePublicUrl = async (rawUrl: string) => {
    const url = new URL(rawUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('教学地址仅支持 HTTP 或 HTTPS')
    if (url.username || url.password) throw new Error('教学地址不能包含账号密码')
    const hostname = url.hostname.toLowerCase()
    if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.lan')
    ) {
        throw new Error('教学地址不能指向局域网')
    }
    const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true })
    if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
        throw new Error('教学地址不能指向局域网')
    }
    return url
}

const decodeHtml = (value: string) =>
    value
        .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .trim()

const readHtml = async (response: Response) => {
    const declaredLength = Number(response.headers.get('content-length') || '0')
    if (declaredLength > MAX_HTML_BYTES) throw new Error('教学页面内容过大')
    if (!response.body) return ''

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let received = 0
    let html = ''
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.byteLength
        if (received > MAX_HTML_BYTES) {
            await reader.cancel()
            throw new Error('教学页面内容过大')
        }
        html += decoder.decode(value, { stream: true })
    }
    return html + decoder.decode()
}

const metaContent = (html: string, names: string[]) => {
    for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
        const attributes = new Map<string, string>()
        for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
            attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '')
        }
        const key = (attributes.get('property') || attributes.get('name') || '').toLowerCase()
        if (names.includes(key)) return decodeHtml(attributes.get('content') || '')
    }
    return ''
}

const youtubePreview = (url: URL): WorkshopLinkPreview | null => {
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    let videoId = ''
    if (hostname === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || ''
    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
        videoId = url.searchParams.get('v') || url.pathname.match(/^\/shorts\/([^/]+)/)?.[1] || ''
    }
    if (!/^[\w-]{6,20}$/.test(videoId)) return null
    return {
        url: url.toString(),
        title: 'YouTube 教学视频',
        coverUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    }
}

export const getWorkshopLinkPreview = async (rawUrl: string): Promise<WorkshopLinkPreview> => {
    let url = await parsePublicUrl(rawUrl)
    const directPreview = youtubePreview(url)
    if (directPreview) return directPreview

    let response: Response | null = null
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
        response = await fetch(url, {
            redirect: 'manual',
            signal: AbortSignal.timeout(7000),
            headers: {
                accept: 'text/html,application/xhtml+xml',
                'user-agent': 'YGKIT-Workshop-LinkPreview/1.0'
            }
        })
        if (![301, 302, 303, 307, 308].includes(response.status)) break
        const location = response.headers.get('location')
        if (!location || redirect === MAX_REDIRECTS) throw new Error('教学地址重定向次数过多')
        url = await parsePublicUrl(new URL(location, url).toString())
    }

    if (!response?.ok) throw new Error(`教学页面返回 HTTP ${response?.status || 502}`)
    const contentType = response.headers.get('content-type') || ''
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new Error('教学地址不是网页')
    }

    const html = await readHtml(response)
    const pageTitle =
        metaContent(html, ['og:title', 'twitter:title']) ||
        decodeHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '') ||
        url.hostname
    const rawCover = metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src'])
    let coverUrl = ''
    if (rawCover) {
        const resolved = new URL(rawCover, url)
        if (['http:', 'https:'].includes(resolved.protocol)) coverUrl = resolved.toString()
    }

    return {
        url: url.toString(),
        title: pageTitle.slice(0, 160),
        coverUrl: coverUrl.slice(0, 2048)
    }
}
