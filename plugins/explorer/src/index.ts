import { Context, Schema } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { join, relative, resolve } from 'path'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { FSWatcher, watch } from 'chokidar'
import anymatch, { Tester } from 'anymatch'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      explorer: Explorer
    }
  }

  interface Events {
    'explorer/read'(filename: string, binary?: boolean): Promise<string>
    'explorer/write'(filename: string, content: string, binary?: boolean): Promise<void>
    'explorer/mkdir'(filename: string): Promise<void>
    'explorer/remove'(filename: string): Promise<void>
    'explorer/rename'(oldValue: string, newValue: string): Promise<void>
    'explorer/refresh'(): void
  }
}

export interface Entry {
  type: 'file' | 'directory'
  name: string
  filename?: string
  children?: this[]
  oldValue?: string
  newValue?: string
}

class Explorer extends DataService<Entry[]> {
  task: Promise<Entry[]>
  watcher: FSWatcher
  globFilter: Tester

  constructor(ctx: Context, config: Explorer.Config) {
    super(ctx, 'explorer', { authority: 4 })

    ctx.console.addEntry(process.env.KOISHI_BASE ? [
      process.env.KOISHI_BASE + '/dist/index.js',
      process.env.KOISHI_BASE + '/dist/style.css',
    ] : process.env.KOISHI_ENV === 'browser' ? [
      // @ts-ignore
      import.meta.url.replace(/\/src\/[^/]+$/, '/client/index.ts'),
    ] : {
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

    this.globFilter = anymatch(config.ignored)

    this.watcher = watch(ctx.baseDir, {
      cwd: ctx.baseDir,
      ignored: config.ignored,
    })

    ctx.console.addListener('explorer/read', async (filename, binary) => {
      filename = join(ctx.baseDir, filename)
      if (binary) {
        const buffer = await readFile(filename)
        return buffer.toString('base64')
      } else {
        return readFile(filename, 'utf8')
      }
    }, { authority: 4 })

    ctx.console.addListener('explorer/write', async (filename, content, binary) => {
      filename = join(ctx.baseDir, filename)
      if (binary) {
        const buffer = Buffer.from(content, 'base64')
        await writeFile(filename, buffer)
      } else {
        await writeFile(filename, content, 'utf8')
      }
      this.refresh()
    }, { authority: 4 })

    ctx.console.addListener('explorer/mkdir', async (filename) => {
      filename = join(ctx.baseDir, filename)
      await mkdir(filename)
      this.refresh()
    }, { authority: 4 })

    ctx.console.addListener('explorer/remove', async (filename) => {
      filename = join(ctx.baseDir, filename)
      await rm(filename, { recursive: true })
      this.refresh()
    }, { authority: 4 })

    ctx.console.addListener('explorer/rename', async (oldValue, newValue) => {
      oldValue = join(ctx.baseDir, oldValue)
      newValue = join(ctx.baseDir, newValue)
      await rename(oldValue, newValue)
      this.refresh()
    }, { authority: 4 })

    ctx.console.addListener('explorer/refresh', () => {
      this.refresh()
    }, { authority: 4 })
  }

  stop() {
    this.watcher?.close()
  }

  private async traverse(root: string): Promise<Entry[]> {
    const dirents = await readdir(root, { withFileTypes: true })
    return Promise.all(dirents.map<Promise<Entry>>(async (dirent) => {
      const filename = join(root, dirent.name)
      if (this.globFilter(relative(this.ctx.baseDir, filename))) return
      if (dirent.isFile()) {
        return { type: 'file', name: dirent.name }
      } else if (dirent.isDirectory()) {
        return { type: 'directory', name: dirent.name, children: await this.traverse(filename) }
      }
    })).then((entries) => entries
      .filter(Boolean)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      }))
  }

  private async _get() {
    return this.traverse(this.ctx.baseDir)
  }

  async get(forced = false) {
    if (!forced && this.task) return this.task
    return this.task = this._get()
  }
}

namespace Explorer {
  export const filter = false
  export const using = ['console'] as const

  export interface Config {
    ignored?: string[]
  }

  export const Config: Schema<Config> = Schema.object({
    ignored: Schema
      .array(String)
      .role('table')
      .default(['**/node_modules', '**/.*', 'accounts/*/data'])
      .description('要忽略的文件或目录。支持 [Glob Patterns](https://github.com/micromatch/micromatch) 语法。'),
  })
}

export default Explorer
