import { Context } from '@koishijs/client'
import Sandbox from './layout.vue'
import './icons'

export default (ctx: Context) => {
  ctx.page({
    name: '沙盒',
    path: '/sandbox',
    icon: 'activity:flask',
    order: 300,
    authority: 4,
    component: Sandbox,
  })
}
