<template>
  <k-layout>
    <el-scrollbar class="container">
      <div ref="root" class="logs">
        <div class="line" :class="{ start: line.includes(hint) }" v-for="line in store.logs">
          <code v-html="renderLine(line)"></code>
        </div>
      </div>
    </el-scrollbar>
  </k-layout>
</template>

<script lang="ts" setup>

import { watch, ref, nextTick, onActivated } from 'vue'
import { store } from '@koishijs/client'
import ansi from 'ansi_up'

const root = ref<HTMLElement>()

const hint = `app\u001b[0m \u001b[38;5;15;1mKoishi/`

// this package does not have consistent exports in different environments
const converter = new (ansi['default'] || ansi)()

function renderLine(line: string) {
  return converter.ansi_to_html(line)
}

onActivated(() => {
  const wrapper = root.value.parentElement.parentElement
  wrapper.scrollTop = wrapper.scrollHeight
})

watch(() => store.logs.length, async () => {
  const wrapper = root.value.parentElement.parentElement
  const { scrollTop, clientHeight, scrollHeight } = wrapper
  if (Math.abs(scrollTop + clientHeight - scrollHeight) < 1) {
    await nextTick()
    wrapper.scrollTop = scrollHeight
  }
})

</script>

<style lang="scss" scoped>

.container {
  color: var(--terminal-fg);
  background-color: var(--terminal-bg);

  .logs {
    padding: 1rem 1rem;
  }

  .logs .line.start {
    margin-top: 1rem;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: -0.5rem;
      border-top: 1px solid var(--terminal-separator);
    }
  }

  .logs:first-child .line:first-child {
    margin-top: 0;

    &::before {
      display: none;
    }
  }

  .line {
    padding: 0 0.5rem;
    border-radius: 2px;
    font-size: 14px;
    line-height: 20px;
    white-space: pre-wrap;
    position: relative;

    &:hover {
      color: var(--terminal-fg-hover);
      background-color: var(--terminal-bg-hover);
    }

    ::selection {
      background-color: var(--terminal-bg-selection);
    }
  }
}

</style>
