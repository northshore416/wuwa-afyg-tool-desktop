import { browser } from '$app/environment'
import type { YGKitUser } from '$lib/ygkit/types'

const STORAGE_KEY = 'ygkit:last-profile'

let cachedUser = $state<YGKitUser | null>(null)
let loaded = false

export const loadCachedYGKitUser = () => {
    if (!browser || loaded) return
    loaded = true
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        cachedUser = raw ? (JSON.parse(raw) as YGKitUser) : null
    } catch {
        cachedUser = null
    }
}

export const rememberYGKitUser = (user: YGKitUser) => {
    cachedUser = user
    if (!browser) return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } catch {
        // Profile persistence is best-effort; authentication remains cookie-backed.
    }
}

export const getCachedYGKitUser = () => cachedUser
