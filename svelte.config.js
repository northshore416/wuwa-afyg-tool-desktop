import vercelAdapter from '@sveltejs/adapter-vercel'
import cloudflareAdapter from '@sveltejs/adapter-cloudflare'
import nodeAdapter from '@sveltejs/adapter-node'

const deployTarget = process.env.DEPLOY_TARGET || 'vercel'

const adapter =
    deployTarget === 'cloudflare'
        ? cloudflareAdapter()
        : deployTarget === 'desktop' || deployTarget === 'server'
          ? nodeAdapter({ out: deployTarget === 'server' ? 'build-server' : 'build' })
          : vercelAdapter()

/** @type {import('@sveltejs/kit').Config} */
const config = {
    compilerOptions: {
        runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
    },
    kit: {
        adapter
    }
}

export default config
