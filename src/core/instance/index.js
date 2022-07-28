import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// Vue构造函数
function Vue (options) {
  // Vue只能作为构造函数调用
  // 不是以构造函数方式调用Vue，当以构造函数调用Vue时，此时this应指向Vue的实例
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 调用Vue.prototype._init
  this._init(options)
}
/**
 * 挂载_init到Vue原型上
 */
initMixin(Vue)
/**
 * 将_data、_props挂载到$data、$props
 * 然后在Vue原型上 挂载$set、$delete、$watch
 * Vue.prototype = {
 *  ...,
 *  $data: {},
 *  $props: {},
 *  $set: function(){},
 *  $delete: function() {},
 *  $watch: function() {},
 *  ...
 * }
 */
stateMixin(Vue)
/**
 * 将$on、$once、$off、$emit挂载到Vue的原型上
 * Vue.prototype = {
 *  ...,
 *  $on: function(){},
 *  $once: function() {},
 *  $off: function() {},
 *  $emit: function() {},
 *  ...
 * }
 */
eventsMixin(Vue)
/**
 * 将_update、$forceUpdate、$destroy挂载到Vue原型上
 *  Vue.prototype = {
 *  ...,
 *  _update: function(){},
 *  $forceUpdate: function() {},
 *  $destroy: function() {},
 *  ...
 * }
 */
lifecycleMixin(Vue)
/**
 * 将$nextTick、_render挂载到Vue原型上
 */
renderMixin(Vue)

export default Vue
