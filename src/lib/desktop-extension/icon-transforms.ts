import { ASSET_BASE } from '$lib/api/consts'
import type { NanokaCharacter, NanokaEcho, NanokaSonata, NanokaWeapon } from '$lib/api/types'
import { ueToCdn } from '$lib/api/utils'

type IconPair = [string, string]

export const transformCharacterIcons = (data: Record<string, NanokaCharacter>): IconPair[] =>
    Object.values(data)
        .filter((character) => character.zh && character.icon)
        .map((character) => [character.zh, ueToCdn(character.icon)])

export const transformWeaponIcons = (data: Record<string, NanokaWeapon>): IconPair[] =>
    Object.values(data)
        .filter((weapon) => weapon.zh && weapon.icon)
        .map((weapon) => [weapon.zh, ueToCdn(weapon.icon)])

export const transformEchoIcons = (data: Record<string, NanokaEcho>): IconPair[] =>
    Object.values(data)
        .filter((echo) => echo.zh && echo.icon)
        .map((echo) => [echo.zh, ueToCdn(echo.icon)])

export const transformEchoSetIcons = (sonata: NanokaSonata): IconPair[] =>
    Object.values(sonata)
        .filter((set) => set.name?.zh && set.icon)
        .map((set) => [set.name.zh, ueToCdn(set.icon)])

export const transformElementIcons = (sonata: NanokaSonata): IconPair[] => {
    const setIds = [1, 2, 3, 4, 5, 6]
    const names = ['冷凝', '热熔', '导电', '气动', '衍射', '湮灭']

    return setIds.map((setId, index) => {
        const set = sonata[String(setId)]
        return [names[index], set?.icon ? ueToCdn(set.icon) : '']
    })
}

export const transformWeaponTypeIcons = (): IconPair[] => [
    ['长刃', `${ASSET_BASE}/Static/SP_IconNorSword.webp`],
    ['迅刀', `${ASSET_BASE}/Static/SP_IconNorKnife.webp`],
    ['佩枪', `${ASSET_BASE}/Static/SP_IconNorGun.webp`],
    ['臂铠', `${ASSET_BASE}/Static/SP_IconNorFist.webp`],
    ['音感仪', `${ASSET_BASE}/Static/SP_IconNorMagic.webp`]
]
