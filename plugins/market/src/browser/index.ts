import { Context, Schema } from 'koishi'
import Installer from './installer'
import MarketProvider from './market'

export * from './installer'
export * from './market'
export * from '../shared'

export {
  Installer,
  MarketProvider,
}

export const filter = false
export const name = 'manager'
export const using = ['console'] as const

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context, config: Config) {
  ctx.plugin(Installer)
  ctx.plugin(MarketProvider)

  ctx.console.addEntry(process.env.KOISHI_BASE ? [
    process.env.KOISHI_BASE + '/dist/index.js',
    process.env.KOISHI_BASE + '/dist/style.css',
  ] : [
    // @ts-ignore
    import.meta.url.replace(/\/src\/[^/]+\/[^/]+$/, '/client/index.ts'),
  ])
}
