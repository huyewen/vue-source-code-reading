// 对Vue的第一层封装
import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

// 初始化Vue.config、Vue.options、Vue.util、Vue.set、Vue.delete、Vue.nextTick、Vue.use、Vue.extend、Vue.mixin等静态属性和静态方法
// 以及为Vue.options初始化全局组件、全局指令、全局filter的容器、并将全局组件keep-alive装进Vue.options.components中
initGlobalAPI(Vue)

/**
 * 经过上面全局初始化，Vue构造函数对象拥有以下属性（这里暂且将构造函数作为对象说明）
 * Vue = {
 *  config: {...},
 *  util: {
 *    warn: f(){},
 *    extend: f(){},
 *    mergeOptions: f(){},
 *    defineReactive: f(){},
 *  },
 *  set: f(){},
 *  delete: f(){},
 *  nextTick: f(){},
 *  observable: f(){},
 *  use: f(){},
 *  extend: f(){},
 *  mixin: f(){},
 *  component: f(){},
 *  directive: f(){},
 *  filter: f(){},
 *  options: {
 *     _base: Vue // Vue本身，这个后面用得到
 *    filters: {},
 *    direatives: {},
 *    components: {
 *      keepAlive: {
 *        name: 'keep-alive',
 *        ...
 *      }
 *    }
 *  }
 * }
 */

Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

Vue.version = '__VERSION__'

export default Vue


/**
 * 第一层包装后Vue.options里面有
 * Vue.options = {
 *  _base: Vue // Vue本身，这个后面用得到
 *  filters: {},
 *  direatives: {},
 *  components: {
 *    keepAlive: {
 *      name: 'keep-alive',
 *      ...
 *    }
 *  }
 * }
 */
