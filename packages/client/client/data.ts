import { AbstractWebSocket, ClientConfig, Console, DataService, Events } from '@koishijs/plugin-console'
import { Promisify } from 'koishi'
import { markRaw, reactive, ref } from 'vue'
import { RemovableRef, useLocalStorage } from '@vueuse/core'

interface StorageData<T> {
  version: number
  data: T
}

export function createStorage<T extends object>(key: string, version: number, fallback?: () => T) {
  const storage = useLocalStorage('koishi.console.' + key, {} as StorageData<T>)
  const initial = fallback ? fallback() : {} as T
  if (storage.value.version !== version) {
    storage.value = { version, data: initial }
  } else if (!Array.isArray(storage.value.data)) {
    storage.value.data = { ...initial, ...storage.value.data }
  }
  return reactive<T>(storage.value['data'])
}

export let useStorage = <T extends object>(key: string, version: number, fallback?: () => T): RemovableRef<T> => {
  const initial = fallback ? fallback() : {} as T
  initial['__version__'] = version
  const storage = useLocalStorage('koishi.console.' + key, initial)
  if (storage.value['__version__'] !== version) {
    storage.value = initial
  }
  return storage
}

export function provideStorage(factory: typeof useStorage) {
  useStorage = factory
}

export type Store = {
  [K in keyof Console.Services]?: Console.Services[K] extends DataService<infer T> ? T : never
}

declare const KOISHI_CONFIG: ClientConfig
export const config = KOISHI_CONFIG
export const store = reactive<Store>({})

export { config as global }

export const socket = ref<AbstractWebSocket>(null)
const listeners: Record<string, (data: any) => void> = {}
const responseHooks: Record<string, [Function, Function]> = {}

export function send<T extends keyof Events>(type: T, ...args: Parameters<Events[T]>): Promisify<ReturnType<Events[T]>>
export function send(type: string, ...args: any[]) {
  if (!socket.value) return
  const id = Math.random().toString(36).slice(2, 9)
  socket.value.send(JSON.stringify({ id, type, args }))
  return new Promise((resolve, reject) => {
    responseHooks[id] = [resolve, reject]
    setTimeout(() => {
      delete responseHooks[id]
      reject(new Error('timeout'))
    }, 60000)
  })
}

export function receive<T = any>(event: string, listener: (data: T) => void) {
  listeners[event] = listener
}

receive('data', ({ key, value }) => {
  store[key] = value
})

receive('patch', ({ key, value }) => {
  if (Array.isArray(store[key])) {
    store[key].push(...value)
  } else {
    Object.assign(store[key], value)
  }
})

receive('response', ({ id, value, error }) => {
  if (!responseHooks[id]) return
  const [resolve, reject] = responseHooks[id]
  delete responseHooks[id]
  if (error) {
    reject(error)
  } else {
    resolve(value)
  }
})

export function connect(callback: () => AbstractWebSocket) {
  const value = callback()

  let sendTimer: number
  let closeTimer: number
  const refresh = () => {
    if (!config.heartbeat) return
    clearTimeout(sendTimer)
    clearTimeout(closeTimer)
    sendTimer = +setTimeout(() => send('ping'), config.heartbeat.interval)
    closeTimer = +setTimeout(() => value?.close(), config.heartbeat.timeout)
  }

  const reconnect = () => {
    socket.value = null
    for (const key in store) {
      store[key] = undefined
    }
    console.log('[koishi] websocket disconnected, will retry in 1s...')
    setTimeout(() => {
      connect(callback).then(location.reload, () => {
        console.log('[koishi] websocket disconnected, will retry in 1s...')
      })
    }, 1000)
  }

  value.addEventListener('message', (ev) => {
    refresh()
    const data = JSON.parse(ev.data)
    console.debug('%c', 'color:purple', data.type, data.body)
    if (data.type in listeners) {
      listeners[data.type](data.body)
    }
  })

  value.addEventListener('close', reconnect)

  return new Promise<AbstractWebSocket.Event>((resolve, reject) => {
    value.addEventListener('open', (event) => {
      socket.value = markRaw(value)
      resolve(event)
    })
    value.addEventListener('error', reject)
  })
}
