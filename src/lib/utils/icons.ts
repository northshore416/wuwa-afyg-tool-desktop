import { addCollection } from '@iconify/svelte/dist/functions'
import mdiIcons from './mdi-icons'

export const registerIcons = () => addCollection(mdiIcons)

export const fallbackIcon = (node: HTMLImageElement, placeholder: string) => {
    const originalHandler = node.onerror
    const handleError = () => {
        node.src = placeholder
        node.onerror = null
    }

    node.onerror = handleError

    return {
        destroy: () => {
            if (node.onerror === handleError) node.onerror = originalHandler
        }
    }
}
