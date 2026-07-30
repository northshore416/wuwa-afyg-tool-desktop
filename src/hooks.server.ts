import { warmDesktopData } from '$lib/server/local-data'
import { loadYGKitRuntimeEnv } from '$lib/server/runtime-env'
import type { Handle } from '@sveltejs/kit'

let started = false

export const handle: Handle = async ({ event, resolve }) => {
    if (!started) {
        started = true
        loadYGKitRuntimeEnv()
        void warmDesktopData().catch((error) => {
            console.warn('[desktop-data] warmup failed', error)
        })
    }

    return resolve(event)
}
