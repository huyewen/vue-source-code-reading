/* @flow */
// 对Vue的第二层封装
import Vue from 'core/index'
import config from 'core/config'
import { extend, noop } from 'shared/util'
import { mountComponent } from 'core/instance/lifecycle'
import { devtools, inBrowser } from 'core/util/index'

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement
} from 'web/util/index'

import { patch } from './patch'
import platformDirectives from './directives/index'
import platformComponents from './components/index'

// install platform specific utils
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag // 判断是否为保留标签
Vue.config.isReservedAttr = isReservedAttr // 判断是否为保留属性
Vue.config.getTagNamespace = getTagNamespace // 获取标签命名空间
Vue.config.isUnknownElement = isUnknownElement // 判断是否为未知元素

// install platform runtime directives & components
/**
 * platformDirectives : {model,show}
 */
extend(Vue.options.directives, platformDirectives) // 添加全局指令
/**
 * platformComponents : {Transition,TransitionGroup}
 */
extend(Vue.options.components, platformComponents) // 添加全局组件

// install platform patch function
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}

// devtools global hook
/* istanbul ignore next */
if (inBrowser) {
  setTimeout(() => {
    if (config.devtools) {
      if (devtools) {
        devtools.emit('init', Vue)
      } else if (
        process.env.NODE_ENV !== 'production' &&
        process.env.NODE_ENV !== 'test'
      ) {
        console[console.info ? 'info' : 'log'](
          'Download the Vue Devtools extension for a better development experience:\n' +
          'https://github.com/vuejs/vue-devtools'
        )
      }
    }
    if (process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'test' &&
      config.productionTip !== false &&
      typeof console !== 'undefined'
    ) {
      console[console.info ? 'info' : 'log'](
        `You are running Vue in development mode.\n` +
        `Make sure to turn on production mode when deploying for production.\n` +
        `See more tips at https://vuejs.org/guide/deployment.html`
      )
    }
  }, 0)
}

export default Vue

/* *
 * 经过对Vue的第二层封装后，Vue.options变成
 * Vue.options = {
 *  _base: Vue // Vue本身，这个后面用得到
 *  filters: {},
 *  direatives: {
 *    model: { ... },
 *    show: { ... }
 *  },
 *  components: {
 *    keepAlive: {
 *      name: 'keep-alive',
 *      ...
 *    },
 *    Transition: {
 *      name: 'transition',
 *      ...
 *    },
 *    TransitionGroup: {
 *      name: 'transition-group',
 *      ...
 *    }
 *  }
 * }
 *
 */