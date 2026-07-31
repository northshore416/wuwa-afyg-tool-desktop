<script lang="ts">
    import { onMount } from 'svelte'
    import Icon from '@iconify/svelte'
    import { getProjects, loadProjects } from '$lib/data/project.svelte'
    import { getCachedYGKitUser, loadCachedYGKitUser, rememberYGKitUser } from '$lib/data/ygkit-profile.svelte'
    import type {
        WorkshopItemSummary,
        WorkshopLinkPreview,
        WorkshopListResponse,
        WorkshopSession
    } from '$lib/workshop/types'
    import type { WorkshopNotice } from './types'
    import { formatWorkshopDate, responseMessage } from './utils'

    let items = $state<WorkshopItemSummary[]>([])
    let session = $state<WorkshopSession>({ authenticated: false })
    let loading = $state(true)
    let publishing = $state(false)
    let loggingIn = $state(false)
    let showPublish = $state(false)
    let query = $state('')
    let ticket = $state('')
    let rememberMe = $state(true)
    let title = $state('')
    let description = $state('')
    let gameVersion = $state('')
    let tutorialUrl = $state('')
    let tutorialPreview = $state<WorkshopLinkPreview | null>(null)
    let tutorialPreviewing = $state(false)
    let tutorialError = $state('')
    let selectedProjectId = $state('')
    let notice = $state<WorkshopNotice | null>(null)

    let projects = $derived(getProjects())
    let cachedUser = $derived(getCachedYGKitUser())
    let displayUser = $derived(session.user || cachedUser)

    const loadSession = async () => {
        const response = await fetch('/api/ygkit/auth/me')
        session = (await response.json()) as WorkshopSession
        if (session.user) rememberYGKitUser(session.user)
    }

    const loadItems = async () => {
        loading = true
        try {
            const params = new URLSearchParams({ pageSize: '24' })
            if (query.trim()) params.set('q', query.trim())
            const response = await fetch(`/api/workshop/items?${params}`)
            if (!response.ok) throw new Error(await responseMessage(response))
            const body = (await response.json()) as WorkshopListResponse
            items = body.items
        } catch (cause) {
            notice = {
                tone: 'error',
                message: cause instanceof Error ? cause.message : '创意工坊加载失败'
            }
        } finally {
            loading = false
        }
    }

    const login = async () => {
        if (!ticket.trim() || loggingIn) return
        loggingIn = true
        notice = null
        try {
            const response = await fetch('/api/ygkit/auth/ticket', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ ticket: ticket.trim(), rememberMe })
            })
            if (!response.ok) throw new Error(await responseMessage(response))
            await loadSession()
            ticket = ''
            notice = { tone: 'success', message: 'YGKIT 登录成功，现在可以应用或发布方案。' }
        } catch (cause) {
            notice = {
                tone: 'error',
                message: cause instanceof Error ? cause.message : '登录失败'
            }
        } finally {
            loggingIn = false
        }
    }

    const loadTutorialPreview = async () => {
        tutorialError = ''
        tutorialPreview = null
        if (!tutorialUrl.trim() || tutorialPreviewing) return
        tutorialPreviewing = true
        try {
            const response = await fetch('/api/workshop/link-preview', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ url: tutorialUrl.trim() })
            })
            if (!response.ok) throw new Error(await responseMessage(response))
            tutorialPreview = (await response.json()) as WorkshopLinkPreview
            tutorialUrl = tutorialPreview.url
        } catch (cause) {
            tutorialError = cause instanceof Error ? cause.message : '无法读取教学页面'
        } finally {
            tutorialPreviewing = false
        }
    }

    const logout = async () => {
        await fetch('/api/ygkit/auth/logout', { method: 'POST' })
        session = { authenticated: false }
        notice = { tone: 'info', message: '已退出 YGKIT。' }
    }

    const openPublish = () => {
        if (!session.authenticated) {
            notice = { tone: 'info', message: '请先通过 YGKIT 登录再发布方案。' }
            return
        }
        if (projects.length === 0) {
            notice = { tone: 'info', message: '工具箱中还没有可发布的本地项目。' }
            return
        }
        selectedProjectId = selectedProjectId || projects[0].id
        title = title || projects.find((project) => project.id === selectedProjectId)?.name || ''
        showPublish = true
    }

    const publish = async () => {
        const project = projects.find((item) => item.id === selectedProjectId)
        if (!project || !title.trim() || publishing) return
        publishing = true
        notice = null
        try {
            const response = await fetch('/api/workshop/items', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    gameVersion: gameVersion.trim(),
                    tutorialUrl: tutorialUrl.trim(),
                    project
                })
            })
            if (!response.ok) throw new Error(await responseMessage(response))
            showPublish = false
            title = ''
            description = ''
            gameVersion = ''
            tutorialUrl = ''
            tutorialPreview = null
            tutorialError = ''
            await loadItems()
            notice = { tone: 'success', message: '投稿已提交审核，声骸数据已由服务器自动清空。' }
        } catch (cause) {
            notice = {
                tone: 'error',
                message: cause instanceof Error ? cause.message : '发布失败'
            }
        } finally {
            publishing = false
        }
    }

    onMount(async () => {
        loadCachedYGKitUser()
        await Promise.all([loadProjects(), loadSession(), loadItems()])
    })
</script>

<svelte:head>
    <title>创意工坊 · 椰果工具箱</title>
    <meta name="description" content="浏览、发布并一键应用鸣潮轴表方案；个人声骸通过 YGKIT 登录后补全。" />
</svelte:head>

<main class="min-h-screen bg-[#080b12] text-slate-100">
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
        <header class="flex flex-col gap-6 border-b border-white/10 pb-8">
            <div class="flex flex-wrap items-center justify-between gap-4">
                <a href="/workshop" class="flex items-center gap-3">
                    <span
                        class="flex size-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30"
                    >
                        <Icon icon="mdi:creation-outline" class="size-6" />
                    </span>
                    <span>
                        <span class="block text-xs tracking-[0.28em] text-violet-300">YGKIT</span>
                        <span class="block text-xl font-semibold">创意工坊</span>
                    </span>
                </a>
                <div class="flex items-center gap-3">
                    {#if session.user?.isAdmin}
                        <a
                            href="/workshop/admin"
                            class="inline-flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-2 text-sm text-amber-200 transition hover:bg-amber-300/10"
                        >
                            <Icon icon="mdi:shield-check-outline" class="size-4" />
                            审核管理
                        </a>
                    {/if}
                    <a
                        href="/"
                        class="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/5"
                    >
                        <Icon icon="mdi:toolbox-outline" class="size-4" />
                        返回工具箱
                    </a>
                    <button
                        onclick={openPublish}
                        class="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400"
                    >
                        <Icon icon="mdi:cloud-upload-outline" class="size-4" />
                        发布方案
                    </button>
                </div>
            </div>
        </header>

        {#if notice}
            <div
                class={[
                    'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm',
                    notice.tone === 'error'
                        ? 'border-red-400/25 bg-red-400/10 text-red-200'
                        : notice.tone === 'success'
                          ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
                          : 'border-sky-400/25 bg-sky-400/10 text-sky-200'
                ]}
            >
                <Icon
                    icon={notice.tone === 'error'
                        ? 'mdi:alert-circle-outline'
                        : notice.tone === 'success'
                          ? 'mdi:check-circle-outline'
                          : 'mdi:information-outline'}
                    class="mt-0.5 size-5 shrink-0"
                />
                <span>{notice.message}</span>
            </div>
        {/if}

        <section class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div class="min-w-0">
                <form
                    class="mb-6 flex gap-3"
                    onsubmit={(event) => {
                        event.preventDefault()
                        loadItems()
                    }}
                >
                    <label class="relative flex-1">
                        <Icon
                            icon="mdi:magnify"
                            class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-500"
                        />
                        <input
                            bind:value={query}
                            placeholder="搜索方案名称或说明"
                            class="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pr-4 pl-12 outline-none transition placeholder:text-slate-600 focus:border-violet-400/50 focus:bg-white/7"
                        />
                    </label>
                    <button
                        type="submit"
                        class="rounded-2xl border border-white/10 bg-white/7 px-5 text-sm font-medium transition hover:bg-white/10"
                    >
                        搜索
                    </button>
                </form>

                {#if loading}
                    <div class="flex min-h-72 items-center justify-center text-slate-500">
                        <Icon icon="mdi:loading" class="mr-2 size-5 animate-spin" />
                        正在加载方案
                    </div>
                {:else if items.length === 0}
                    <div
                        class="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 text-center"
                    >
                        <Icon icon="mdi:archive-outline" class="mb-3 size-9 text-slate-600" />
                        <p class="text-slate-300">暂时没有找到方案</p>
                        <p class="mt-1 text-sm text-slate-600">可以发布工具箱里已有的项目作为第一份方案。</p>
                    </div>
                {:else}
                    <div class="grid gap-4">
                        {#each items as item (item.id)}
                            <article
                                class="flex flex-col rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-violet-400/25 hover:bg-white/[0.055]"
                            >
                                <div class="flex items-start justify-between gap-3">
                                    <div>
                                        <div class="mb-2 flex flex-wrap gap-2">
                                            {#if item.gameVersion}
                                                <span
                                                    class="rounded-full bg-violet-400/10 px-2.5 py-1 text-xs text-violet-300"
                                                >
                                                    {item.gameVersion}
                                                </span>
                                            {/if}
                                            <span
                                                class="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400"
                                            >
                                                {#if item.author.avatarUrl}
                                                    <img
                                                        src={item.author.avatarUrl}
                                                        alt=""
                                                        class="size-4 rounded-full object-cover"
                                                    />
                                                {/if}
                                                {item.author.label}
                                            </span>
                                        </div>
                                        <a
                                            href={`/workshop/${item.id}`}
                                            class="text-xl font-semibold text-slate-100 transition hover:text-violet-200"
                                        >
                                            {item.title}
                                        </a>
                                    </div>
                                    <Icon
                                        icon="mdi:chart-timeline-variant-shimmer"
                                        class="size-6 shrink-0 text-violet-300/70"
                                    />
                                </div>
                                <p class="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                                    {item.description || '作者没有填写额外说明。'}
                                </p>
                                {#if item.tutorial}
                                    <div
                                        class="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3"
                                    >
                                        {#if item.tutorial.coverUrl}
                                            <img
                                                src={item.tutorial.coverUrl}
                                                alt=""
                                                class="h-16 w-28 shrink-0 rounded-xl object-cover"
                                                referrerpolicy="no-referrer"
                                            />
                                        {:else}
                                            <span
                                                class="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300"
                                            >
                                                <Icon icon="mdi:play-box-outline" class="size-7" />
                                            </span>
                                        {/if}
                                        <div class="min-w-0">
                                            <p class="text-xs text-violet-300">附带教学</p>
                                            <p class="mt-1 truncate text-sm text-slate-300">{item.tutorial.title}</p>
                                        </div>
                                    </div>
                                {/if}
                                <div class="mt-4 flex flex-wrap gap-2">
                                    {#each item.team as character}
                                        <span
                                            class="rounded-lg border border-white/8 bg-black/20 px-2.5 py-1 text-xs text-slate-300"
                                        >
                                            {character}
                                        </span>
                                    {/each}
                                </div>
                                <div class="mt-auto flex items-center justify-between pt-5 text-xs text-slate-500">
                                    <span>{formatWorkshopDate(item.updatedAt)}</span>
                                    <span class="inline-flex items-center gap-1">
                                        <Icon icon="mdi:download-outline" class="size-4" />
                                        {item.downloads}
                                    </span>
                                </div>
                                <a
                                    href={`/workshop/${item.id}`}
                                    class="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-slate-950 transition hover:bg-violet-100"
                                >
                                    查看详情
                                    <Icon icon="mdi:arrow-right" class="size-4" />
                                </a>
                            </article>
                        {/each}
                    </div>
                {/if}
            </div>

            <aside class="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-5 lg:sticky lg:top-8">
                {#if displayUser}
                    <div class="flex items-center gap-3">
                        {#if displayUser.avatarUrl}
                            <img
                                src={displayUser.avatarUrl}
                                alt=""
                                class="size-11 rounded-full object-cover ring-2 ring-emerald-300/20"
                            />
                        {:else}
                            <span
                                class="flex size-11 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300"
                            >
                                <Icon icon="mdi:account-check-outline" class="size-5" />
                            </span>
                        {/if}
                        <div class="min-w-0">
                            <p class="truncate text-sm font-medium">{displayUser.displayName || 'YGKIT 用户'}</p>
                            <p class="truncate text-xs text-slate-500">{displayUser.uids.join(' · ')}</p>
                        </div>
                    </div>
                    {#if session.authenticated}
                        <p class="mt-4 text-sm leading-6 text-slate-400">
                            应用方案后会打开工具箱的 YGKIT 面板，你可以选择 UID 与角色来补全个人声骸。
                        </p>
                        <button onclick={logout} class="mt-4 text-xs text-slate-500 transition hover:text-slate-300">
                            退出登录
                        </button>
                    {:else}
                        <p class="mt-3 rounded-xl bg-amber-300/8 px-3 py-2 text-xs text-amber-200">
                            登录已失效，以上是保存在这台设备上的最近一次 QQ 资料。
                        </p>
                    {/if}
                {/if}
                {#if !session.authenticated}
                    <div
                        class={[
                            'flex items-center gap-2 text-sm font-semibold',
                            displayUser && 'mt-5 border-t border-white/8 pt-5'
                        ]}
                    >
                        <Icon icon="mdi:qqchat" class="size-5 text-sky-300" />
                        通过 QQ · YGKIT 登录
                    </div>
                    <p class="mt-3 text-sm leading-6 text-slate-500">
                        在连接 XWUID 的机器人私聊中发送 <code class="rounded bg-white/7 px-1.5 py-0.5 text-slate-300"
                            >yg登录</code
                        >， 将收到的五分钟一次性 ticket 填到这里。
                    </p>
                    <input
                        bind:value={ticket}
                        placeholder="一次性 ticket"
                        autocomplete="one-time-code"
                        class="mt-4 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                    />
                    <label class="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                        <input bind:checked={rememberMe} type="checkbox" class="accent-violet-500" />
                        在这台设备保持登录
                    </label>
                    <button
                        onclick={login}
                        disabled={!ticket.trim() || loggingIn}
                        class="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Icon
                            icon={loggingIn ? 'mdi:loading' : 'mdi:login-variant'}
                            class={['size-4', loggingIn && 'animate-spin']}
                        />
                        {loggingIn ? '正在登录' : '登录 YGKIT'}
                    </button>
                {/if}
            </aside>
        </section>
    </div>
</main>

{#if showPublish}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm">
        <div
            class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#111621] p-6 text-slate-100 shadow-2xl"
        >
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-semibold">发布到创意工坊</h2>
                    <p class="mt-1 text-sm text-slate-500">声骸内容将在服务器端再次清空。</p>
                </div>
                <button
                    onclick={() => (showPublish = false)}
                    class="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
                    aria-label="关闭"
                >
                    <Icon icon="mdi:close" class="size-5" />
                </button>
            </div>
            <div class="mt-6 grid gap-4">
                <label class="grid gap-2 text-sm text-slate-300">
                    本地项目
                    <select
                        bind:value={selectedProjectId}
                        onchange={() => {
                            const project = projects.find((item) => item.id === selectedProjectId)
                            if (project) title = project.name
                        }}
                        class="h-11 rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:border-violet-400/50"
                    >
                        {#each projects as project}
                            <option value={project.id}>{project.name}</option>
                        {/each}
                    </select>
                </label>
                <label class="grid gap-2 text-sm text-slate-300">
                    方案名称
                    <input
                        bind:value={title}
                        maxlength="80"
                        class="h-11 rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:border-violet-400/50"
                    />
                </label>
                <label class="grid gap-2 text-sm text-slate-300">
                    游戏版本（可选）
                    <input
                        bind:value={gameVersion}
                        maxlength="32"
                        placeholder="例如 3.5"
                        class="h-11 rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:border-violet-400/50"
                    />
                </label>
                <label class="grid gap-2 text-sm text-slate-300">
                    说明
                    <textarea
                        bind:value={description}
                        maxlength="500"
                        rows="4"
                        placeholder="说明轴表思路、适用场景或操作要点"
                        class="resize-none rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-violet-400/50"
                    ></textarea>
                </label>
                <div class="grid gap-2 text-sm text-slate-300">
                    <span>教学网址（可选）</span>
                    <div class="flex gap-2">
                        <input
                            bind:value={tutorialUrl}
                            maxlength="2048"
                            placeholder="Bilibili、YouTube 或其他教学网页"
                            onblur={loadTutorialPreview}
                            class="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:border-violet-400/50"
                        />
                        <button
                            type="button"
                            onclick={loadTutorialPreview}
                            disabled={!tutorialUrl.trim() || tutorialPreviewing}
                            class="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs transition hover:bg-white/5 disabled:opacity-40"
                        >
                            <Icon
                                icon={tutorialPreviewing ? 'mdi:loading' : 'mdi:image-search-outline'}
                                class={['size-4', tutorialPreviewing && 'animate-spin']}
                            />
                            读取封面
                        </button>
                    </div>
                    {#if tutorialError}
                        <p class="text-xs text-red-300">{tutorialError}</p>
                    {:else if tutorialPreview}
                        <div class="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                            {#if tutorialPreview.coverUrl}
                                <img
                                    src={tutorialPreview.coverUrl}
                                    alt=""
                                    class="h-16 w-28 shrink-0 rounded-xl object-cover"
                                    referrerpolicy="no-referrer"
                                />
                            {:else}
                                <span
                                    class="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl bg-violet-400/10"
                                >
                                    <Icon icon="mdi:link-variant" class="size-6 text-violet-300" />
                                </span>
                            {/if}
                            <p class="line-clamp-2 text-xs leading-5 text-slate-300">{tutorialPreview.title}</p>
                        </div>
                    {/if}
                </div>
            </div>
            <button
                onclick={publish}
                disabled={!title.trim() || !selectedProjectId || publishing}
                class="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 font-medium transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
                <Icon
                    icon={publishing ? 'mdi:loading' : 'mdi:cloud-upload-outline'}
                    class={['size-5', publishing && 'animate-spin']}
                />
                {publishing ? '正在发布' : '确认发布'}
            </button>
        </div>
    </div>
{/if}
