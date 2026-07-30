import type { ConfigState } from '$lib/components/page/home/config/config.types'
import { updateConfig, updateTeam } from '$lib/data/project.svelte'
import type { CharSlot } from '$lib/data/types'

export async function updateTeamAndConfig(
    team: [CharSlot, CharSlot, CharSlot],
    config: ConfigState
): Promise<void> {
    await updateTeam(team)
    await updateConfig(config)
}
