<template>
  <el-dialog v-if="store.dependencies" v-model="showDialog" class="install-panel" @closed="active = ''">
    <template v-if="active" #header="{ titleId, titleClass }">
      <span :id="titleId" :class="[titleClass, '']">
        {{ active.replace(/(koishi-|^@koishijs\/)plugin-/, '') + (workspace ? ' (工作区)' : '') }}
      </span>
      <el-select v-if="!workspace" :disabled="workspace" v-model="selectVersion">
        <el-option v-for="({ result }, version) in data" :key="version" :value="version">
          {{ version }}
          <template v-if="version === current">(当前)</template>
          <span :class="[result, 'theme-color', 'dot-hint']"></span>
        </el-option>
      </el-select>
    </template>

    <p class="danger" v-if="danger">{{ danger }}</p>
    <p class="warning" v-if="warning">{{ warning }}</p>

    <el-scrollbar v-if="active && !workspace && data[version] && Object.keys(data[version].peers).length">
      <table>
        <tr>
          <td>依赖名称</td>
          <td>版本区间</td>
          <td>当前版本</td>
          <td>可用性</td>
        </tr>
        <tr v-for="({ request, resolved, result }, name) in data[version].peers" :key="name">
          <td class="name">{{ name }}</td>
          <td>{{ request }}</td>
          <td>{{ resolved }}</td>
          <td :class="['theme-color', result]">
            <span v-if="result === 'primary'"><k-icon name="info-full"></k-icon>可选</span>
            <span v-else-if="result === 'warning'"><k-icon name="exclamation-full"></k-icon>未下载</span>
            <span v-else-if="result === 'success'"><k-icon name="check-full"></k-icon>已下载</span>
            <span v-else><k-icon name="times-full"></k-icon>不兼容</span>
          </td>
        </tr>
      </table>
    </el-scrollbar>

    <div v-if="local && paths.length">
      点击以前往配置页面：
      <ul>
        <li v-for="([path, active]) of paths" :key="path">
          <span class="link" @click.stop="configure(path)">{{ path }}</span>
          ({{ active ? '运行中' : '闲置' }})
        </li>
        <li v-if="!local.runtime?.id">
          <span class="link" @click.stop="configure(true)">添加新配置</span>
        </li>
      </ul>
    </div>
    <div v-else-if="local">
      <span class="link" @click.stop="configure(true)">你尚未配置此插件，点击立即配置。</span>
    </div>

    <template v-if="active && !global.static" #footer>
      <div class="left"></div>
      <div class="right">
        <el-button @click="showDialog = false">取消</el-button>
        <template v-if="workspace">
          <el-button v-if="current" @click="installDep('')">移除</el-button>
          <el-button v-else @click="installDep(version)" :disabled="unchanged">添加</el-button>
        </template>
        <template v-else>
          <el-button v-if="current" @click="installDep('')">移除</el-button>
          <el-button :type="result" @click="installDep(version)" :disabled="unchanged">
            {{ current ? '更新' : '安装' }}
          </el-button>
        </template>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>

import { computed, ref, watch } from 'vue'
import { global, router, send, store } from '@koishijs/client'
import { analyzeVersions, showDialog, install } from './utils'
import { active, config } from '../utils'
import { parse } from 'semver'

function installDep(version: string) {
  const target = shortname.value
  install({ [active.value]: version }, async () => {
    if (!version || !target || !store.config || getPaths(target).length) return
    const path = target + ':' + Math.random().toString(36).slice(2, 8)
    await send('manager/unload', path, {})
    await router.push('/plugins/' + path)
  })
}

const version = ref<string>()

const selectVersion = computed({
  get() {
    if (store.dependencies[active.value]?.request === version.value) {
      return version.value + ' (当前)'
    } else {
      return version.value
    }
  },
  set(value) {
    version.value = value
  },
})

const unchanged = computed(() => version.value === store.dependencies[active.value]?.request)
const current = computed(() => store.dependencies[active.value]?.resolved)
const local = computed(() => store.packages?.[active.value])

const workspace = computed(() => {
  // workspace plugins:     dependencies ? packages √
  // workspace non-plugins: dependencies √ packages ×
  return store.dependencies[active.value]?.workspace || local.value?.workspace
})

const data = computed(() => {
  if (!active.value || workspace.value) return
  return analyzeVersions(active.value)
})

const danger = computed(() => {
  if (workspace.value) return
  const deprecated = store.dependencies[active.value]?.versions?.[version.value]?.deprecated
  if (deprecated) return deprecated
  if (store.market?.data[active.value]?.insecure) {
    return '警告：从此插件的最新版本中检测出安全性问题。安装或升级此插件可能导致严重问题。'
  }
})

const warning = computed(() => {
  if (!version.value || !current.value || workspace.value) return
  try {
    const source = parse(current.value)
    const target = parse(version.value)
    if (source.major !== target.major || !source.major && source.minor !== target.minor) {
      return '提示：你正在更改依赖的主版本号。这可能导致不兼容的行为。'
    }
  } catch {}
})

const result = computed(() => {
  if (!version.value) return
  const { result } = data.value[version.value]
  if (result === 'danger' || danger.value) return 'danger'
  if (result === 'warning' || warning.value) return 'warning'
  return result
})

watch(() => active.value, (value) => {
  showDialog.value = !!value
  if (!value) return
  version.value = config.value.override[active.value]
    || store.dependencies[active.value]?.request
    || store.market.data[value].version
}, { immediate: true })

function* find(target: string, plugins: {}, prefix: string): IterableIterator<[string, boolean]> {
  for (let key in plugins) {
    const config = plugins[key]
    const active = !key.startsWith('~')
    if (!active) key = key.slice(1)
    const request = key.split(':')[0]
    if (request === target) yield [prefix + key, active]
    if (request === 'group') {
      yield* find(target, config, prefix + key + '/')
    }
  }
}

const pluginRegExp = /(koishi-|^@koishijs\/)plugin-/

const shortname = computed(() => {
  if (!pluginRegExp.test(active.value)) return ''
  return active.value.replace(pluginRegExp, '')
})

const paths = computed(() => getPaths(shortname.value))

function getPaths(target: string) {
  if (!target || !store.config) return []
  return [...find(target, store.config.plugins, '')]
}

function configure(path: string | true) {
  showDialog.value = false
  if (path === true) {
    path = shortname.value + ':' + Math.random().toString(36).slice(2, 8)
    send('manager/unload', path, {})
  }
  router.push('/plugins/' + path)
}

</script>

<style lang="scss">

.install-panel {
  .el-dialog__header {
    display: flex;
    gap: 0 0.5em;
    align-items: center;
    padding-right: 36px;
    padding-bottom: 4px;

    .el-dialog__title {
      font-weight: 500;
      color: var(--fg1);
      margin-right: 0.5rem;
      flex: 0 0 auto;
    }

    .el-select {
      flex: 1 1 auto;
      max-width: 12.5rem;
      margin: -2px 0 -4px;
    }
  }

  .warning {
    color: var(--warning);
  }

  .danger {
    color: var(--danger);
  }

  .version-badges {
    float: right;
    margin-right: -12px;
  }

  .el-dialog__body {
    padding: 0 20px;
    min-height: 40px;

    > div {
      margin: 1rem 0;
    }

    &:last-child {
      padding-bottom: 1rem;
    }
  }

  table {
    td, th {
      padding: 0.5em 0.875em;
      white-space: nowrap;
    }
  }

  td.name {
    text-align: left;
  }

  td.theme-color span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  span.link {
    &:hover {
      cursor: pointer;
      text-decoration: underline;
    }
  }

  .el-button + .el-button {
    margin-left: 1rem;
  }

  .el-dialog__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.dot-hint::before {
  content: '';
  position: absolute;
  border-radius: 100%;
  width: 0.5rem;
  height: 0.5rem;
  top: 50%;
  right: 20px;
  transform: translate(0, -50%);
  background-color: currentColor;
  transition: background-color 0.3s ease;
  box-shadow: 1px 1px 2px #3333;
}

</style>
