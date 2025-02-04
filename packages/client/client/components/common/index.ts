import { App } from 'vue'
import Badge from './k-badge.vue'
import Button from './k-button.vue'
import Hint from './k-hint.vue'
import Tab from './k-tab.vue'

export default function (app: App) {
  app.component('k-badge', Badge)
  app.component('k-button', Button)
  app.component('k-hint', Hint)
  app.component('k-tab', Tab)
}
