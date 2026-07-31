import type { EchoImportBridge } from '$lib/ygkit/echo-import'

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
    interface Window {
        YGKitEchoImport?: EchoImportBridge
    }

    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }
}

export {}
