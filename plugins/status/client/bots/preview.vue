<template>
  <div class="bot">
    <div class="avatar" :style="{ backgroundImage: `url(${data.avatar})` }" @click="$emit('avatar-click')">
      <el-tooltip :content="statusNames[data.status]" placement="right">
        <status-light :class="data.status"></status-light>
      </el-tooltip>
    </div>
    <div class="info">
      <div><k-icon name="robot"/>{{ data.username }}</div>
      <div><k-icon name="platform"/>{{ data.platform }}</div>
      <div class="cur-frequency">
        <span style="margin-right: 8px">
          <k-icon name="arrow-up"/>
          <span>{{ data.messageSent }}/min</span>
        </span>
        <span>
          <k-icon name="arrow-down"/>
          <span>{{ data.messageReceived }}/min</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>

import type { Bot } from 'koishi'
import type { ProfileProvider } from '@koishijs/plugin-status/src'
import StatusLight from './light.vue'

const statusNames: Record<Bot.Status, string> = {
  online: '运行中',
  offline: '离线',
  connect: '正在连接',
  reconnect: '正在重连',
  disconnect: '正在断开',
}

defineProps<{
  data: ProfileProvider.BotData
}>()

</script>

<style scoped lang="scss">

div.bot {
  width: 15rem;
  padding: 0.75rem 1rem;
  font-size: 14px;
  display: flex;
  transition: 0.3s ease;

  & + & {
    border-top: 1px solid var(--border);
  }

  &.active {
    > div.avatar {
      border-color: var(--active);
    }
  }

  > div.avatar {
    position: relative;
    width: 4rem;
    height: 4rem;
    box-sizing: content-box;
    border: 1px solid var(--border);
    transition: border 0.3s ease;
    border-radius: 100%;
    background-size: 100%;
    background-repeat: no-repeat;
    transition: 0.1s ease;

    $borderWidth: 1px;

    .status-light {
      position: absolute;
      bottom: -$borderWidth;
      right: -$borderWidth;
      width: 0.875rem;
      height: 0.875rem;
      border: $borderWidth solid var(--bg0);
    }
  }

  > div.info {
    flex-grow: 1;
    margin-left: 1.25rem;
    display: flex;
    flex-direction: column;
    justify-content: space-around;

    .k-icon {
      width: 20px;
      margin-right: 6px;
      text-align: center;
      vertical-align: -2px;
    }
  }
}

</style>
